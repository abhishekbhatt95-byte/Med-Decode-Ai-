/**
 * Results page — shell / orchestrator.
 *
 * Responsibilities:
 *  • Data fetching (document, analysis, medicines, citations, confidence, conversations, messages)
 *  • All lifted state (chat, voice, conversation management)
 *  • Handlers that touch Supabase or Edge Functions
 *  • Composing sub-components; no raw JSX beyond the layout grid
 */
import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { supabase } from '../../utils/supabase'
import { invokeCopilot } from '../../services/copilot'
import { invokeAnalyzeDocument } from '../../services/analyzeDocument'
import { useAuth } from '../../context/AuthContext'
import { useVoiceInput } from '../../hooks/useVoiceInput'
import { useGeminiLive, type LiveVoiceMode } from '../../hooks/useGeminiLive'
import { toast } from '../../hooks/useToast'
import { useOffline } from '../../hooks/useOffline'
import { withRetry } from '../../utils/retry'
import { useAccessibility } from '../../context/AccessibilityContext'
import { SkeletonResults } from '../../components/Skeleton'

import { SummaryCard } from './components/SummaryCard'
import { OriginalDocViewer } from './components/OriginalDocViewer'
import { MedicineTable } from './components/MedicineTable'
import { ClinicalAlerts } from './components/ClinicalAlerts'
import { CitationsList } from './components/CitationsList'
import { ChatPanel } from './components/ChatPanel'
import { AudioVoiceOverlay } from './components/AudioVoiceOverlay'
import { BillAuditorView } from './components/BillAuditorView'

// ── Shared types (inlined here; consumed by sub-components via their own import of utils) ──
interface SearchParams { docId: string }

interface Medicine {
  id: string; brand_name: string; generic_name: string | null; category: string | null
  common_uses: string | null; how_it_works: string | null; side_effects: string | null
  food_restrictions: string | null; precautions: string | null; confidence_score: number
}

interface AbnormalValue { parameter: string; value: string; referenceRange: string; explanation: string }

interface AnalysisSection { title: string; content: string }

interface BillItem { description: string; amount: string }

interface Analysis {
  id: string; summary: string
  structured_output: {
    sections: AnalysisSection[]
    abnormalValues: AbnormalValue[]
    medicalSummary?: string
    outputLanguage?: 'english' | 'hindi'
    billItems?: BillItem[]
    billTotal?: string | null
  }
  doctor_questions: string[]
  document_id?: string
}

interface Citation { id: string; title: string; url: string }

