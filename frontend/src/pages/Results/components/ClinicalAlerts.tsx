import React from 'react'
import { parseRangeAndValue } from '../utils'

export interface AbnormalValue {
  parameter: string
  value: string
  referenceRange: string
  explanation: string
}

export interface ClinicalAlertsProps {
  abnormalValues: AbnormalValue[]
  /** 'simple' renders plain English, 'medical' renders the lab visualizer */
  viewMode: 'simple' | 'medical' | 'bill_auditor'
  textSizeClass: string
}

export const ClinicalAlerts: React.FC<ClinicalAlertsProps> = ({
  abnormalValues,
  viewMode,
  textSizeClass,
}) => {
  if (abnormalValues.length === 0) return null

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
      {viewMode === 'simple' ? (
        <>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-teal-500 text-xl">📄</span> Plain English Explanation
          </h2>
          <div className="space-y-4 text-slate-700 dark:text-slate-300">
            <h3 className="text-sm font-bold text-slate-850 dark:text-slate-100">
              What This Report Means for You
            </h3>
            <div className="space-y-3.5">
              {abnormalValues.map((item, idx) => (
                <p key={idx} className={`leading-relaxed ${textSizeClass}`}>
                  <strong className="text-slate-900 dark:text-white font-extrabold">{item.parameter}:</strong>{' '}
                  {item.explanation}
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="text-teal-500 text-xl">📊</span> Lab Value Visualizer
          </h2>
          <div className="space-y-8">
            {abnormalValues.map((item, idx) => {
              const parsed = parseRangeAndValue(item.value, item.referenceRange)
              const isHigh =
                item.value.toLowerCase().includes('high') || (parsed.isValid && parsed.val > parsed.max)
              const isLow =
                item.value.toLowerCase().includes('low') || (parsed.isValid && parsed.val < parsed.min)
              const badgeText = isHigh ? 'HIGH' : isLow ? 'LOW' : 'NORMAL'
              const badgeColor = isHigh
                ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                : isLow
                ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
              const dotColor = isHigh
                ? 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                : isLow
                ? 'bg-amber-500 shadow-[0_0_10px_#f59e0b]'
                : 'bg-emerald-500 shadow-[0_0_10px_#10b981]'

              return (
                <div key={idx} className="space-y-3 text-left">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {item.parameter}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">({item.value})</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">
                        Range: {item.referenceRange}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded ${badgeColor}`}>
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  {parsed.isValid ? (
                    <div className="relative pt-2 pb-1.5">
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden border border-slate-200/20">
                        <div className="w-[30%] bg-gradient-to-r from-amber-200/50 to-amber-200/90 dark:from-amber-500/10 dark:to-amber-500/30" />
                        <div className="w-[40%] bg-gradient-to-r from-emerald-400/70 to-emerald-400/95 dark:from-emerald-500/20 dark:to-emerald-500/45" />
                        <div className="w-[30%] bg-gradient-to-r from-rose-300/60 to-rose-400/80 dark:from-rose-500/15 dark:to-rose-500/35" />
                      </div>
                      <div
                        className={`absolute top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 -ml-2 -mt-0.5 transition-all duration-500 ${dotColor}`}
                        style={{ left: `${parsed.percent}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-[2px] bg-slate-100 dark:bg-slate-800/60 w-full rounded-full" />
                  )}

                  <p className="text-xs text-slate-400 italic font-medium leading-normal pt-0.5">
                    Note: {item.explanation}
                  </p>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
