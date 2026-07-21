import React from 'react'
import { Link } from '@tanstack/react-router'
import { getConfidenceDisplay, formatMessageDate } from '../utils'

export interface Analysis {
  id: string
  summary: string
  structured_output: {
    sections: { title: string; content: string }[]
    abnormalValues: { parameter: string; value: string; referenceRange: string; explanation: string }[]
    medicalSummary?: string
    outputLanguage?: 'english' | 'hindi'
    billItems?: { description: string; amount: string }[]
    billTotal?: string | null
  }
  doctor_questions: string[]
  document_id?: string
}

export interface DocInfo {
  name: string
  document_type: string
  created_at?: string
}

export interface SummaryCardProps {
  analysis: Analysis
  docInfo: DocInfo | null
  confidence: number | null
  viewMode: 'simple' | 'medical' | 'bill_auditor'
  setViewMode: (v: 'simple' | 'medical' | 'bill_auditor') => void
  speaking: boolean
  onSpeak: () => void
  shareLoading: boolean
  shareSuccess: boolean
  onShare: () => void
  filePath: string | null
  originalLoading: boolean
  showOriginal: boolean
  onViewOriginal: () => void
  onStartLiveVoice: () => void
  reanalyzeLoading: boolean
  onReanalyze: (lang: 'english' | 'hindi') => void
  onDelete: () => void
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  textSize: 'small' | 'base' | 'large' | 'xlarge'
  setTextSize: (v: 'small' | 'base' | 'large' | 'xlarge') => void
  user: any
}

