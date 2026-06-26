import React, { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'

type PipelineStep = 'uploading' | 'validating' | 'reading' | 'understanding' | 'saving' | 'done' | 'failed'

interface SearchParams {
  docId: string
}

export const ProcessingPage: React.FC = () => {
  const navigate = useNavigate()
  const search = useSearch({ from: '/processing' }) as SearchParams
  const documentId = search.docId

  // Pipeline states
  const [currentStep, setCurrentStep] = useState<PipelineStep>('validating')
  const [errorType, setErrorType] = useState<'non-medical' | 'low-ocr' | 'general' | null>(null)

  useEffect(() => {
    if (!documentId) {
      navigate({ to: '/upload' })
      return
    }

    let intervalId: any
    let hasInvoked = false
    let pollCount = 0
    const MAX_POLLS = 45 // 45 × 2s = 90 second timeout

    const triggerAndPoll = async () => {
      if (!hasInvoked) {
        hasInvoked = true
        try {
          supabase.functions.invoke('analyze-document', {
            body: { documentId }
          }).then(({ data, error }) => {
            if (error) {
              console.error("Edge Function invoke error:", error)
            } else {
              console.log("Edge Function result:", data)
            }
          })
        } catch (err) {
          console.error("Exception invoking analyze-document:", err)
        }
      }

      intervalId = setInterval(async () => {
        pollCount++

        // Timeout after 90 seconds — force show error
        if (pollCount > MAX_POLLS) {
          clearInterval(intervalId)
          // Force-fail the document in DB
          await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId).eq('status', 'processing')
          setErrorType('general')
          setCurrentStep('failed')
          return
        }

        try {
          const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('status, is_medical, name')
            .eq('id', documentId)
            .single()

          if (docErr || !doc) {
            clearInterval(intervalId)
            setErrorType('general')
            setCurrentStep('failed')
            return
          }

          if (doc.is_medical === false) {
            clearInterval(intervalId)
            setErrorType('non-medical')
            setCurrentStep('failed')
            return
          }

          if (doc.status === 'failed') {
            clearInterval(intervalId)
            
            const { data: ocrFail } = await supabase
              .from('ocr_failures')
              .select('error_message')
              .eq('document_id', documentId)
              .limit(1)

            if (ocrFail && ocrFail.length > 0) {
              setErrorType('low-ocr')
            } else {
              setErrorType('general')
            }
            setCurrentStep('failed')
            return
          }

          if (doc.status === 'completed') {
            clearInterval(intervalId)
            setCurrentStep('done')
            setTimeout(() => {
              navigate({ to: `/results`, search: { docId: documentId } })
            }, 1000)
            return
          }

          const { data: ocrText } = await supabase
            .from('extracted_text')
            .select('id')
            .eq('document_id', documentId)
            .limit(1)

          if (ocrText && ocrText.length > 0) {
            const { data: analysis } = await supabase
              .from('analyses')
              .select('id')
              .eq('document_id', documentId)
              .limit(1)

            if (analysis && analysis.length > 0) {
              setCurrentStep('saving')
            } else {
              setCurrentStep('understanding')
            }
          } else {
            setCurrentStep('reading')
          }

        } catch (e: any) {
          console.error("Error polling processing status:", e)
        }
      }, 2000)
    }

    triggerAndPoll()

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [documentId, navigate])


  // Map progress index to steps Order
  const getStepStatus = (step: 'upload' | 'reading' | 'understanding' | 'results') => {
    if (currentStep === 'failed') return 'pending'
    
    const mapping: Record<PipelineStep, 'upload' | 'reading' | 'understanding' | 'results'> = {
      'uploading': 'upload',
      'validating': 'upload',
      'reading': 'reading',
      'understanding': 'understanding',
      'saving': 'understanding',
      'done': 'results',
      'failed': 'upload'
    }

    const currentGroup = mapping[currentStep]
    const groupsOrder: ('upload' | 'reading' | 'understanding' | 'results')[] = ['upload', 'reading', 'understanding', 'results']
    
    const currentIdx = groupsOrder.indexOf(currentGroup)
    const stepIdx = groupsOrder.indexOf(step)

    if (stepIdx < currentIdx) return 'completed'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  // --- 1. FAILURE STATE COMPLYING TO MOCKUP 5 ---
  if (currentStep === 'failed') {
    return (
      <div className="py-12 px-4 max-w-6xl mx-auto space-y-12">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-[#111827]">We couldn't process your document.</h1>
          <p className="text-slate-500 font-semibold mt-2 max-w-lg mx-auto text-sm">
            We encountered an issue with the document you uploaded. Please review the details below and choose an option.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          {/* Card 1: Non-Medical */}
          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'non-medical'
              ? 'border-[#004bb3] ring-4 ring-[#004bb3]/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-[#004bb3] text-3xl mb-8">
                📄
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                This doesn't appear to be a medical document.
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                We're trained to read lab results, doctor's notes, and medical bills. Please ensure you've uploaded the correct file.
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => navigate({ to: '/upload' })}
                className="w-full bg-[#004bb3] text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-[#003d99] transition-colors"
              >
                Upload Another File
              </button>
              <button
                onClick={() => alert("We support blood panels, medication receipts, clinical charts, and bills.")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                View Supported Examples
              </button>
            </div>
          </div>

          {/* Card 2: Blurry OCR */}
          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'low-ocr'
              ? 'border-[#004bb3] ring-4 ring-[#004bb3]/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-[#004bb3] text-3xl mb-8">
                🔘
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                We couldn't read your photo. It's a bit too blurry.
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                To give you an accurate interpretation, we need a clear, well-lit photo of the text. Try holding the camera steady.
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => navigate({ to: '/upload' })}
                className="w-full bg-[#004bb3] text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-[#003d99] transition-colors"
              >
                Upload Another File
              </button>
              <button
                onClick={() => alert("Capture tips:\n- Put document flat\n- Check lighting\n- Keep hand still")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Tips for Good Photos
              </button>
            </div>
          </div>

          {/* Card 3: Server/General Error */}
          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'general'
              ? 'border-[#004bb3] ring-4 ring-[#004bb3]/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center text-[#004bb3] text-3xl mb-8">
                ☁️
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                Something went wrong on our end.
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                We're having trouble processing your document right now. Please check your connection and try again in a moment.
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-[#004bb3] text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-[#003d99] transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => alert("Contact support at help@meddecode.ai")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // --- 2. ACTIVE PROGRESS PIPELINE COMPLYING TO MOCKUP 1 ---
  const uploadStatus = getStepStatus('upload')
  const readingStatus = getStepStatus('reading')
  const understandingStatus = getStepStatus('understanding')
  const resultsStatus = getStepStatus('results')

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-12">
      
      {/* Dynamic Stepper Progress */}
      <div className="flex w-full max-w-2xl justify-between items-center relative px-2">
        {/* Horizontal bar backdrops */}
        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>
        
        {/* Step 1: Upload */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            uploadStatus === 'completed' || uploadStatus === 'active'
              ? 'bg-[#004bb3] text-white border-[#004bb3]'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {uploadStatus === 'completed' ? '✓' : '1'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            uploadStatus === 'active' ? 'text-[#004bb3]' : 'text-slate-400'
          }`}>Upload</span>
        </div>

        {/* Step 2: Reading File */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            readingStatus === 'completed' 
              ? 'bg-[#004bb3] text-white border-[#004bb3]'
              : readingStatus === 'active'
              ? 'bg-[#004bb3] text-white border-[#004bb3] animate-pulse'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {readingStatus === 'completed' ? '✓' : '2'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            readingStatus === 'active' ? 'text-[#004bb3]' : 'text-slate-400'
          }`}>Reading File</span>
        </div>

        {/* Step 3: Understanding Report */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            understandingStatus === 'completed'
              ? 'bg-[#004bb3] text-white border-[#004bb3]'
              : understandingStatus === 'active'
              ? 'bg-[#004bb3] text-white border-[#004bb3] animate-pulse'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {understandingStatus === 'completed' ? '✓' : '3'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            understandingStatus === 'active' ? 'text-[#004bb3]' : 'text-slate-400'
          }`}>Understanding Report</span>
        </div>

        {/* Step 4: Results Ready */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            resultsStatus === 'completed' || resultsStatus === 'active'
              ? 'bg-[#004bb3] text-white border-[#004bb3]'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            4
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            resultsStatus === 'active' ? 'text-[#004bb3]' : 'text-slate-400'
          }`}>Results Ready</span>
        </div>
      </div>

      {/* Blue Glow Graphic Scanner */}
      <div className="relative flex items-center justify-center w-48 h-48">
        <div className="absolute inset-0 bg-[#004bb3]/5 rounded-full blur-3xl scale-125 animate-pulse"></div>
        <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl flex items-center justify-center text-4xl text-[#004bb3] border-[#004bb3]/20 relative">
          🔍
          <div className="absolute inset-x-2 top-0 h-0.5 bg-[#004bb3] shadow-md shadow-[#004bb3]/50 animate-scan"></div>
        </div>
      </div>

      {/* Titles and descriptions */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#004bb3] tracking-tight">
          Analyzing your document...
        </h1>
        
        <p className="text-slate-500 text-sm font-semibold max-w-md mx-auto leading-relaxed">
          This usually takes 3-5 seconds. Please don't close this tab while we translate complex medical terms into plain English.
        </p>
      </div>

    </div>
  )
}
