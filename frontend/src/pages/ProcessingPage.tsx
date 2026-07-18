import React, { useEffect, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { invokeAnalyzeDocument } from '../services/analyzeDocument'
import { FileText, Check } from 'lucide-react'

type PipelineStep = 'uploading' | 'validating' | 'reading' | 'understanding' | 'saving' | 'done' | 'failed'

interface SearchParams {
  docId: string
  detailLevel?: string
  docType?: string
  outputLanguage?: 'english' | 'hindi'
}

export const ProcessingPage: React.FC = () => {
  const navigate = useNavigate()
  const search = useSearch({ from: '/processing' }) as SearchParams
  const documentId = search.docId

  const [currentStep, setCurrentStep] = useState<PipelineStep>('validating')
  const [errorType, setErrorType] = useState<'non-medical' | 'low-ocr' | 'general' | null>(null)
  const [customErrorMsg, setCustomErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!documentId) {
      navigate({ to: '/upload' })
      return
    }

    let intervalId: any
    const hasInvokedRef = { current: false }
    let pollCount = 0
    const MAX_POLLS = 45
    const abortController = new AbortController()

    const triggerAndPoll = async () => {
      if (!hasInvokedRef.current) {
        hasInvokedRef.current = true
        try {
          const detailLevel = search.detailLevel || 'full'
          const docType = search.docType || 'unknown'
          const outputLanguage = search.outputLanguage || 'english'
          invokeAnalyzeDocument({ documentId, detailLevel: detailLevel as any, docType, outputLanguage }).then(async ({ data, error }) => {
            if (abortController.signal.aborted) return
            if (error) {
              console.error("Edge Function invoke error:", error)
              if (intervalId) clearInterval(intervalId)
              
              const isHindiUi = localStorage.getItem("meddecode_language") === 'hi'
              let msg = isHindiUi
                ? "हम अभी आपके दस्तावेज़ को संसाधित नहीं कर पा रहे हैं। कृपया अपना कनेक्शन जांचें और थोड़ी देर बाद पुनः प्रयास करें।"
                : "We're having trouble processing your document right now. Please check your connection and try again in a moment."
              
              if (error.status === 429) {
                msg = isHindiUi
                  ? "दैनिक सीमा समाप्त हो गई है या दर सीमा पार हो गई है। कृपया थोड़ी देर बाद पुनः प्रयास करें।"
                  : "Daily limit reached or rate limit exceeded. Please try again later."
              } else {
                try {
                  const response = (error as any).context
                  if (response && typeof response.clone === 'function') {
                    const cloned = response.clone()
                    const bodyText = await cloned.text()
                    const bodyJson = JSON.parse(bodyText)
                    if (bodyJson.error) {
                      msg = bodyJson.error
                    }
                  }
                } catch (_) {}
              }
              
              await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId)
              setCustomErrorMsg(msg)
              setErrorType('general')
              setCurrentStep('failed')
            } else {
              console.log("Edge Function result:", data)
            }
          })
        } catch (err) {
          if (!abortController.signal.aborted) {
            console.error("Exception invoking analyze-document:", err)
          }
        }
      }

      intervalId = setInterval(async () => {
        if (abortController.signal.aborted) {
          clearInterval(intervalId)
          return
        }

        pollCount++

        if (pollCount > MAX_POLLS) {
          clearInterval(intervalId)
          await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId).eq('status', 'processing')
          setErrorType('general')
          setCurrentStep('failed')
          return
        }

        try {
          const { data: doc, error: docErr } = await supabase
            .from('documents')
            .select('status, is_medical, name, processing_stage')
            .eq('id', documentId)
            .single()

          if (abortController.signal.aborted) return

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

            if (!abortController.signal.aborted) {
              if (ocrFail && ocrFail.length > 0) {
                setErrorType('low-ocr')
              } else {
                setErrorType('general')
              }
              setCurrentStep('failed')
            }
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

          // Use processing_stage for granular UI updates
          const stage = doc.processing_stage
          if (stage === 'saving') {
            setCurrentStep('saving')
          } else if (stage === 'ai_analysis') {
            setCurrentStep('understanding')
          } else if (stage === 'ocr') {
            setCurrentStep('reading')
          } else {
            setCurrentStep('validating')
          }

        } catch (e: any) {
          if (!abortController.signal.aborted) {
            console.error("Error polling processing status:", e)
          }
        }
      }, 2000)
    }

    triggerAndPoll()

    return () => {
      abortController.abort()
      if (intervalId) clearInterval(intervalId)
    }
  }, [documentId, navigate])

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

  if (currentStep === 'failed') {
    const isHindiUi = localStorage.getItem("meddecode_language") === 'hi'
    return (
      <div className="py-12 px-4 max-w-6xl mx-auto space-y-12">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-[#111827]">
            {isHindiUi ? "हम आपके दस्तावेज़ को संसाधित नहीं कर सके।" : "We couldn't process your document."}
          </h1>
          <p className="text-slate-500 font-semibold mt-2 max-w-lg mx-auto text-sm">
            {isHindiUi 
              ? "आपके द्वारा अपलोड किए गए दस्तावेज़ में हमें एक समस्या मिली है। कृपया नीचे दिए गए विवरण की समीक्षा करें और एक विकल्प चुनें।" 
              : "We encountered an issue with the document you uploaded. Please review the details below and choose an option."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full">
          
          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'non-medical'
              ? 'border-primary ring-4 ring-primary/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center text-primary text-3xl mb-8">
                📄
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                {isHindiUi ? "यह कोई चिकित्सा दस्तावेज़ प्रतीत नहीं होता है।" : "This doesn't appear to be a medical document."}
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                {isHindiUi
                  ? "हम लैब परिणाम, डॉक्टर के पर्चे और मेडिकल बिल पढ़ने के लिए प्रशिक्षित हैं। कृपया सुनिश्चित करें कि आपने सही फ़ाइल अपलोड की है।"
                  : "We're trained to read lab results, doctor's notes, and medical bills. Please ensure you've uploaded the correct file."}
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => navigate({ to: '/upload' })}
                className="w-full bg-primary text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-primary/90 transition-colors"
              >
                {isHindiUi ? "दूसरा दस्तावेज़ अपलोड करें" : "Upload Another File"}
              </button>
              <button
                onClick={() => alert(isHindiUi 
                  ? "हम रक्त परीक्षण रिपोर्ट, दवाओं के पर्चे, क्लिनिकल चार्ट और बिलों का समर्थन करते हैं।" 
                  : "We support blood panels, medication receipts, clinical charts, and bills.")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                {isHindiUi ? "समर्थित उदाहरण देखें" : "View Supported Examples"}
              </button>
            </div>
          </div>

          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'low-ocr'
              ? 'border-primary ring-4 ring-primary/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center text-primary text-3xl mb-8">
                🔘
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                {isHindiUi ? "हम आपकी फ़ोटो नहीं पढ़ सके। यह थोड़ी धुंधली है।" : "We couldn't read your photo. It's a bit too blurry."}
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                {isHindiUi
                  ? "सटीक परिणाम के लिए, हमें स्पष्ट और अच्छी रोशनी वाली फ़ोटो की आवश्यकता है। कैमरे को स्थिर रखने का प्रयास करें।"
                  : "To give you an accurate interpretation, we need a clear, well-lit photo of the text. Try holding the camera steady."}
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => navigate({ to: '/upload' })}
                className="w-full bg-primary text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-primary/90 transition-colors"
              >
                {isHindiUi ? "दूसरा दस्तावेज़ अपलोड करें" : "Upload Another File"}
              </button>
              <button
                onClick={() => alert(isHindiUi
                  ? "फ़ोटो लेने के सुझाव:\n- दस्तावेज़ को समतल रखें\n- रोशनी की जांच करें\n- हाथ को स्थिर रखें"
                  : "Capture tips:\n- Put document flat\n- Check lighting\n- Keep hand still")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                {isHindiUi ? "अच्छी फ़ोटो के लिए सुझाव" : "Tips for Good Photos"}
              </button>
            </div>
          </div>

          <div className={`border rounded-[32px] p-8 text-center flex flex-col justify-between items-center bg-white shadow-md min-h-[460px] w-full transition-all duration-300 ${
            errorType === 'general'
              ? 'border-primary ring-4 ring-primary/10 scale-105 shadow-xl'
              : 'border-slate-200 opacity-40'
          }`}>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center text-primary text-3xl mb-8">
                ☁️
              </div>
              <h3 className="font-extrabold text-2xl text-slate-900 leading-snug mb-4">
                {isHindiUi ? "हमारी ओर से कुछ गड़बड़ हुई है।" : "Something went wrong on our end."}
              </h3>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
                {customErrorMsg || (
                  isHindiUi
                    ? "हम अभी आपके दस्तावेज़ को संसाधित नहीं कर पा रहे हैं। कृपया अपना कनेक्शन जांचें और थोड़ी देर बाद पुनः प्रयास करें।"
                    : "We're having trouble processing your document right now. Please check your connection and try again in a moment."
                )}
              </p>
            </div>
            <div className="w-full space-y-3 pt-8">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-primary text-white font-extrabold py-4 rounded-full text-sm cursor-pointer shadow-sm hover:bg-primary/90 transition-colors"
              >
                {isHindiUi ? "पुनः प्रयास करें" : "Try Again"}
              </button>
              <button
                onClick={() => alert(isHindiUi
                  ? "help@meddecode.ai पर सहायता टीम से संपर्क करें"
                  : "Contact support at help@meddecode.ai")}
                className="w-full bg-slate-100 text-slate-600 font-extrabold py-4 rounded-full text-sm hover:bg-slate-200 cursor-pointer transition-colors"
              >
                {isHindiUi ? "सहायता से संपर्क करें" : "Contact Support"}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const uploadStatus = getStepStatus('upload')
  const readingStatus = getStepStatus('reading')
  const understandingStatus = getStepStatus('understanding')
  const resultsStatus = getStepStatus('results')

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[70vh] space-y-12">
      
      {/* 4-Step Progress Indicator */}
      <div className="flex w-full max-w-2xl justify-between items-center relative px-2">
        
        <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-100 dark:bg-slate-800 -z-10"></div>
        
        {/* Step 1 */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            uploadStatus === 'completed' || uploadStatus === 'active'
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {uploadStatus === 'completed' ? <Check className="w-5 h-5 stroke-[3]" /> : '1'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            uploadStatus === 'active' ? 'text-primary' : 'text-slate-400'
          }`}>Upload</span>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            readingStatus === 'completed' 
              ? 'bg-primary text-white border-primary'
              : readingStatus === 'active'
              ? 'bg-primary text-white border-primary animate-pulse'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {readingStatus === 'completed' ? <Check className="w-5 h-5 stroke-[3]" /> : '2'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            readingStatus === 'active' ? 'text-primary' : 'text-slate-400'
          }`}>Reading File</span>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            understandingStatus === 'completed'
              ? 'bg-primary text-white border-primary'
              : understandingStatus === 'active'
              ? 'bg-primary text-white border-primary animate-pulse'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            {understandingStatus === 'completed' ? <Check className="w-5 h-5 stroke-[3]" /> : '3'}
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            understandingStatus === 'active' ? 'text-primary' : 'text-slate-400'
          }`}>Understanding Report</span>
        </div>

        {/* Step 4 */}
        <div className="flex flex-col items-center space-y-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border font-bold ${
            resultsStatus === 'completed' || resultsStatus === 'active'
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-900 border-slate-200 text-slate-300'
          }`}>
            4
          </div>
          <span className={`text-[10px] md:text-xs font-bold ${
            resultsStatus === 'active' ? 'text-primary' : 'text-slate-400'
          }`}>Results Ready</span>
        </div>
      </div>

      {/* Center Icon Card */}
      <div className="relative flex items-center justify-center w-48 h-48">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl scale-125 animate-pulse"></div>
        <div className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl flex items-center justify-center border-primary/20 relative">
          <FileText className="w-10 h-10 text-primary animate-pulse" />
          <div className="absolute inset-x-2 top-0 h-0.5 bg-primary shadow-md shadow-primary/50 animate-scan"></div>
        </div>
      </div>

      {/* Headline & Description */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl md:text-4xl font-black text-foreground font-serif tracking-tight">
          {currentStep === 'reading' ? 'Reading your document...' :
           currentStep === 'understanding' ? 'Understanding medical terms...' :
           currentStep === 'saving' ? 'Saving your results...' :
           'Analyzing your document...'}
        </h1>
        
        <p className="text-slate-500 text-sm font-semibold max-w-md mx-auto leading-relaxed">
          This usually takes 3-5 seconds. Please don't close this tab while we translate complex medical terms into plain English.
        </p>
      </div>

    </div>
  )
}