// ── Page shell ──
export const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAnonymous } = useAuth()
  const search = useSearch({ from: '/results' }) as SearchParams
  const documentId = search.docId

  const { darkMode, setDarkMode } = useAccessibility()
  const [textSize, setTextSize] = useState<'small' | 'base' | 'large' | 'xlarge'>('base')

  const getTextSizeClass = () => {
    if (textSize === 'small') return 'text-[13px] leading-relaxed'
    if (textSize === 'large') return 'text-[17px] leading-relaxed'
    if (textSize === 'xlarge') return 'text-[19px] leading-relaxed'
    return 'text-[15px] leading-relaxed'
  }

  // ── Core data ──
  const [loading, setLoading] = useState(true)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [citations, setCitations] = useState<Citation[]>([])
  const [expandedMedicines, setExpandedMedicines] = useState<Record<string, boolean>>({})
  const [docInfo, setDocInfo] = useState<{ name: string; document_type: string; created_at?: string } | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)

  // ── Original document viewer ──
  const [showOriginal, setShowOriginal] = useState(false)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [originalLoading, setOriginalLoading] = useState(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [isPdf, setIsPdf] = useState(false)

  // ── Summary card display ──
  const [viewMode, setViewMode] = useState<'simple' | 'medical' | 'bill_auditor'>('simple')
  const [speaking, setSpeaking] = useState(false)
  const [speakingText, setSpeakingText] = useState<string | null>(null)

  // ── Voice input (STT) ──
  const { isListening, transcript, startListening, stopListening, isSupported: isVoiceSupported } = useVoiceInput()
  const [showVoiceConsent, setShowVoiceConsent] = useState(() =>
    localStorage.getItem('meddecode-voice-consent') !== 'accepted'
  )

  // ── Conversation sidebar state ──
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [activeConvTitle, setActiveConvTitle] = useState('New Conversation')
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'document' | 'model' | 'persona'>('recent')
  const [showArchived, setShowArchived] = useState(false)
  const [conversationsPage, setConversationsPage] = useState(0)
  const [hasMoreConversations, setHasMoreConversations] = useState(true)
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showExportMenu, setShowExportMenu] = useState(false)

  // ── Chat state ──
  const [modelKey, setModelKey] = useState<string>(() => localStorage.getItem('meddecode-selected-model') || 'standard')
  const [roleKey, setRoleKey] = useState<string>(() => localStorage.getItem('meddecode-selected-persona') || 'default_clinical')
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'bot'; text: string; modelUsed?: string; created_at?: string }>>([])
  const [inputVal, setInputVal] = useState('')
  const [copilotLoading, setCopilotLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')

  // ── Share state ──
  const [shareLoading, setShareLoading] = useState(false)
  const [shareSuccess, setShareSuccess] = useState(false)

  // ── Live voice / translate ──
  const [showLiveVoice, setShowLiveVoice] = useState(false)
  const [liveMode, setLiveMode] = useState<LiveVoiceMode>('voice')
  // Default targetLanguage mirrors the document's outputLanguage once loaded
  const [targetLanguageCode, setTargetLanguageCode] = useState<string>('en')

  const {
    status: liveStatus,
    error: liveError,
    isMuted: liveMuted,
    microphoneAnalyser: liveMicAnalyser,
    playbackAnalyser: livePlayAnalyser,
    translatedText: liveTranslatedText,
    startSession: startLiveSession,
    endSession: endLiveSession,
    muteMic: toggleLiveMute,
  } = useGeminiLive(analysis?.id || '', modelKey, liveMode, targetLanguageCode)

  const { isOffline } = useOffline()

  // ── Refs ──
  const chatEndRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const fetchAbortRef = useRef<AbortController | null>(null)
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); searchInputRef.current?.focus() }
      if (e.key === 'n' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); handleStartNewChat() }
      if (e.key === 'Escape') { setShowLiveVoice(false); setShowExportMenu(false); setIsEditingTitle(false) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { if (document.activeElement === inputRef.current) handleSendMessage() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, activeConvId, roleKey])

  // Append transcript to chat input
  useEffect(() => { if (transcript) setInputVal(prev => prev + (prev ? ' ' : '') + transcript) }, [transcript])

  // Auto-scroll chat
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, copilotLoading, streamingText])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null }
      if (fetchAbortRef.current) { fetchAbortRef.current.abort(); fetchAbortRef.current = null }
      window.speechSynthesis?.cancel()
    }
  }, [])

  // ──────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────

  const streamText = (text: string, callback: () => void) => {
    if (streamIntervalRef.current) clearInterval(streamIntervalRef.current)
    let index = 0
    setStreamingText('')
    const words = text.split(' ')
    streamIntervalRef.current = setInterval(() => {
      if (index < words.length) {
        setStreamingText(prev => prev + (prev ? ' ' : '') + words[index])
        index++
      } else {
        if (streamIntervalRef.current) { clearInterval(streamIntervalRef.current); streamIntervalRef.current = null }
        callback()
      }
    }, 30)
  }

  const handleSpeakText = (text: string) => {
    if (speakingText === text) { window.speechSynthesis.cancel(); setSpeakingText(null); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.onend = () => setSpeakingText(null)
    utterance.onerror = () => setSpeakingText(null)
    setSpeakingText(text)
    window.speechSynthesis.speak(utterance)
  }

  const handleMicClick = () => {
    if (!isVoiceSupported || showVoiceConsent) return
    isListening ? stopListening() : startListening()
  }

  const acceptVoiceConsent = () => { localStorage.setItem('meddecode-voice-consent', 'accepted'); setShowVoiceConsent(false); startListening() }

  const handleCopyText = (text: string) => navigator.clipboard.writeText(text)

  const handleSpeak = () => {
    if (!analysis) return
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(`Quick Summary. ${analysis.summary}`)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const handleModelChange = (model: string) => { setModelKey(model); localStorage.setItem('meddecode-selected-model', model) }
  const handlePersonaChange = (persona: string) => { setRoleKey(persona); localStorage.setItem('meddecode-selected-persona', persona) }

  const toggleMedicineExpand = (id: string) => setExpandedMedicines(prev => ({ ...prev, [id]: !prev[id] }))

  // ──────────────────────────────────────────────
  // Data fetching
  // ──────────────────────────────────────────────

  const selectLatestConversationForAnalysis = async (analysisId: string) => {
    const { data, error } = await supabase
      .from('chat_conversations')
      .select('id, title, role_persona')
      .eq('analysis_id', analysisId)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (!error && data && data.length > 0) {
      setActiveConvId(data[0].id)
      setActiveConvTitle(data[0].title)
      setRoleKey(data[0].role_persona || 'default_clinical')
    } else {
      setActiveConvId(null)
      setMessages([])
    }
  }

  const loadMessages = async (convId: string, signal?: AbortSignal) => {
    if (convId.startsWith('temp-')) return
    setCopilotLoading(true)
    try {
      const dbMsgs = await withRetry(async () => {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('role, content, model_used, status, created_at')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
        if (error) throw error
        return data
      }, { maxAttempts: 2, signal })
      if (signal?.aborted) return
      if (dbMsgs) {
        setMessages(dbMsgs.map(m => ({
          sender: m.role === 'user' ? 'user' as const : 'bot' as const,
          text: m.content,
          modelUsed: m.model_used || undefined,
          status: m.status,
          created_at: m.created_at,
        })))
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) return
      console.error('Failed to load messages:', err)
      toast.error('Failed to load messages. Please check your network connection.')
    } finally {
      if (!signal?.aborted) setCopilotLoading(false)
    }
  }

  useEffect(() => {
    if (activeConvId) {
      const controller = new AbortController()
      loadMessages(activeConvId, controller.signal)
      const currentConv = conversations.find(c => c.id === activeConvId)
      if (currentConv) { setActiveConvTitle(currentConv.title); setTitleInput(currentConv.title) }
      return () => controller.abort()
    } else {
      setMessages([])
    }
  }, [activeConvId])

  const loadConversations = async (page = 0, append = false, signal?: AbortSignal) => {
    if (!user) return
    setConversationsLoading(true)
    const limit = 10
    const offset = page * limit
    try {
      let query = supabase
        .from('chat_conversations')
        .select(`id, title, role_persona, updated_at, created_at, pinned, archived, analysis_id,
          analyses (id, document_id, documents (id, name))`)
        .eq('user_id', user.id)
      if (searchQuery.trim()) query = query.ilike('title', `%${searchQuery.trim()}%`)

      const result = await withRetry(async () => {
        const { data, error } = await query
          .eq('archived', showArchived)
          .order('pinned', { ascending: false })
          .order('updated_at', { ascending: false })
          .range(offset, offset + limit - 1)
        if (error) throw error
        return data
      }, { maxAttempts: 2, signal })
      if (signal?.aborted) return

      const convs: any[] = result || []
      const hasMore = convs.length === limit
      const convIds = convs.filter(c => !c.id.startsWith('temp-')).map(c => c.id)
      let lastMsgMap: Record<string, { content: string; created_at: string; model_used?: string }> = {}

      if (convIds.length > 0) {
        const msgs = await withRetry(async () => {
          const { data, error } = await supabase
            .from('chat_messages')
            .select('conversation_id, content, created_at, model_used')
            .in('conversation_id', convIds)
            .order('created_at', { ascending: false })
          if (error) throw error
          return data
        }, { maxAttempts: 2, signal })
        if (signal?.aborted) return
        if (msgs) msgs.forEach(m => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = { content: m.content, created_at: m.created_at, model_used: m.model_used || undefined } })
      }

      const mappedConvs = convs.map(c => {
        const lastMsg = lastMsgMap[c.id]
        const docName = (c.analyses as any)?.documents?.name || 'General Report'
        return { ...c, docName, lastMessage: lastMsg?.content || '', lastMessageTime: lastMsg?.created_at || '', lastMessageModel: lastMsg?.model_used || '' }
      })

      let sortedConvs = mappedConvs
      if (sortBy === 'recent') sortedConvs = [...mappedConvs].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime() })
      else if (sortBy === 'oldest') sortedConvs = [...mappedConvs].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime() })
      else if (sortBy === 'persona') sortedConvs = [...mappedConvs].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; return (a.role_persona || '').localeCompare(b.role_persona || '') })
      else if (sortBy === 'document') sortedConvs = [...mappedConvs].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; return a.docName.localeCompare(b.docName) })
      else if (sortBy === 'model') sortedConvs = [...mappedConvs].sort((a, b) => { if (a.pinned !== b.pinned) return a.pinned ? -1 : 1; return (a.lastMessageModel || '').localeCompare(b.lastMessageModel || '') })

      if (append) {
        setConversations(prev => { const ids = new Set(prev.map(p => p.id)); return [...prev, ...sortedConvs.filter(f => !ids.has(f.id))] })
      } else {
        setConversations(sortedConvs)
      }
      setHasMoreConversations(hasMore)
      setConversationsPage(page)
    } catch (err: any) {
      if (err.name === 'AbortError' || signal?.aborted) return
      console.error('Failed to load conversations:', err)
      toast.error('Failed to load chat history. Retrying in background...')
    } finally {
      if (!signal?.aborted) setConversationsLoading(false)
    }
  }

  useEffect(() => {
    if (!user) return
    const controller = new AbortController()
    loadConversations(0, false, controller.signal)
    return () => controller.abort()
  }, [searchQuery, sortBy, showArchived, user])

  // Sync targetLanguageCode default to document's outputLanguage
  useEffect(() => {
    if (!analysis) return
    const lang = analysis.structured_output?.outputLanguage
    if (lang === 'hindi') setTargetLanguageCode('hi')
    else if (lang === 'english') setTargetLanguageCode('en')
  }, [analysis])
  useEffect(() => {
    if (!documentId) { navigate({ to: '/dashboard' }); return }
    const fetchAnalysisData = async () => {
      // Main data fetch
      try {
        const { data: docData, error: docErr } = await supabase.from('documents').select('name, document_type, file_path, mime_type').eq('id', documentId).single()
        if (docErr) console.error('Error loading document:', docErr)
        else if (docData) {
          setDocInfo(docData)
          if (docData?.file_path) { setFilePath(docData.file_path); setIsPdf(docData.mime_type === 'application/pdf' || docData.file_path?.endsWith('.pdf')) }
        }
        const { data: analyses, error: analysisErr } = await supabase.from('analyses').select('*').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1)
        if (analysisErr) console.error('Error loading analysis:', analysisErr)
        const analysisData = analyses && analyses.length > 0 ? analyses[0] : null
        if (analysisData) {
          setAnalysis(analysisData as Analysis)
          selectLatestConversationForAnalysis(analysisData.id)
          const { data: medsData } = await supabase.from('medicines').select('*').eq('analysis_id', analysisData.id)
          if (medsData) { setMedicines(medsData as Medicine[]); if (medsData.length > 0) setExpandedMedicines({ [medsData[0].id]: true }) }
          const { data: citData } = await supabase.from('analysis_sources').select('medical_sources(id, title, url)').eq('analysis_id', analysisData.id)
          if (citData) setCitations(citData.map((c: any) => c.medical_sources).filter(Boolean) as Citation[])
          const { data: confData } = await supabase.from('confidence_scores').select('overall_confidence').eq('analysis_id', analysisData.id).maybeSingle()
          if (confData) setConfidence(confData.overall_confidence)
        }
      } catch (err) {
        console.error('Error loading results:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysisData()
  }, [documentId, navigate])

  // ──────────────────────────────────────────────
  // Conversation mutation handlers
  // ──────────────────────────────────────────────

  const handleStartNewChat = async () => {
    if (!user) return
    const tempId = `temp-${Date.now()}`
    const placeholderConv = { id: tempId, title: 'Starting new chat...', role_persona: roleKey, updated_at: new Date().toISOString(), created_at: new Date().toISOString(), pinned: false, archived: false, docName: docInfo?.name || 'General Report', lastMessage: '', lastMessageTime: '', lastMessageModel: '' }
    setConversations(prev => [placeholderConv, ...prev])
    setActiveConvId(tempId)
    setActiveConvTitle('New Conversation')
    setMessages([])
    try {
      const { data: newConv, error } = await supabase.from('chat_conversations').insert({ user_id: user.id, analysis_id: analysis?.id || null, role_persona: roleKey, title: 'New Conversation' }).select('id, title, role_persona').single()
      if (error) throw error
      if (newConv) {
        setConversations(prev => prev.map(c => (c.id === tempId ? { ...c, id: newConv.id, title: newConv.title } : c)))
        setActiveConvId(newConv.id)
        setActiveConvTitle(newConv.title)
        setRoleKey(newConv.role_persona || 'default_clinical')
      }
    } catch (err: any) {
      setConversations(prev => prev.filter(c => c.id !== tempId))
      setActiveConvId(null)
      toast.error(`Failed to start a new chat: ${err.message || 'Unknown error'}`)
    }
  }

  const handleRenameConversation = async () => {
    if (!activeConvId || !titleInput.trim()) return
    const oldTitle = activeConvTitle; const newTitle = titleInput.trim()
    setActiveConvTitle(newTitle); setIsEditingTitle(false)
    setConversations(prev => prev.map(c => (c.id === activeConvId ? { ...c, title: newTitle } : c)))
    try {
      const { error } = await supabase.from('chat_conversations').update({ title: newTitle }).eq('id', activeConvId)
      if (error) throw error
      toast.success('Conversation renamed successfully')
    } catch (err: any) {
      setActiveConvTitle(oldTitle)
      setConversations(prev => prev.map(c => (c.id === activeConvId ? { ...c, title: oldTitle } : c)))
      toast.error(`Failed to rename conversation: ${err.message || 'Unknown error'}`)
    }
  }

  const handleDeleteConversation = async () => {
    if (!activeConvId) return
    const backupConv = conversations.find(c => c.id === activeConvId); const backupMessages = [...messages]; const backupId = activeConvId
    setActiveConvId(null); setMessages([]); setConversations(prev => prev.filter(c => c.id !== backupId))
    try {
      const { error } = await supabase.from('chat_conversations').delete().eq('id', backupId)
      if (error) throw error
      toast.success('Conversation deleted successfully')
    } catch (err: any) {
      setActiveConvId(backupId); setMessages(backupMessages)
      if (backupConv) setConversations(prev => [backupConv, ...prev])
      toast.error(`Failed to delete conversation: ${err.message || 'Unknown error'}`)
    }
  }

  const handleTogglePin = async (convId: string, currentlyPinned: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev.map(c => (c.id === convId ? { ...c, pinned: !currentlyPinned } : c)))
    try {
      const { error } = await supabase.from('chat_conversations').update({ pinned: !currentlyPinned }).eq('id', convId)
      if (error) throw error
      toast.success(currentlyPinned ? 'Conversation unpinned' : 'Conversation pinned')
    } catch (err: any) {
      setConversations(prev => prev.map(c => (c.id === convId ? { ...c, pinned: currentlyPinned } : c)))
      toast.error(`Failed to update conversation pin: ${err.message || 'Unknown error'}`)
    }
  }

  const handleToggleArchive = async (convId: string, currentlyArchived: boolean, e: React.MouseEvent) => {
    e.stopPropagation()
    setConversations(prev => prev.map(c => (c.id === convId ? { ...c, archived: !currentlyArchived } : c)))
    if (activeConvId === convId) setActiveConvId(null)
    try {
      const { error } = await supabase.from('chat_conversations').update({ archived: !currentlyArchived }).eq('id', convId)
      if (error) throw error
      toast.success(currentlyArchived ? 'Conversation restored from archive' : 'Conversation archived')
    } catch (err: any) {
      setConversations(prev => prev.map(c => (c.id === convId ? { ...c, archived: currentlyArchived } : c)))
      if (activeConvId === null && convId) setActiveConvId(convId)
      toast.error(`Failed to archive conversation: ${err.message || 'Unknown error'}`)
    }
  }

  const handleDeleteConversationById = async (convId: string) => {
    const backupConv = conversations.find(c => c.id === convId); const wasActive = activeConvId === convId
    if (wasActive) { setActiveConvId(null); setMessages([]) }
    setConversations(prev => prev.filter(c => c.id !== convId))
    try {
      const { error } = await supabase.from('chat_conversations').delete().eq('id', convId)
      if (error) throw error
      toast.success('Conversation deleted successfully')
    } catch (err: any) {
      if (wasActive) setActiveConvId(convId)
      if (backupConv) setConversations(prev => [backupConv, ...prev])
      toast.error(`Failed to delete conversation: ${err.message || 'Unknown error'}`)
    }
  }

  // ──────────────────────────────────────────────
  // Chat / copilot handlers
  // ──────────────────────────────────────────────

  const getLocalResponse = (question: string): string => {
    if (!analysis) return ''
    const q = question.toLowerCase()
    const sections = analysis.structured_output?.sections || []
    const abnormalValues = analysis.structured_output?.abnormalValues || []
    const matchedAbnormal = abnormalValues.find(av => q.includes(av.parameter.toLowerCase()) || av.parameter.toLowerCase().includes(q))
    if (matchedAbnormal) return `For **${matchedAbnormal.parameter}**, the value is **${matchedAbnormal.value}** (reference range: ${matchedAbnormal.referenceRange}). Explanation: ${matchedAbnormal.explanation}`
    const matchedMed = medicines.find(m => q.includes(m.brand_name.toLowerCase()) || m.brand_name.toLowerCase().includes(q) || (m.generic_name && (q.includes(m.generic_name.toLowerCase()) || m.generic_name.toLowerCase().includes(q))))
    if (matchedMed) {
      let response = `**${matchedMed.brand_name}** (${matchedMed.generic_name || 'generic medication'}): Used for **${matchedMed.common_uses || 'not specified'}**.\n\n`
      if (matchedMed.how_it_works) response += `• **How it works**: ${matchedMed.how_it_works}\n`
      if (matchedMed.side_effects) response += `• **Side effects**: ${matchedMed.side_effects}\n`
      if (matchedMed.food_restrictions) response += `• **Food restrictions**: ${matchedMed.food_restrictions}\n`
      if (matchedMed.precautions) response += `• **Precautions**: ${matchedMed.precautions}\n`
      return response
    }
    const matchedSec = sections.find(s => q.includes(s.title.toLowerCase()) || s.title.toLowerCase().includes(q))
    if (matchedSec) return `Regarding **${matchedSec.title}**: ${matchedSec.content}`
    if (q.includes('side effect') || q.includes('harm') || q.includes('adverse') || q.includes('bad reaction')) {
      const medsWithSide = medicines.filter(m => m.side_effects).map(m => `• **${m.brand_name}**: ${m.side_effects}`)
      if (medsWithSide.length > 0) return `Here are the side effects mentioned in your document:\n\n${medsWithSide.join('\n\n')}\n\nAlways consult your doctor if you experience severe symptoms.`
      return "I couldn't find any specific side effects listed in this document. Please check the packaging of your medication or consult your pharmacist."
    }
    if (q.includes('food') || q.includes('eat') || q.includes('take') || q.includes('dose') || q.includes('when') || q.includes('empty stomach')) {
      const medsDosage = medicines.map(m => `• **${m.brand_name}**: ${m.food_restrictions || 'No food restrictions listed'}. Note: ${m.precautions || 'Take as directed'}.`)
      return `Here are the food and intake instructions from your document:\n\n${medsDosage.join('\n\n')}`
    }
    if (q.includes('kidney') || q.includes('ultrasound') || q.includes('hydronephrosis') || q.includes('bladder') || q.includes('kub')) {
      const conditionSec = sections.find(s => s.title.toLowerCase().includes('condition') || s.title.toLowerCase().includes('ultrasound'))
      if (conditionSec) return `Based on your report: **${conditionSec.title}**: ${conditionSec.content}`
      return `Based on your document summary: "${analysis.summary}". The ultrasound did not find significant abnormalities, resolving the clinical suspicion of hydronephrosis.`
    }
    if (q.includes('doctor') || q.includes('ask') || q.includes('question')) return `Here are some questions you can ask your doctor at your next visit:\n\n${analysis.doctor_questions.map(dq => `• ${dq}`).join('\n')}`
    return `I understand you are asking about your report. Based on the summary: "${analysis.summary}". If you need specific advice on treatment plans or medical symptoms, it is best to discuss it directly with your doctor.`
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!inputVal.trim() || copilotLoading || !analysis) return
    const userMsg = inputVal.trim()
    setInputVal('')
    setMessages(prev => [...prev, { sender: 'user' as const, text: userMsg, created_at: new Date().toISOString() }])
    setCopilotLoading(true)
    if (fetchAbortRef.current) fetchAbortRef.current.abort()
    fetchAbortRef.current = new AbortController()
    const signal = fetchAbortRef.current.signal
    if (isOffline) {
      toast.warning('You are offline. Answering using offline local report details...')
      const local = getLocalResponse(userMsg)
      if (signal.aborted) return
      streamText(local, () => { setMessages(prev => [...prev, { sender: 'bot' as const, text: local, created_at: new Date().toISOString() }]); setStreamingText(''); setCopilotLoading(false) })
      return
    }
    try {
      const response = await withRetry(async () => {
        const result = await invokeCopilot({ conversationId: activeConvId || undefined, analysisId: analysis.id, message: userMsg, modelKey: modelKey as 'standard' | 'fast_lite' | 'deep_pro', roleKey: roleKey as 'default_clinical' | 'empathetic_advocate' | 'peer_physician' | 'billing_negotiator' })
        if (result.error) throw new Error(result.error.message || 'Supabase function invoke returned error')
        return result.data
      }, { maxAttempts: 2, baseDelay: 600, onRetry: (attempt, delay) => console.log(`Retrying copilot function call. Attempt ${attempt}. Next delay: ${delay}ms`), signal })
      if (signal.aborted) return
      if (response?.answer) {
        streamText(response.answer, () => {
          if (signal.aborted) return
          setMessages(prev => [...prev, { sender: 'bot' as const, text: response.answer, modelUsed: response.modelUsed, created_at: new Date().toISOString() }])
          setStreamingText('')
          if (!activeConvId) setActiveConvId(response.conversationId)
          loadConversations(0, false)
        })
      } else {
        throw new Error('Empty response from AI assistant')
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || signal.aborted) { console.log('Request aborted'); return }
      console.warn('Copilot Edge Function failed, falling back to local responder:', err)
      toast.info('Connecting to local medical reference responder...')
      const local = getLocalResponse(userMsg)
      if (signal.aborted) return
      streamText(local, () => { if (signal.aborted) return; setMessages(prev => [...prev, { sender: 'bot' as const, text: local, created_at: new Date().toISOString() }]); setStreamingText('') })
    } finally {
      if (!signal.aborted) setCopilotLoading(false)
    }
  }

  const handleRegenerateLastResponse = async () => {
    if (!activeConvId || messages.length === 0 || copilotLoading) return
    const userMsgs = messages.filter(m => m.sender === 'user')
    if (userMsgs.length === 0) return
    const lastUserMsg = userMsgs[userMsgs.length - 1].text
    const { data: lastMsgs } = await supabase.from('chat_messages').select('id, role').eq('conversation_id', activeConvId).order('created_at', { ascending: false }).limit(1)
    if (lastMsgs && lastMsgs.length > 0 && lastMsgs[0].role === 'assistant') await supabase.from('chat_messages').delete().eq('id', lastMsgs[0].id)
    setMessages(prev => { const copy = [...prev]; if (copy[copy.length - 1]?.sender === 'bot') copy.pop(); return copy })
    setCopilotLoading(true)
    try {
      const { data: fnData, error: fnError } = await invokeCopilot({ conversationId: activeConvId, analysisId: analysis!.id, message: lastUserMsg, modelKey: modelKey as 'standard' | 'fast_lite' | 'deep_pro', roleKey: roleKey as 'default_clinical' | 'empathetic_advocate' | 'peer_physician' | 'billing_negotiator' })
      if (!fnError && fnData?.answer) streamText(fnData.answer, () => { setMessages(prev => [...prev, { sender: 'bot', text: fnData.answer, modelUsed: fnData.modelUsed }]); setStreamingText('') })
    } catch (err) { console.error('Regenerate failed:', err) } finally { setCopilotLoading(false) }
  }

  // ──────────────────────────────────────────────
  // Export handlers
  // ──────────────────────────────────────────────

  const handleExportTXT = (title: string) => {
    let txt = `=== Conversation: ${title} ===\nDate: ${new Date().toLocaleString()}\nPersona: ${roleKey}\nModel: ${modelKey}\n=========================================\n\n`
    messages.forEach(msg => { const time = msg.created_at ? ` [${new Date(msg.created_at).toLocaleTimeString()}]` : ''; const sender = msg.sender === 'user' ? 'Patient' : `MedDecode Assistant (${msg.modelUsed || modelKey})`; txt += `[${sender}${time}]:\n${msg.text}\n\n` })
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[\s/\\:*?"<>|]+/g, '_')}_chat.txt`; link.click(); URL.revokeObjectURL(url)
  }

  const handleExportMD = (title: string) => {
    let md = `# Conversation: ${title}\n*Generated: ${new Date().toLocaleString()}* | *Persona: ${roleKey}* | *Model: ${modelKey}*\n\n---\n\n`
    messages.forEach(msg => { const time = msg.created_at ? ` [${new Date(msg.created_at).toLocaleTimeString()}]` : ''; const sender = msg.sender === 'user' ? '**Patient**' : `**MedDecode Assistant (${msg.modelUsed || modelKey})**`; md += `### ${sender}${time}\n${msg.text}\n\n` })
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${title.replace(/[\s/\\:*?"<>|]+/g, '_')}_chat.md`; link.click(); URL.revokeObjectURL(url)
  }

  const handleExportPDF = async (title: string) => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(0, 75, 179); doc.text(`MedDecode AI Chat: ${title}`, 14, 20)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text(`Date: ${new Date().toLocaleString()} | Persona: ${roleKey} | Model: ${modelKey}`, 14, 28); doc.line(14, 32, 196, 32)
      let y = 40; doc.setFontSize(11)
      messages.forEach(msg => {
        const isUser = msg.sender === 'user'
        if (y > 270) { doc.addPage(); y = 20 }
        doc.setFont('helvetica', 'bold'); doc.setTextColor(isUser ? 0 : 50, isUser ? 75 : 50, isUser ? 179 : 50)
        const headerText = isUser ? 'Patient' : `Assistant (${msg.modelUsed || modelKey})`; const timeText = msg.created_at ? ` [${new Date(msg.created_at).toLocaleTimeString()}]` : ''
        doc.text(`${headerText}${timeText}`, 14, y); y += 6; doc.setFont('helvetica', 'normal'); doc.setTextColor(40, 40, 40)
        const splitText = doc.splitTextToSize(msg.text, 180)
        splitText.forEach((line: string) => { if (y > 280) { doc.addPage(); y = 20 }; doc.text(line, 14, y); y += 6 }); y += 4
      })
      doc.save(`${title.replace(/[\s/\\:*?"<>|]+/g, '_')}_chat.pdf`)
    } catch (err) { console.error('PDF export failed:', err) }
  }

  // ──────────────────────────────────────────────
  // Other action handlers
  // ──────────────────────────────────────────────

  const handleViewOriginal = async () => {
    if (showOriginal) { setShowOriginal(false); return }
    if (originalUrl) { setShowOriginal(true); return }
    if (!filePath) return
    setOriginalLoading(true)
    try {
      const { data, error } = await supabase.storage.from('Med Decode Ai').createSignedUrl(filePath, 300)
      if (!error && data?.signedUrl) { setOriginalUrl(data.signedUrl); setShowOriginal(true) }
    } catch (e) { console.error('Failed to get signed URL', e) } finally { setOriginalLoading(false) }
  }

  const handleShare = async () => {
    if (!documentId) return
    if (!user || isAnonymous) { toast.warning('Please sign in or create an account to share links with your doctor.'); return }
    setShareLoading(true); setShareSuccess(false)
    try {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(20))).map(b => b.toString(16).padStart(2, '0')).join('')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { error } = await supabase.from('shared_links').insert({ document_id: documentId, user_id: user.id, token, expires_at: expiresAt })
      if (!error) {
        const shareUrl = `${window.location.origin}/share/${token}`
        await navigator.clipboard.writeText(shareUrl)
        setShareSuccess(true)
        toast.success('Share link copied! Valid for 7 days.', 6000, { label: 'Open link', onClick: () => window.open(shareUrl, '_blank') })
        setTimeout(() => setShareSuccess(false), 3000)
      } else { toast.error(`Failed to create share link: ${error.message}`) }
    } catch (e: any) { console.error('Share failed', e); toast.error('Could not generate share link. Please try again.') } finally { setShareLoading(false) }
  }

  const handleReanalyze = async (targetLanguage: 'english' | 'hindi') => {
    const langLabel = targetLanguage === 'hindi' ? 'Hindi' : 'English'
    if (!window.confirm(`This will re-analyze your document in ${langLabel} using 1 of your daily AI quota.\n\nYour current report will be replaced with the ${langLabel} version. Continue?`)) return
    setReanalyzeLoading(true)
    try {
      await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId)
      const { data, error } = await invokeAnalyzeDocument({ documentId, detailLevel: 'full', docType: docInfo?.document_type || 'unknown', outputLanguage: targetLanguage, reuseOcr: true })
      if (error) throw error
      if (data?.isMedical === false) { alert('Re-analysis failed: document classified as non-medical.'); return }
      const { data: analyses } = await supabase.from('analyses').select('*').eq('document_id', documentId).order('created_at', { ascending: false }).limit(1)
      if (analyses && analyses.length > 0) { setAnalysis(analyses[0] as Analysis); selectLatestConversationForAnalysis(analyses[0].id) }
      await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId)
    } catch (err: any) { console.error('Re-analyze error:', err); alert('Re-analysis failed. Please try again.'); await supabase.from('documents').update({ status: 'completed' }).eq('id', documentId) } finally { setReanalyzeLoading(false) }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to permanently delete this analysis? This action is compliant with your DPDP data rights.')) return
    try {
      await supabase.from('data_deletion_requests').insert({ user_id: (await supabase.auth.getUser()).data.user?.id, status: 'completed', completed_at: new Date().toISOString() })
      const { error: delErr } = await supabase.from('documents').delete().eq('id', documentId)
      if (delErr) throw delErr
      toast.success('Analysis deleted. Redirecting to dashboard...')
      navigate({ to: '/dashboard' })
    } catch (e: any) { toast.error(`Deletion failed: ${e.message}`) }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  if (loading) return <SkeletonResults />

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

  const { sections = [], abnormalValues = [], billItems = [], billTotal = null } = analysis.structured_output
  const docType = docInfo?.document_type || 'unknown'
  const isBloodOrDiagnostic = docType === 'blood_report' || docType === 'diagnostic_report'
  const showMedicinesFirst = medicines.length > 0 && !isBloodOrDiagnostic
  const showAbnormalFirst = abnormalValues.length > 0 && (isBloodOrDiagnostic || medicines.length === 0)

  return (
    <div className="py-8 px-4 max-w-7xl mx-auto space-y-8 print:p-0">
      {/* ── Summary card + toolbar ── */}
      <SummaryCard
        analysis={analysis}
        docInfo={docInfo}
        confidence={confidence}
        viewMode={viewMode}
        setViewMode={setViewMode}
        speaking={speaking}
        onSpeak={handleSpeak}
        shareLoading={shareLoading}
        shareSuccess={shareSuccess}
        onShare={handleShare}
        filePath={filePath}
        originalLoading={originalLoading}
        showOriginal={showOriginal}
        onViewOriginal={handleViewOriginal}
        onStartLiveVoice={() => { setShowLiveVoice(true); startLiveSession() }}
        reanalyzeLoading={reanalyzeLoading}
        onReanalyze={handleReanalyze}
        onDelete={handleDelete}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        textSize={textSize}
        setTextSize={setTextSize}
        user={user}
      />

      {/* ── Original document viewer ── */}
      <OriginalDocViewer show={showOriginal} url={originalUrl} isPdf={isPdf} />

      {/* ── Main content grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column: medicines + alerts + chat */}
        <div className="lg:col-span-2 space-y-8 text-left">

          {/* Bill Auditor mode — always shown when tab is active */}
          {viewMode === 'bill_auditor' && (
            <BillAuditorView
              billItems={billItems}
              billTotal={billTotal ?? null}
            />
          )}

          {/* Normal (simple / medical) content — hidden in Bill Auditor mode */}
          {viewMode !== 'bill_auditor' && showMedicinesFirst && (
            <MedicineTable
              medicines={medicines}
              expandedMedicines={expandedMedicines}
              onToggleExpand={toggleMedicineExpand}
              heading="MEDICINES EXPLAINED"
            />
          )}

          {viewMode !== 'bill_auditor' && showAbnormalFirst && (
            <ClinicalAlerts
              abnormalValues={abnormalValues}
              viewMode={viewMode}
              textSizeClass={getTextSizeClass()}
            />
          )}

          {/* General report sections (shown when no medicines & no abnormal, or for diagnostic) */}
          {viewMode !== 'bill_auditor' && ((medicines.length === 0 && abnormalValues.length === 0) || isBloodOrDiagnostic) && sections.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                <span className="text-primary text-2xl">📋</span> Report Details & Glossary
              </h2>
              <div className="space-y-6">
                {sections.map((sec, idx) => (
                  <div key={idx} className="border-b border-slate-100 dark:border-slate-800 pb-4 last:border-0 last:pb-0 text-left">
                    <h3 className="font-extrabold text-sm text-primary">{sec.title}</h3>
                    <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-semibold leading-relaxed mt-2" style={{ whiteSpace: 'pre-wrap' }}>
                      {sec.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medicines on blood/diagnostic docs */}
          {viewMode !== 'bill_auditor' && isBloodOrDiagnostic && medicines.length > 0 && (
            <MedicineTable
              medicines={medicines}
              expandedMedicines={expandedMedicines}
              onToggleExpand={toggleMedicineExpand}
              heading="PRESCRIBED MEDICATIONS"
            />
          )}

          {/* Chat panel */}
          <ChatPanel
            conversations={conversations}
            activeConvId={activeConvId}
            activeConvTitle={activeConvTitle}
            conversationsLoading={conversationsLoading}
            hasMoreConversations={hasMoreConversations}
            conversationsPage={conversationsPage}
            isSidebarOpen={isSidebarOpen}
            searchQuery={searchQuery}
            sortBy={sortBy}
            showArchived={showArchived}
            isEditingTitle={isEditingTitle}
            titleInput={titleInput}
            messages={messages}
            inputVal={inputVal}
            copilotLoading={copilotLoading}
            streamingText={streamingText}
            modelKey={modelKey}
            roleKey={roleKey}
            showExportMenu={showExportMenu}
            isOffline={isOffline}
            speakingText={speakingText}
            isListening={isListening}
            isVoiceSupported={isVoiceSupported}
            showVoiceConsent={showVoiceConsent}
            docType={docType}
            chatEndRef={chatEndRef}
            searchInputRef={searchInputRef}
            inputRef={inputRef}
            onSetActiveConvId={setActiveConvId}
            onSetActiveConvTitle={setActiveConvTitle}
            onSetRoleKey={setRoleKey}
            onSetIsSidebarOpen={setIsSidebarOpen}
            onSetSearchQuery={setSearchQuery}
            onSetSortBy={setSortBy}
            onSetShowArchived={setShowArchived}
            onSetIsEditingTitle={setIsEditingTitle}
            onSetTitleInput={setTitleInput}
            onStartNewChat={handleStartNewChat}
            onLoadMoreConversations={() => loadConversations(conversationsPage + 1, true)}
            onTogglePin={handleTogglePin}
            onToggleArchive={handleToggleArchive}
            onDeleteConversation={handleDeleteConversationById}
            onRenameConversation={handleRenameConversation}
            onDeleteActiveConversation={handleDeleteConversation}
            onModelChange={handleModelChange}
            onPersonaChange={handlePersonaChange}
            onSetShowExportMenu={setShowExportMenu}
            onExportPDF={handleExportPDF}
            onExportMD={handleExportMD}
            onExportTXT={handleExportTXT}
            onSendMessage={handleSendMessage}
            onMicClick={handleMicClick}
            onAcceptVoiceConsent={acceptVoiceConsent}
            onSpeakText={handleSpeakText}
            onCopyText={handleCopyText}
            onRegenerate={handleRegenerateLastResponse}
            onSetInputVal={setInputVal}
            documentId={documentId}
          />
        </div>

        {/* Right column: clinical alerts (sidebar), terms explained, ask your doctor */}
        <div className="space-y-6 text-left">
          {/* Sidebar clinical alerts — only for prescription-type docs */}
          {!(isBloodOrDiagnostic || medicines.length === 0) && abnormalValues.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">
                CLINICAL ALERTS
              </h3>
              {abnormalValues.map((item, idx) => (
                <div key={idx} className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6 shadow-sm space-y-4">
                  <h3 className="text-amber-700 font-black text-sm uppercase tracking-wider flex items-center gap-1.5">⚠️ Attention: Value Alert</h3>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                    <span className="font-extrabold text-lg text-slate-900 dark:text-white">{item.parameter} <span className="text-red-500">{item.value}</span></span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold">Normal range is {item.referenceRange}.</p>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">{item.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {/* Terms explained (right sidebar) */}
          {medicines.length > 0 && docType !== 'blood_report' && docType !== 'diagnostic_report' && sections.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">TERMS EXPLAINED</h3>
              <div className="space-y-4">
                {sections.slice(0, 3).map((sec, idx) => (
                  <div key={idx} className="space-y-1">
                    <h4 className="font-extrabold text-sm text-primary">{sec.title}</h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">{sec.content.split('\n')[0]}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ask your doctor */}
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">🗣️ Ask Your Doctor</h3>
            <ul className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
              {analysis.doctor_questions.map((q, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Citations ── */}
      <CitationsList citations={citations} />

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 dark:border-slate-800 pt-6 text-[10px] text-slate-400 w-full text-center space-y-2">
        <p>🔒 Privacy First • Secure Storage • Your documents are private and never shared</p>
        <p>This translation is for educational use only. Always consult a physician or clinical professional before editing treatment plans.</p>
      </footer>

      {/* ── Live voice overlay ── */}
      <AudioVoiceOverlay
        show={showLiveVoice}
        status={liveStatus}
        error={liveError}
        isMuted={liveMuted}
        microphoneAnalyser={liveMicAnalyser}
        playbackAnalyser={livePlayAnalyser}
        mode={liveMode}
        onModeChange={setLiveMode}
        targetLanguageCode={targetLanguageCode}
        onTargetLanguageChange={setTargetLanguageCode}
        translatedText={liveTranslatedText}
        onMuteToggle={toggleLiveMute}
        onClose={() => { endLiveSession(); setShowLiveVoice(false) }}
        onEndSession={() => { endLiveSession(); setShowLiveVoice(false) }}
      />
    </div>
  )
}
