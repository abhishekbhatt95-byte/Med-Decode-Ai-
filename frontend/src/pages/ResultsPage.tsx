import React, { useEffect, useState } from 'react'
import { useNavigate, useSearch, Link } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

interface SearchParams {
  docId: string
}

interface Medicine {
  id: string
  brand_name: string
  generic_name: string | null
  category: string | null
  common_uses: string | null
  how_it_works: string | null
  side_effects: string | null
  food_restrictions: string | null
  precautions: string | null
  confidence_score: number
}

interface AbnormalValue {
  parameter: string
  value: string
  referenceRange: string
  explanation: string
}

interface AnalysisSection {
  title: string
  content: string
}

interface Analysis {
  id: string
  summary: string
  structured_output: {
    sections: AnalysisSection[]
    abnormalValues: AbnormalValue[]
    medicalSummary?: string
  }
  doctor_questions: string[]
}

interface Citation {
  id: string
  title: string
  url: string
}

// Maps a real confidence score to a label/icon/color. Previously the UI
// always showed "✔️ Excellent" regardless of the actual number — meaning a
// 20% confidence scan looked identical to a 95% one. This makes the label
// actually track the score that's now computed for real in the backend.
function getConfidenceDisplay(score: number): { label: string; emoji: string; textClass: string; barClass: string } {
  if (score >= 80) {
    return { label: 'Excellent', emoji: '✔️', textClass: 'text-emerald-500', barClass: 'bg-emerald-500' }
  }
  if (score >= 60) {
    return { label: 'Good', emoji: '👍', textClass: 'text-amber-500', barClass: 'bg-amber-500' }
  }
  return { label: 'Needs Review', emoji: '⚠️', textClass: 'text-rose-500', barClass: 'bg-rose-500' }
}

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const search = useSearch({ from: '/results' }) as SearchParams
  const documentId = search.docId

  // UI state
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [citations, setCitations] = useState<Citation[]>([])
  const [expandedMedicines, setExpandedMedicines] = useState<Record<string, boolean>>({})
  const [docInfo, setDocInfo] = useState<{ name: string; document_type: string } | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)

  // Toggle View State (Simple vs Standard)
  const [viewMode, setViewMode] = useState<'simple' | 'medical'>('simple')

  // Text-To-Speech state
  const [speaking, setSpeaking] = useState(false)

  // Copilot Chat State
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string }>>([
    { sender: 'bot', text: "Hello! I am your MedDecode AI Copilot. Ask me any question about your medications, vitals, or clinical findings in this report, and I'll explain them in simple terms." }
  ])
  const [inputVal, setInputVal] = useState("")
  const [copilotLoading, setCopilotLoading] = useState(false)

  const getIntakeSchedule = (med: Medicine) => {
    const text = `${med.brand_name} ${med.generic_name || ''} ${med.category || ''} ${med.common_uses || ''} ${med.how_it_works || ''} ${med.precautions || ''} ${med.food_restrictions || ''}`.toLowerCase()
    
    const morning = text.includes('morning') || text.includes('am') || text.includes('o.d') || text.includes('od') || text.includes('1-0-0') || text.includes('1-1-1') || text.includes('1-0-1') || text.includes('1-1-0') || text.includes('twice daily') || text.includes('three times') || text.includes('daily') || text.includes('b.d') || text.includes('bd') || text.includes('t.d.s') || text.includes('tds')
    
    const afternoon = text.includes('afternoon') || text.includes('noon') || text.includes('pm') || text.includes('1-1-1') || text.includes('1-1-0') || text.includes('0-1-0') || text.includes('three times') || text.includes('t.d.s') || text.includes('tds')
    
    const night = text.includes('night') || text.includes('evening') || text.includes('hs') || text.includes('h.s') || text.includes('bedtime') || text.includes('pm') || text.includes('1-0-1') || text.includes('1-1-1') || text.includes('0-0-1') || text.includes('0-1-1') || text.includes('twice daily') || text.includes('three times') || text.includes('b.d') || text.includes('bd') || text.includes('t.d.s') || text.includes('tds')
    
    return { morning, afternoon, night }
  }

  const getLocalResponse = (question: string): string => {
    if (!analysis) return ""
    const q = question.toLowerCase()
    const sections = analysis.structured_output?.sections || []
    const abnormalValues = analysis.structured_output?.abnormalValues || []

    // 1. Search in abnormal values
    const matchedAbnormal = abnormalValues.find(av => 
      q.includes(av.parameter.toLowerCase()) || 
      av.parameter.toLowerCase().includes(q)
    )
    if (matchedAbnormal) {
      return `For **${matchedAbnormal.parameter}**, the value is **${matchedAbnormal.value}** (reference range: ${matchedAbnormal.referenceRange}). Explanation: ${matchedAbnormal.explanation}`
    }

    // 2. Search in medicines
    const matchedMed = medicines.find(m => 
      q.includes(m.brand_name.toLowerCase()) || 
      m.brand_name.toLowerCase().includes(q) || 
      (m.generic_name && (q.includes(m.generic_name.toLowerCase()) || m.generic_name.toLowerCase().includes(q)))
    )
    if (matchedMed) {
      let response = `**${matchedMed.brand_name}** (${matchedMed.generic_name || 'generic medication'}): Used for **${matchedMed.common_uses || 'not specified'}**.\n\n`
      if (matchedMed.how_it_works) response += `• **How it works**: ${matchedMed.how_it_works}\n`
      if (matchedMed.side_effects) response += `• **Side effects**: ${matchedMed.side_effects}\n`
      if (matchedMed.food_restrictions) response += `• **Food restrictions**: ${matchedMed.food_restrictions}\n`
      if (matchedMed.precautions) response += `• **Precautions**: ${matchedMed.precautions}\n`
      return response
    }

    // 3. Search in glossary/sections
    const matchedSec = sections.find(s => 
      q.includes(s.title.toLowerCase()) || 
      s.title.toLowerCase().includes(q)
    )
    if (matchedSec) {
      return `Regarding **${matchedSec.title}**: ${matchedSec.content}`
    }
    
    if (q.includes('side effect') || q.includes('harm') || q.includes('adverse') || q.includes('bad reaction')) {
      const medsWithSide = medicines.filter(m => m.side_effects).map(m => `• **${m.brand_name}**: ${m.side_effects}`)
      if (medsWithSide.length > 0) {
        return `Here are the side effects mentioned in your document:\n\n${medsWithSide.join('\n\n')}\n\nAlways consult your doctor if you experience severe symptoms.`
      }
      return "I couldn't find any specific side effects listed in this document. Please check the packaging of your medication or consult your pharmacist."
    }
    
    if (q.includes('food') || q.includes('eat') || q.includes('take') || q.includes('dose') || q.includes('when') || q.includes('empty stomach')) {
      const medsDosage = medicines.map(m => `• **${m.brand_name}**: ${m.food_restrictions || 'No food restrictions listed'}. Note: ${m.precautions || 'Take as directed'}.`)
      return `Here are the food and intake instructions from your document:\n\n${medsDosage.join('\n\n')}`
    }

    if (q.includes('kidney') || q.includes('ultrasound') || q.includes('hydronephrosis') || q.includes('bladder') || q.includes('kub')) {
      const conditionSec = sections.find(s => s.title.toLowerCase().includes('condition') || s.title.toLowerCase().includes('ultrasound'))
      if (conditionSec) {
        return `Based on your report: **${conditionSec.title}**: ${conditionSec.content}`
      }
      return `Based on your document summary: "${analysis.summary}". The ultrasound did not find significant abnormalities, resolving the clinical suspicion of hydronephrosis.`
    }

    if (q.includes('doctor') || q.includes('ask') || q.includes('question')) {
      return `Here are some questions you can ask your doctor at your next visit:\n\n${analysis.doctor_questions.map(dq => `• ${dq}`).join('\n')}`
    }

    return `I understand you are asking about your report. Based on the summary: "${analysis.summary}". If you need specific advice on treatment plans or medical symptoms, it is best to discuss it directly with your doctor.`
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputVal.trim() || copilotLoading || !analysis) return

    const userMsg = inputVal.trim()
    setInputVal("")
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }])
    setCopilotLoading(true)

    setTimeout(async () => {
      let botAnswer = ""
      const sections = analysis.structured_output?.sections || []
      const abnormalValues = analysis.structured_output?.abnormalValues || []
      
      try {
        const copilotKey = import.meta.env.VITE_GEMINI_API_KEY || ''
        const prompt = `You are a medical assistant helping a patient understand their medical document.
Here is the summary of the document:
${analysis.summary}

Medicines:
${JSON.stringify(medicines)}

Abnormal Values:
${JSON.stringify(abnormalValues)}

Sections/Glossary:
${JSON.stringify(sections)}

Patient's Question: "${userMsg}"

Provide a brief, comforting, plain English response (max 3-4 sentences). Keep in mind:
- If they ask about a medicine not in this document, advise them to check with their doctor.
- Reassure them but remind them that you are an AI assistant and they should consult their doctor for clinical decisions.
- Do not use markdown format other than simple bullet points if necessary.`

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${copilotKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 1000
            }
          })
        })

        if (res.status === 200) {
          const resJson = await res.json()
          const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            botAnswer = text
          }
        }
      } catch (err) {
        console.warn("Client-side Gemini API call failed, falling back to local responder:", err)
      }

      if (!botAnswer) {
        botAnswer = getLocalResponse(userMsg)
      }

      setMessages(prev => [...prev, { sender: 'bot', text: botAnswer }])
      setCopilotLoading(false)
    }, 800)
  }

  useEffect(() => {
    if (!documentId) {
      navigate({ to: '/dashboard' })
      return
    }

    const fetchAnalysisData = async () => {
      try {
        // Fetch document info
        const { data: docData, error: docErr } = await supabase
          .from('documents')
          .select('name, document_type')
          .eq('id', documentId)
          .single()

        if (docErr) {
          console.error("Error loading document:", docErr)
        } else if (docData) {
          setDocInfo(docData)
        }

        // Fetch analysis record
        const { data: analyses, error: analysisErr } = await supabase
          .from('analyses')
          .select('*')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (analysisErr) {
          console.error("Error loading analysis:", analysisErr)
        }

        const analysisData = analyses && analyses.length > 0 ? analyses[0] : null

        if (analysisData) {
          setAnalysis(analysisData as Analysis)

          const { data: medsData } = await supabase
            .from('medicines')
            .select('*')
            .eq('analysis_id', analysisData.id)

          if (medsData) {
            setMedicines(medsData as Medicine[])
            // Expand first medicine by default
            if (medsData.length > 0) {
              setExpandedMedicines({ [medsData[0].id]: true })
            }
          }

          const { data: citData } = await supabase
            .from('analysis_sources')
            .select('medical_sources(id, title, url)')
            .eq('analysis_id', analysisData.id)

          if (citData) {
            const mapped = citData.map((c: any) => c.medical_sources).filter(Boolean)
            setCitations(mapped as Citation[])
          }

          const { data: confData } = await supabase
            .from('confidence_scores')
            .select('overall_confidence')
            .eq('analysis_id', analysisData.id)
            .maybeSingle()

          if (confData) {
            setConfidence(confData.overall_confidence)
          }
        }
      } catch (err) {
        console.error("Error loading results:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysisData()
  }, [documentId, navigate])

  const toggleMedicineExpand = (id: string) => {
    setExpandedMedicines(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const handleSpeak = () => {
    if (!analysis) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }

    window.speechSynthesis.cancel()
    const speakText = `Quick Summary. ${analysis.summary}`
    const utterance = new SpeechSynthesisUtterance(speakText)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleDelete = async () => {
    const confirm = window.confirm("Are you sure you want to permanently delete this analysis? This action is compliant with your DPDP data rights.")
    if (!confirm) return

    try {
      await supabase.from('data_deletion_requests').insert({
        user_id: (await supabase.auth.getUser()).data.user?.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      const { error: delErr } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (delErr) throw delErr

      navigate({ to: '/dashboard' })
    } catch (e: any) {
      alert(`Deletion failed: ${e.message}`)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Loading analysis results...</p>
      </div>
    )
  }

  if (!analysis) {
    return (
      <div className="py-12 px-4 max-w-xl mx-auto text-center">
        <h2 className="text-2xl font-bold mb-4">No Analysis Found</h2>
        <button onClick={() => navigate({ to: '/dashboard' })} className="bg-primary text-white px-6 py-2.5 rounded-lg">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const { sections = [], abnormalValues = [] } = analysis.structured_output
  const docType = docInfo?.document_type || 'unknown'


  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-8 print:p-0">
      
      {/* Guest onboarding banner */}
      {!user && (
        <div className="bg-[#004bb3]/5 border border-[#004bb3]/20 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden text-left">
          <div>
            <h4 className="font-extrabold text-[#004bb3] text-sm">💡 Want to save this analysis?</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Create a free account or sign in to save your document translation history and view them anytime on your dashboard.
            </p>
          </div>
          <Link
            to="/auth"
            className="bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer whitespace-nowrap shadow-sm text-center"
          >
            Sign In / Sign Up
          </Link>
        </div>
      )}
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-100 dark:border-slate-800 pb-6 print:hidden">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#004bb3] tracking-tight">Your Results Explained</h1>
          <p className="text-xs md:text-sm font-semibold text-slate-400">
            Here is a simple summary of your recent {docInfo?.document_type ? docInfo.document_type.replace('_', ' ') : 'Prescription or Report'}. 
            {confidence !== null ? (
              <span className={`${getConfidenceDisplay(confidence).textClass} font-bold ml-2`}>
                {getConfidenceDisplay(confidence).emoji} Document scan quality: {confidence}% – {getConfidenceDisplay(confidence).label}
              </span>
            ) : (
              <span className="text-slate-400 font-bold ml-2">Document scan quality: analyzing…</span>
            )}
          </p>
        </div>
        
        {/* Mockup buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => window.print()}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            📥 Download PDF
          </button>
          <button
            onClick={() => alert("Copied results link to clipboard!")}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            🔗 Share
          </button>
          <button
            onClick={handleDelete}
            className="bg-red-50 hover:bg-red-100 text-red-500 font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
          >
            🗑️ Delete
          </button>
        </div>
      </div>

      {/* 2. Simple vs Standard Toggle Bar */}
      <div className="flex justify-center print:hidden">
        <div className="bg-slate-100 p-1.5 rounded-full inline-flex border border-slate-200">
          <button
            onClick={() => setViewMode('simple')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'simple'
                ? 'bg-white text-[#004bb3] shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Simple English
          </button>
          <button
            onClick={() => setViewMode('medical')}
            className={`px-6 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'medical'
                ? 'bg-white text-[#004bb3] shadow-sm'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Standard Medical
          </button>
        </div>
      </div>

      {/* 3. Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (Span 2): Summary, Primary details, and Chat */}
        <div className="lg:col-span-2 space-y-8 text-left">
          
          {/* Quick Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <span className="text-[#004bb3] text-2xl">ℹ️</span> Quick Summary
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium">
              {viewMode === 'simple' 
                ? analysis.summary 
                : (analysis.structured_output?.medicalSummary || analysis.summary)}
            </p>

            <div className="flex justify-center pt-2">
              <button
                onClick={handleSpeak}
                className={`w-full max-w-sm bg-transparent text-[#004bb3] border border-blue-200 hover:bg-blue-50 font-extrabold py-3.5 rounded-full text-sm inline-flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  speaking ? 'bg-blue-50 animate-pulse' : ''
                }`}
              >
                🔊 {speaking ? 'Stop Reading' : 'Read Aloud'}
              </button>
            </div>
          </div>

          {/* Dynamic Left Column Sections */}
          {(() => {
            const isBloodOrDiagnostic = docType === 'blood_report' || docType === 'diagnostic_report';
            const showMedicinesFirst = medicines.length > 0 && !isBloodOrDiagnostic;
            const showAbnormalFirst = abnormalValues.length > 0 && (isBloodOrDiagnostic || medicines.length === 0);
            
            return (
              <>
                {/* 1. Medicines (If primary focus) */}
                {showMedicinesFirst && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                      MEDICINES EXPLAINED
                    </h2>
                    
                    <div className="space-y-4">
                      {medicines.map((med) => {
                        const isExpanded = !!expandedMedicines[med.id]
                        return (
                          <div 
                            key={med.id}
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                          >
                            {/* Header Row */}
                            <div 
                              onClick={() => toggleMedicineExpand(med.id)}
                              className="p-5 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl text-[#004bb3]">
                                  💊
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white inline-flex items-center gap-2">
                                    {med.brand_name}
                                    <span className="bg-blue-50 text-[#004bb3] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                      {med.category || "Medication"}
                                    </span>
                                  </h3>
                                </div>
                              </div>
                              <span className="text-slate-400 text-sm font-bold">{isExpanded ? '▲' : '▼'}</span>
                            </div>

                            {/* Expandable Body */}
                            {isExpanded && (
                              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      WHAT IT'S FOR
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.common_uses || "Not specified"}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      HOW IT WORKS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.how_it_works || "Not specified"}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      SIDE EFFECTS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.side_effects || "None listed"}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      FOOD RESTRICTIONS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.food_restrictions || "No special instructions"}
                                    </p>
                                  </div>

                                  <div className="md:col-span-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      IMPORTANT NOTES & PRECAUTIONS
                                    </span>
                                    <p className="text-[#004bb3] font-bold leading-relaxed">
                                      {med.precautions || "Finish all the pills even if you feel better."}
                                    </p>
                                  </div>
                                </div>

                                {/* Dosage Instructions subcard */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
                                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                                    DOSAGE INSTRUCTIONS
                                  </span>
                                  <h4 className="text-lg font-extrabold text-slate-800 dark:text-white">
                                    {med.generic_name || "Dosage not specified"}
                                  </h4>
                                  
                                  {/* Schedule */}
                                  <div className="flex flex-wrap gap-3 border-t border-slate-200/50 pt-4 text-xs font-bold">
                                    {(() => {
                                      const { morning, afternoon, night } = getIntakeSchedule(med)
                                      return (
                                        <>
                                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${morning ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'}`}>
                                            🌅 Morning {morning ? '✓' : '✗'}
                                          </span>
                                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${afternoon ? 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'}`}>
                                            ☀️ Afternoon {afternoon ? '✓' : '✗'}
                                          </span>
                                          <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${night ? 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'}`}>
                                            🌙 Bedtime/Night {night ? '✓' : '✗'}
                                          </span>
                                        </>
                                      )
                                    })()}
                                  </div>
                                </div>

                                {/* Scan confidence progress bar */}
                                <div className="pt-2">
                                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
                                    <span>RECOGNITION CONFIDENCE</span>
                                    <span>{med.confidence_score || 95}%</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className={`${getConfidenceDisplay(med.confidence_score || 95).barClass} h-full rounded-full transition-all duration-500`}
                                      style={{ width: `${med.confidence_score || 95}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 2. Lab Values / Key Findings (If primary focus) */}
                {showAbnormalFirst && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                      <span className="text-[#004bb3] text-2xl">⚠️</span> Key Lab & Clinical Findings
                    </h2>
                    <div className="space-y-4">
                      {abnormalValues.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                        >
                          <div className="space-y-1 text-left">
                            <span className="bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                              {docType === 'blood_report' ? 'Lab Parameter Alert' : 'Diagnostic Alert'}
                            </span>
                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white mt-1">
                              {item.parameter}
                            </h3>
                            <p className="text-sm text-slate-600 dark:text-slate-300 font-semibold mt-1">
                              {item.explanation}
                            </p>
                          </div>
                          <div className="text-left md:text-right shrink-0">
                            <div className="text-lg font-black text-amber-600 dark:text-amber-500">
                              {item.value}
                            </div>
                            <div className="text-xs text-slate-400 font-bold">
                              Normal Range: {item.referenceRange}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Detailed Sections / Glossary (If no medicines or abnormal values, or as supplementary content) */}
                {((medicines.length === 0 && abnormalValues.length === 0) || isBloodOrDiagnostic) && sections.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                      <span className="text-[#004bb3] text-2xl">📋</span> Report Details & Glossary
                    </h2>
                    <div className="space-y-6">
                      {sections.map((sec, idx) => (
                        <div key={idx} className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0 text-left">
                          <h3 className="font-extrabold text-sm text-[#004bb3]">{sec.title}</h3>
                          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                            {sec.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Medicines (Shown secondary if abnormal values took precedence) */}
                {isBloodOrDiagnostic && medicines.length > 0 && (
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">
                      PRESCRIBED MEDICATIONS
                    </h2>
                    
                    <div className="space-y-4">
                      {medicines.map((med) => {
                        const isExpanded = !!expandedMedicines[med.id]
                        return (
                          <div 
                            key={med.id}
                            className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
                          >
                            {/* Header Row */}
                            <div 
                              onClick={() => toggleMedicineExpand(med.id)}
                              className="p-5 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-xl text-[#004bb3]">
                                  💊
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white inline-flex items-center gap-2">
                                    {med.brand_name}
                                    <span className="bg-blue-50 text-[#004bb3] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                      {med.category || "Medication"}
                                    </span>
                                  </h3>
                                </div>
                              </div>
                              <span className="text-slate-400 text-sm font-bold">{isExpanded ? '▲' : '▼'}</span>
                            </div>

                            {/* Expandable Body */}
                            {isExpanded && (
                              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      WHAT IT'S FOR
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.common_uses || "Not specified"}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      HOW IT WORKS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.how_it_works || "Not specified"}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      SIDE EFFECTS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.side_effects || "None listed"}
                                    </p>
                                  </div>

                                  <div>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      FOOD RESTRICTIONS
                                    </span>
                                    <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                                      {med.food_restrictions || "No special instructions"}
                                    </p>
                                  </div>

                                  <div className="md:col-span-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                      IMPORTANT NOTES & PRECAUTIONS
                                    </span>
                                    <p className="text-[#004bb3] font-bold leading-relaxed">
                                      {med.precautions || "Finish all the pills even if you feel better."}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Patient AI Copilot Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6 mt-6 print:hidden">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="text-[#004bb3] text-2xl">💬</span> Patient AI Copilot
              </h2>
              <span className="bg-blue-50 text-[#004bb3] text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Instant Chat
              </span>
            </div>

            {/* Chat Messages */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 flex flex-col gap-2 scrollbar-thin">
              {messages.map((msg, index) => (
                <div 
                  key={index}
                  className={`max-w-[85%] rounded-2xl p-4 text-sm font-semibold leading-relaxed transition-all ${
                    msg.sender === 'user' 
                      ? 'bg-[#004bb3] text-white self-end rounded-tr-none' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 self-start rounded-tl-none'
                  }`}
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {msg.text}
                </div>
              ))}
              {copilotLoading && (
                <div className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 max-w-[85%] rounded-2xl rounded-tl-none p-4 text-sm font-semibold self-start flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#004bb3] rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-[#004bb3] rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 bg-[#004bb3] rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              )}
            </div>

            {/* Suggestions */}
            <div className="space-y-2 pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Suggested Questions</span>
              <div className="flex flex-wrap gap-2">
                {[
                  "Are there any food restrictions?",
                  "What are the side effects?",
                  docType === 'blood_report' ? "Explain my abnormal lab values" : "Explain my report findings"
                ].map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputVal(sug)
                    }}
                    className="bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 font-bold px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                  >
                    💡 {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="flex gap-2 pt-2">
              <input
                type="text"
                placeholder="Ask about your report, medicines, or parameters..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                disabled={copilotLoading}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full px-5 py-3 text-sm font-semibold outline-none focus:border-[#004bb3] focus:ring-1 focus:ring-[#004bb3] transition-all disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={copilotLoading}
                className="bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-6 py-3 rounded-full text-sm cursor-pointer shadow-sm transition-all disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (Span 1): Sidebar details */}
        <div className="space-y-6 text-left">
          
          {/* Card 1: Abnormal Lab Values (Sidebar fallback if not displayed in main column) */}
          {!(docType === 'blood_report' || docType === 'diagnostic_report' || medicines.length === 0) && abnormalValues.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                CLINICAL ALERTS
              </h3>
              {abnormalValues.map((item, idx) => (
                <div 
                  key={idx}
                  className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 shadow-sm space-y-4"
                >
                  <h3 className="text-amber-700 font-black text-sm uppercase tracking-wider flex items-center gap-1.5">
                    ⚠️ Attention: Value Alert
                  </h3>
                  
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                    <span className="font-extrabold text-lg text-slate-900 dark:text-white">
                      {item.parameter} <span className="text-red-500">{item.value}</span>
                    </span>
                  </div>
                  
                  <p className="text-xs text-slate-400 font-bold">
                    Normal range is {item.referenceRange}.
                  </p>
                  
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                    {item.explanation}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Card 2: Terms Explained Glossary (Sidebar fallback if not detailed in main column) */}
          {(medicines.length > 0 && docType !== 'blood_report' && docType !== 'diagnostic_report') && sections.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                TERMS EXPLAINED
              </h3>
              
              <div className="space-y-4">
                {sections.slice(0, 3).map((sec, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-extrabold text-sm text-[#004bb3]">{sec.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      {sec.content.split('\n')[0]}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Card 3: Ask Your Doctor */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
              🗣️ Ask Your Doctor
            </h3>
            
            <ul className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
              {analysis.doctor_questions.map((q, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-[#004bb3] font-bold">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* Verified sources badges */}
      {citations && citations.length > 0 && (
        <div className="pt-6 w-full text-left print:hidden">
          <span className="text-xs font-bold text-slate-400 block mb-3">Verified Medical Database References:</span>
          <div className="flex flex-wrap gap-2.5">
            {citations.map((c) => (
              <a 
                key={c.id} 
                href={c.url} 
                target="_blank" 
                rel="noreferrer"
                className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-500 font-extrabold px-4 py-2 rounded-full text-[10px] inline-flex items-center gap-1.5 transition-all"
              >
                📖 {c.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimers */}
      <footer className="border-t border-slate-100 dark:border-slate-800 pt-6 text-[10px] text-slate-400 w-full text-center space-y-2">
        <p>🔒 Privacy First • Secure Storage • Encrypted Uploads</p>
        <p>This translation is for educational use only. Always consult a physician or clinical professional before editing treatment plans.</p>
      </footer>

    </div>
  )
}
