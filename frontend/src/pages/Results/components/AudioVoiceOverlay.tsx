import React from 'react'
import { VoiceVisualizer } from '../../../components/VoiceVisualizer'
import type { LiveVoiceStatus, LiveVoiceMode } from '../../../hooks/useGeminiLive'

// BCP-47 codes that map to our app's outputLanguage selections
const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'ar', label: 'العربية' },
  { code: 'zh', label: '中文' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
]

export interface AudioVoiceOverlayProps {
  show: boolean
  status: LiveVoiceStatus
  error: string | null
  isMuted: boolean
  microphoneAnalyser: AnalyserNode | null
  playbackAnalyser: AnalyserNode | null
  onMuteToggle: () => void
  onClose: () => void
  onEndSession: () => void
  // Mode controls — passed down from Results/index.tsx
  mode: LiveVoiceMode
  onModeChange: (mode: LiveVoiceMode) => void
  targetLanguageCode: string
  onTargetLanguageChange: (code: string) => void
  translatedText?: string
}

export const AudioVoiceOverlay: React.FC<AudioVoiceOverlayProps> = ({
  show,
  status,
  error,
  isMuted,
  microphoneAnalyser,
  playbackAnalyser,
  onMuteToggle,
  onClose,
  onEndSession,
  mode,
  onModeChange,
  targetLanguageCode,
  onTargetLanguageChange,
  translatedText,
}) => {
  if (!show) return null

  const isActive = status !== 'Disconnected' && status !== 'Ended'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/80 rounded-[32px] w-full max-w-md p-6 flex flex-col gap-5 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative text-left overflow-hidden">

        {/* Ambient top glowing line — colour shifts by mode */}
        <div className={`absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r ${
          mode === 'translate'
            ? 'from-emerald-400 via-teal-500 to-cyan-500'
            : 'from-cyan-500 via-indigo-500 to-purple-500'
        }`} />

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-md font-black text-white flex items-center gap-2 tracking-tight">
            <span className={`w-2 h-2 rounded-full animate-ping ${mode === 'translate' ? 'bg-emerald-400' : 'bg-cyan-500'}`} />
            {mode === 'translate' ? 'Live Translation' : 'Live Medical AI Voice'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer text-xs font-bold bg-slate-800/80 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-750"
          >
            ✕ Close
          </button>
        </div>

        {/* Mode toggle — disabled while session is active */}
        <div className="flex gap-2 p-1 bg-slate-800/60 rounded-2xl border border-slate-700/40">
          <button
            onClick={() => !isActive && onModeChange('voice')}
            disabled={isActive}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
              mode === 'voice'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed'
            }`}
          >
            🎙️ Voice Assistant
          </button>
          <button
            onClick={() => !isActive && onModeChange('translate')}
            disabled={isActive}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all ${
              mode === 'translate'
                ? 'bg-emerald-600/80 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 disabled:cursor-not-allowed'
            }`}
          >
            🌐 Live Translate
          </button>
        </div>

        {/* Translate mode: language selector */}
        {mode === 'translate' && (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Translate into
            </label>
            <select
              value={targetLanguageCode}
              onChange={e => onTargetLanguageChange(e.target.value)}
              disabled={isActive}
              className="w-full bg-slate-800/70 border border-slate-700/50 rounded-xl px-3 py-2 text-sm text-white font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {LANGUAGE_OPTIONS.map(l => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 font-medium">
              Speak in any language — the assistant will translate your speech in real-time.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-3.5 text-xs font-semibold leading-relaxed">
            ⚠️ {error}
          </div>
        )}

        {/* Visualizer + status */}
        <div className="flex-1 flex flex-col gap-4">
          <VoiceVisualizer
            status={status}
            analyser={status === 'Listening' ? microphoneAnalyser : playbackAnalyser}
          />

          <div className="text-center space-y-1 py-1">
            <h4 className="text-sm font-black text-white transition-all duration-300">
              {status === 'Connecting' && 'Connecting...'}
              {status === 'Listening' && (mode === 'translate' ? 'Listening — speak now...' : 'Consultant is listening...')}
              {status === 'Thinking' && (mode === 'translate' ? 'Translating...' : 'Consultant is processing...')}
              {status === 'Speaking' && (mode === 'translate' ? 'Playing translation...' : 'Consultant is speaking...')}
              {status === 'Disconnected' && 'Session Disconnected'}
              {status === 'Ended' && 'Session Ended'}
            </h4>
            <p className="text-[11px] text-slate-400 font-medium max-w-[280px] mx-auto leading-normal">
              {status === 'Listening' && mode !== 'translate' &&
                'Speak clearly. The model will automatically process when you stop speaking.'}
              {status === 'Listening' && mode === 'translate' &&
                'Speak in any language — translation happens continuously.'}
              {status === 'Speaking' && mode !== 'translate' && 'You can speak at any time to interrupt the assistant.'}
              {status === 'Thinking' && mode !== 'translate' && 'Analyzing input against document details...'}
              {status === 'Connecting' && 'Securing ephemeral credentials...'}
            </p>
          </div>

          {/* Live translation text transcript */}
          {mode === 'translate' && translatedText && (
            <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-2xl p-3.5 max-h-28 overflow-y-auto">
              <p className="text-[11px] font-black text-emerald-400 uppercase tracking-widest mb-1.5">
                Translation
              </p>
              <p className="text-sm text-white font-semibold leading-relaxed">
                {translatedText}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-4 pt-4 border-t border-slate-800/60">
          <button
            onClick={onMuteToggle}
            className={`p-4 rounded-full transition-all flex items-center justify-center cursor-pointer text-lg shadow-md border ${
              isMuted
                ? 'bg-red-500/15 text-red-500 border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)] hover:bg-red-500/25'
                : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-700/80 hover:text-white'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>

          <button
            onClick={onEndSession}
            className="px-6 py-3.5 bg-red-650 hover:bg-red-700 text-white rounded-full font-black text-xs tracking-wider uppercase shadow-lg shadow-red-950/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            🔴 End Session
          </button>
        </div>
      </div>
    </div>
  )
}
