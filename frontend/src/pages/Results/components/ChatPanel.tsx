import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { SkeletonConversation, SkeletonMessage } from '../../../components/Skeleton'
import { formatMessageDate, formatMessageTime } from '../utils'

export interface ChatMessage {
  sender: 'user' | 'bot'
  text: string
  modelUsed?: string
  created_at?: string
}

export interface Conversation {
  id: string
  title: string
  role_persona: string
  updated_at: string
  created_at: string
  pinned: boolean
  archived: boolean
  docName: string
  lastMessage: string
  lastMessageTime: string
  lastMessageModel: string
  analyses?: { documents?: { id?: string; name?: string } }
}

export interface ChatPanelProps {
  // Conversation sidebar state
  conversations: Conversation[]
  activeConvId: string | null
  activeConvTitle: string
  conversationsLoading: boolean
  hasMoreConversations: boolean
  conversationsPage?: number // passed by parent but only used for load-more callback, not rendered
  isSidebarOpen: boolean
  searchQuery: string
  sortBy: 'recent' | 'oldest' | 'document' | 'model' | 'persona'
  showArchived: boolean
  isEditingTitle: boolean
  titleInput: string

  // Chat state
  messages: ChatMessage[]
  inputVal: string
  copilotLoading: boolean
  streamingText: string
  modelKey: string
  roleKey: string
  showExportMenu: boolean
  isOffline: boolean
  speakingText: string | null
  isListening: boolean
  isVoiceSupported: boolean
  showVoiceConsent: boolean
  docType: string

  // Refs
  chatEndRef: React.RefObject<HTMLDivElement | null>
  searchInputRef: React.RefObject<HTMLInputElement | null>
  inputRef: React.RefObject<HTMLInputElement | null>

  // Sidebar handlers
  onSetActiveConvId: (id: string) => void
  onSetActiveConvTitle: (title: string) => void
  onSetRoleKey: (key: string) => void
  onSetIsSidebarOpen: (v: boolean) => void
  onSetSearchQuery: (v: string) => void
  onSetSortBy: (v: 'recent' | 'oldest' | 'document' | 'model' | 'persona') => void
  onSetShowArchived: (v: boolean) => void
  onSetIsEditingTitle: (v: boolean) => void
  onSetTitleInput: (v: string) => void
  onStartNewChat: () => void
  onLoadMoreConversations: () => void
  onTogglePin: (convId: string, currentlyPinned: boolean, e: React.MouseEvent) => void
  onToggleArchive: (convId: string, currentlyArchived: boolean, e: React.MouseEvent) => void
  onDeleteConversation: (convId: string) => void
  onRenameConversation: () => void
  onDeleteActiveConversation: () => void

  // Chat handlers
  onModelChange: (model: string) => void
  onPersonaChange: (persona: string) => void
  onSetShowExportMenu: (v: boolean) => void
  onExportPDF: (title: string) => void
  onExportMD: (title: string) => void
  onExportTXT: (title: string) => void
  onSendMessage: (e?: React.FormEvent) => void
  onMicClick: () => void
  onAcceptVoiceConsent: () => void
  onSpeakText: (text: string) => void
  onCopyText: (text: string) => void
  onRegenerate: () => void
  onSetInputVal: (v: string) => void