export const SummaryCard: React.FC<SummaryCardProps> = ({
  analysis,
  docInfo,
  confidence,
  viewMode,
  setViewMode,
  speaking,
  onSpeak,
  shareLoading,
  shareSuccess,
  onShare,
  filePath,
  originalLoading,
  showOriginal,
  onViewOriginal,
  onStartLiveVoice,
  reanalyzeLoading,
  onReanalyze,
  onDelete,
  darkMode,
  setDarkMode,
  textSize,
  setTextSize,
  user,
}) => {
  // Derive report title
  const getReportTitle = () => {
    if (!docInfo) return 'Medical Record'
    const nameClean = docInfo.name.replace(/\.[^/.]+$/, '')
    const lowerName = nameClean.toLowerCase()
    const isGeneric = ['large', 'image', 'upload', 'document', 'file', 'photo', 'scan', 'untitled', 'temp', 'placeholder'].some(
      (word) => lowerName.startsWith(word) || lowerName === word
    )
    if (isGeneric && docInfo.document_type && docInfo.document_type !== 'unknown') {
      const types: Record<string, string> = {
        prescription: 'Prescription Summary',
        blood_report: 'Blood Test Analysis',
        diagnostic_report: 'Diagnostic Report Explanation',
        hospital_bill: 'Hospital Bill Audit',
        discharge_summary: 'Discharge Summary Translation',
        medicine_label: 'Medicine Label Guide',
      }
      return types[docInfo.document_type] || nameClean
    }
    return nameClean
      .split(/[-_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
  }

  return (
    <>
      {/* Sign-in nudge for anonymous users */}
      {!user && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 print:hidden text-left">
          <div>
            <h4 className="font-extrabold text-primary text-sm">💡 Want to save this analysis?</h4>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Create a free account or sign in to save your document translation history and view them anytime on your dashboard.
            </p>
          </div>
          <Link
            to="/auth"
            className="bg-primary hover:bg-primary/90 text-white font-extrabold px-5 py-2.5 rounded-full text-xs cursor-pointer whitespace-nowrap shadow-sm text-center"
          >
            Sign In / Sign Up
          </Link>
        </div>
      )}

      {/* Sub-header toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 print:hidden">
        <Link
          to="/upload"
          className="bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-black px-5 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm self-start"
        >
          ← Analyze New Record
        </Link>

        {/* Accessibility & Action controls bar */}
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/80 rounded-2xl lg:rounded-full px-5 py-3 lg:py-2 flex flex-wrap items-center gap-5 text-[11px] font-black tracking-wide text-slate-500 dark:text-slate-400 shadow-sm">
          <div className="flex items-center gap-2">
            <span>TEXT SIZE:</span>
            <div className="flex items-center gap-1">
              {(['small', 'base', 'large', 'xlarge'] as const).map((sz) => {
                const label = sz === 'small' ? 'A-' : sz === 'base' ? 'A' : sz === 'large' ? 'A+' : 'A++'
                const active = textSize === sz
                return (
                  <button
                    key={sz}
                    onClick={() => setTextSize(sz)}
                    className={`px-2 py-0.5 rounded font-black border text-[10px] cursor-pointer transition-all ${
                      active
                        ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30'
                        : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span>SCREEN MODE:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setDarkMode(false)}
                className={`px-2.5 py-0.5 rounded font-black border text-[10px] cursor-pointer transition-all ${
                  !darkMode
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30'
                    : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
                }`}
              >
                Light
              </button>
              <button
                onClick={() => setDarkMode(true)}
                className={`px-2.5 py-0.5 rounded font-black border text-[10px] cursor-pointer transition-all ${
                  darkMode
                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border-teal-500/30'
                    : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
                }`}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span>READ ALOUD:</span>
            <button
              onClick={onSpeak}
              className={`w-6 h-6 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer border border-teal-500/30 ${
                speaking ? 'animate-pulse bg-teal-500/30' : ''
              }`}
              title={speaking ? 'Stop reading' : 'Read report aloud'}
            >
              {speaking ? '⏸️' : '▶️'}
            </button>
          </div>
        </div>
      </div>

      {/* Patient Record Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-[32px] p-6 md:p-8 shadow-sm text-left space-y-5 relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-teal-500/10 text-teal-600 dark:text-teal-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
              {docInfo?.document_type ? docInfo.document_type.replace('_', ' ') : 'Report'} Panel
            </span>
            {analysis.structured_output?.outputLanguage === 'hindi' && (
              <span className="bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider border border-orange-200/60 dark:border-orange-900/40">
                🇮🇳 हिंदी रिपोर्ट
              </span>
            )}
            <span className="text-xs text-slate-400 dark:text-slate-500 font-bold flex items-center gap-2">
              <span>Issued: {docInfo?.created_at ? formatMessageDate(docInfo.created_at) : 'Recent'}</span>
              {confidence !== null && (
                <>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className={`${getConfidenceDisplay(confidence).textClass} font-bold`}>
                    Scan Quality: {confidence}%
                  </span>
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              📥 PDF
            </button>
            <button
              onClick={onShare}
              disabled={shareLoading}
              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {shareLoading ? '⏳ Sharing...' : shareSuccess ? '✅ Shared!' : '🔗 Share'}
            </button>
            {filePath && (
              <button
                onClick={onViewOriginal}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                {originalLoading ? '⏳' : showOriginal ? '🔼 Hide Original' : '📄 Original'}
              </button>
            )}
            {analysis?.id && (
              <button
                onClick={onStartLiveVoice}
                className="bg-primary hover:bg-primary/90 text-white font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5 transition-all shadow-sm"
              >
                🎙️ Live Voice
              </button>
            )}
            <button
              onClick={() =>
                onReanalyze(analysis.structured_output?.outputLanguage === 'hindi' ? 'english' : 'hindi')
              }
              disabled={reanalyzeLoading}
              className="bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 text-orange-600 dark:text-orange-400 font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5 border border-orange-200/60 dark:border-orange-900/40 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
              title={
                analysis.structured_output?.outputLanguage === 'hindi'
                  ? 'Re-analyze in English'
                  : 'Re-analyze in Hindi'
              }
            >
              {reanalyzeLoading
                ? '⏳ Analyzing...'
                : analysis.structured_output?.outputLanguage === 'hindi'
                ? '🇬🇧 Switch to English'
                : '🇮🇳 हिंदी में देखें'}
            </button>
            <button
              onClick={onDelete}
              className="bg-red-50 dark:bg-red-950/20 hover:bg-red-100 text-red-500 font-extrabold px-4 py-2 rounded-full text-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              🗑️ Delete
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {getReportTitle()}
          </h2>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base font-medium max-w-4xl">
            {viewMode === 'simple'
              ? analysis.summary
              : viewMode === 'medical'
              ? analysis.structured_output?.medicalSummary || analysis.summary
              : 'Switch to Clinical Mode or Patient Mode to read the document summary. Bill Auditor shows only the billing line items extracted from this document.'}
          </p>
        </div>

        {/* Tab view switcher */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-150 dark:border-slate-800/60">
          <button
            onClick={() => setViewMode('simple')}
            className={`px-5 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
              viewMode === 'simple'
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 shadow-sm'
                : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
            }`}
          >
            Patient Mode
          </button>
          <button
            onClick={() => setViewMode('medical')}
            className={`px-5 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
              viewMode === 'medical'
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 shadow-sm'
                : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
            }`}
          >
            Clinical Mode
          </button>
          <button
            onClick={() => setViewMode('bill_auditor')}
            className={`px-5 py-2.5 rounded-full text-xs font-black transition-all cursor-pointer border ${
              viewMode === 'bill_auditor'
                ? 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20 shadow-sm'
                : 'bg-transparent text-slate-400 dark:text-slate-500 border-transparent hover:text-slate-600'
            }`}
          >
            Bill Auditor
          </button>
        </div>
      </div>
    </>
  )
}