  // DocumentId — needed to navigate when clicking a cross-document conversation
  documentId: string
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  conversations,
  activeConvId,
  activeConvTitle,
  conversationsLoading,
  hasMoreConversations,
  conversationsPage: _conversationsPage,
  isSidebarOpen,
  searchQuery,
  sortBy,
  showArchived,
  isEditingTitle,
  titleInput,
  messages,
  inputVal,
  copilotLoading,
  streamingText,
  modelKey,
  roleKey,
  showExportMenu,
  isOffline,
  speakingText,
  isListening,
  isVoiceSupported,
  showVoiceConsent,
  docType,
  chatEndRef,
  searchInputRef,
  inputRef,
  onSetActiveConvId,
  onSetActiveConvTitle,
  onSetRoleKey,
  onSetIsSidebarOpen,
  onSetSearchQuery,
  onSetSortBy,
  onSetShowArchived,
  onSetIsEditingTitle,
  onSetTitleInput,
  onStartNewChat,
  onLoadMoreConversations,
  onTogglePin,
  onToggleArchive,
  onDeleteConversation,
  onRenameConversation,
  onDeleteActiveConversation,
  onModelChange,
  onPersonaChange,
  onSetShowExportMenu,
  onExportPDF,
  onExportMD,
  onExportTXT,
  onSendMessage,
  onMicClick,
  onAcceptVoiceConsent,
  onSpeakText,
  onCopyText,
  onRegenerate,
  onSetInputVal,
  documentId,
}) => {
  const navigate = useNavigate()

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm mt-6 print:hidden overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] min-h-[500px]">

        {/* ── Conversation Sidebar ── */}
        <div
          className={`border-r border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col gap-4 ${
            isSidebarOpen ? 'flex' : 'hidden md:flex'
          }`}
        >
          <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Chat History</span>
            <button
              onClick={onStartNewChat}
              className="bg-primary hover:bg-primary/90 text-white rounded-lg px-2.5 py-1 text-xs font-black cursor-pointer transition-all shadow-sm"
            >
              ➕ New Chat
            </button>
          </div>

          <div className="space-y-2">
            <input
              ref={searchInputRef}
              type="text"
              id="conversation-search"
              placeholder="🔍 Search chats... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
              aria-label="Search conversation history"
              className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <div className="flex justify-between items-center gap-2">
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Sort by</span>
              <select
                value={sortBy}
                onChange={(e) => onSetSortBy(e.target.value as any)}
                className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-0.5 text-[10px] font-bold outline-none text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                <option value="recent">🕒 Recent</option>
                <option value="oldest">⏳ Oldest</option>
                <option value="document">📄 Document</option>
                <option value="model">🤖 Model</option>
                <option value="persona">👨‍⚕️ Persona</option>
              </select>
            </div>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-850 p-1 rounded-xl gap-1">
            <button
              onClick={() => onSetShowArchived(false)}
              className={`flex-1 text-center py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                !showArchived
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => onSetShowArchived(true)}
              className={`flex-1 text-center py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                showArchived
                  ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Archived
            </button>
          </div>

          <div className="flex-1 max-h-[350px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {conversationsLoading && conversations.length === 0 && (
              <>
                <SkeletonConversation />
                <SkeletonConversation />
                <SkeletonConversation />
              </>
            )}
            {conversations.length === 0 && !conversationsLoading && (
              <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                No conversations found.
              </div>
            )}
            {conversations.map((conv) => {
              const isActive = activeConvId === conv.id
              const isPinned = conv.pinned === true
              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    onSetActiveConvId(conv.id)
                    onSetActiveConvTitle(conv.title)
                    onSetRoleKey(conv.role_persona || 'default_clinical')
                    if (conv.analyses?.documents?.id && conv.analyses.documents.id !== documentId) {
                      navigate({ to: '/results', search: { docId: conv.analyses.documents.id } })
                    }
                  }}
                  className={`group relative rounded-xl p-2.5 text-left cursor-pointer transition-all border ${
                    isActive
                      ? 'bg-primary/5 dark:bg-primary/20 border-primary/20 dark:border-primary/45'
                      : 'bg-white dark:bg-slate-800/40 border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-1">
                    <span className="font-extrabold text-xs text-slate-800 dark:text-slate-100 truncate flex-1 leading-tight">
                      {isPinned ? '📌 ' : ''}
                      {conv.title}
                    </span>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-all shrink-0 ml-1">
                      <button
                        onClick={(e) => onTogglePin(conv.id, isPinned, e)}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px]"
                        title={isPinned ? 'Unpin chat' : 'Pin chat'}
                      >
                        📌
                      </button>
                      <button
                        onClick={(e) => onToggleArchive(conv.id, conv.archived, e)}
                        className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-[10px]"
                        title={conv.archived ? 'Restore chat' : 'Archive chat'}
                      >
                        📥
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteConversation(conv.id)
                        }}
                        className="p-0.5 hover:bg-red-100 dark:hover:bg-red-950/30 rounded text-red-500 text-[10px]"
                        title="Delete chat"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 font-semibold">
                    {conv.lastMessage || 'No messages yet'}
                  </p>

                  <div className="flex justify-between items-center mt-1.5">
                    <span className="text-[8px] font-black uppercase bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                      📄 {conv.docName}
                    </span>
                    {conv.lastMessageTime && (
                      <span className="text-[8px] text-slate-400 font-bold">
                        {formatMessageDate(conv.lastMessageTime)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            {hasMoreConversations && (
              <button
                onClick={onLoadMoreConversations}
                disabled={conversationsLoading}
                className="w-full text-center py-2 text-xs font-bold text-primary hover:underline cursor-pointer"
              >
                {conversationsLoading ? '⏳ Loading...' : 'Load older chats'}
              </button>
            )}
          </div>
        </div>

        {/* ── Chat Main Area ── */}
        <div className="p-4 md:p-6 flex flex-col justify-between gap-4">
          {/* Chat header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSetIsSidebarOpen(!isSidebarOpen)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-xs font-bold shrink-0 cursor-pointer"
                title="Toggle chat history"
              >
                📂
              </button>
              <div className="flex flex-col gap-0.5 text-left">
                <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
                  💬 {activeConvTitle}
                </h3>
                {activeConvId && (
                  <div className="flex items-center gap-2">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-1.5 mt-1">
                        <input
                          type="text"
                          value={titleInput}
                          onChange={(e) => onSetTitleInput(e.target.value)}
                          className="bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-0.5 text-xs font-bold outline-none text-slate-800 dark:text-white"
                        />
                        <button
                          onClick={onRenameConversation}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black px-2 py-1 rounded cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => onSetIsEditingTitle(false)}
                          className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black px-2 py-1 rounded cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => {
                            onSetIsEditingTitle(true)
                            onSetTitleInput(activeConvTitle)
                          }}
                          className="text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          ✏️ Rename
                        </button>
                        <button
                          onClick={onDeleteActiveConversation}
                          className="text-[10px] font-bold text-red-400 hover:text-red-600 cursor-pointer"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <select
                value={modelKey}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-xl px-2.5 py-1.5 text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="standard">🤖 Gemini Standard</option>
                <option value="fast_lite">⚡ Gemini Fast Lite</option>
                <option value="deep_pro">🔮 Gemini Deep Pro</option>
              </select>

              <select
                value={roleKey}
                onChange={(e) => onPersonaChange(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-xl px-2.5 py-1.5 text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="default_clinical">👨‍⚕️ Clinical Assistant</option>
                <option value="empathetic_advocate">💖 Patient Advocate</option>
                <option value="peer_physician">🧬 Peer Physician</option>
                <option value="billing_negotiator">💵 Billing Negotiator</option>
              </select>

              {activeConvId && (
                <div className="relative">
                  <button
                    onClick={() => onSetShowExportMenu(!showExportMenu)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1 hover:bg-slate-100"
                  >
                    📥 Export
                  </button>
                  {showExportMenu && (
                    <div className="absolute right-0 mt-1.5 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-850 rounded-xl shadow-lg z-10 py-1 flex flex-col">
                      <button
                        onClick={() => { onExportPDF(activeConvTitle); onSetShowExportMenu(false) }}
                        className="px-3 py-1.5 text-[10px] font-bold text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        📄 PDF
                      </button>
                      <button
                        onClick={() => { onExportMD(activeConvTitle); onSetShowExportMenu(false) }}
                        className="px-3 py-1.5 text-[10px] font-bold text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        📝 Markdown
                      </button>
                      <button
                        onClick={() => { onExportTXT(activeConvTitle); onSetShowExportMenu(false) }}
                        className="px-3 py-1.5 text-[10px] font-bold text-left text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        💬 TXT
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Messages list */}
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 flex flex-col gap-2 scrollbar-thin flex-1">
            {messages.length === 0 && !copilotLoading && !streamingText && (
              <div className="text-center py-8 text-slate-400 font-semibold text-sm">
                💬 Start the conversation! Choose a persona and ask a question about your report.
              </div>
            )}

            {messages.map((msg, index) => {
              const isLastBotMsg = msg.sender === 'bot' && index === messages.length - 1
              return (
                <div
                  key={index}
                  className={`flex items-start gap-2 max-w-[85%] ${
                    msg.sender === 'user' ? 'self-end flex-row-reverse' : 'self-start'
                  }`}
                >
                  <div className="flex flex-col gap-1 w-full">
                    {msg.sender === 'bot' && msg.modelUsed && (
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/40 px-1.5 py-0.5 rounded-md self-start block">
                        🤖{' '}
                        {msg.modelUsed === 'gemini-3.5-flash'
                          ? 'Gemini Standard'
                          : msg.modelUsed === 'gemini-3.1-flash-lite'
                          ? 'Gemini Fast Lite'
                          : msg.modelUsed === 'gemini-3.1-pro'
                          ? 'Gemini Deep Pro'
                          : msg.modelUsed}
                      </span>
                    )}
                    <div
                      className={`rounded-2xl p-4 text-sm font-semibold leading-relaxed transition-all shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/20 text-left'
                      }`}
                      style={{ whiteSpace: 'pre-wrap' }}
                    >
                      {msg.text}
                    </div>
                    {msg.created_at && (
                      <span
                        className={`text-[8px] text-slate-400 font-bold mt-1 block ${
                          msg.sender === 'user' ? 'text-right mr-1' : 'text-left ml-1'
                        }`}
                      >
                        {formatMessageTime(msg.created_at)}
                      </span>
                    )}
                  </div>

                  {msg.sender === 'bot' && (
                    <div className="flex flex-col gap-1.5 mt-2 shrink-0">
                      <button
                        onClick={() => onSpeakText(msg.text)}
                        className={`p-2 rounded-full border text-xs cursor-pointer transition-all ${
                          speakingText === msg.text
                            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900 text-red-500 hover:bg-red-100'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                        }`}
                        title={speakingText === msg.text ? 'Stop reading' : 'Read aloud'}
                      >
                        {speakingText === msg.text ? '🔇' : '🔊'}
                      </button>

                      <button
                        onClick={() => onCopyText(msg.text)}
                        className="p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 text-xs cursor-pointer transition-all"
                        title="Copy response"
                      >
                        📋
                      </button>

                      {isLastBotMsg && (
                        <button
                          onClick={onRegenerate}
                          className="p-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 hover:bg-slate-50 text-xs cursor-pointer transition-all"
                          title="Regenerate response"
                        >
                          🔄
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {streamingText && (
              <div className="flex items-start gap-2 max-w-[85%] self-start">
                <div className="flex flex-col gap-1 w-full text-left">
                  <span className="text-[9px] font-extrabold uppercase tracking-widest text-primary bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/40 px-1.5 py-0.5 rounded-md self-start block">
                    🤖{' '}
                    {modelKey === 'standard'
                      ? 'Gemini Standard'
                      : modelKey === 'fast_lite'
                      ? 'Gemini Fast Lite'
                      : 'Gemini Deep Pro'}{' '}
                    (Typing...)
                  </span>
                  <div
                    className="rounded-2xl p-4 text-sm font-semibold leading-relaxed transition-all shadow-sm bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/20"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {streamingText}
                  </div>
                </div>
              </div>
            )}

            {copilotLoading && !streamingText && <SkeletonMessage isUser={false} />}

            <div ref={chatEndRef} />
          </div>

          {/* Suggestions */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block text-left">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'Are there any food restrictions?',
                'What are the side effects?',
                docType === 'blood_report' ? 'Explain my abnormal lab values' : 'Explain my report findings',
              ].map((sug, idx) => (
                <button
                  key={idx}
                  onClick={() => onSetInputVal(sug)}
                  className="bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-850 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-800 font-bold px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all"
                >
                  💡 {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Voice consent banner */}
          {showVoiceConsent && (
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-[11px] font-semibold text-slate-500 leading-normal flex flex-col gap-2 text-left">
              <p>🎙️ Voice input uses your browser's built-in speech recognition; audio is not stored by MedDecode AI.</p>
              <button
                type="button"
                onClick={onAcceptVoiceConsent}
                className="self-end bg-primary text-white text-[10px] px-2.5 py-1 rounded-lg font-bold cursor-pointer"
              >
                Enable Voice Input
              </button>
            </div>
          )}

          {/* Chat input form */}
          <form onSubmit={onSendMessage} className="flex gap-2 pt-2 items-center">
            <input
              ref={inputRef}
              type="text"
              id="copilot-chat-input"
              placeholder={
                isOffline
                  ? 'Offline — answers use local report data...'
                  : 'Ask about your report, medicines, or parameters...'
              }
              value={inputVal}
              onChange={(e) => onSetInputVal(e.target.value)}
              disabled={copilotLoading}
              aria-label="Ask the medical AI assistant a question about your report"
              aria-busy={copilotLoading}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-full px-5 py-3 text-sm font-semibold outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all disabled:opacity-50"
            />
            <button
              type="button"
              onClick={onMicClick}
              disabled={copilotLoading}
              className={`p-3 rounded-full border transition-all shrink-0 flex items-center justify-center cursor-pointer ${
                !isVoiceSupported
                  ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-50 cursor-not-allowed'
                  : isListening
                  ? 'bg-red-500 border-red-500 text-white animate-pulse'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
              }`}
              title={
                !isVoiceSupported
                  ? 'Speech recognition is not supported in this browser.'
                  : isListening
                  ? 'Stop listening'
                  : 'Start voice typing'
              }
            >
              {isListening ? '🔴' : '🎙️'}
            </button>
            <button
              type="submit"
              disabled={copilotLoading}
              className="bg-primary hover:bg-primary/90 text-white font-extrabold px-6 py-3 rounded-full text-sm cursor-pointer shadow-sm transition-all disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
