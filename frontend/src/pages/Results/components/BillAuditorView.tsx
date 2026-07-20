import React from 'react'

export interface BillItem {
  description: string
  amount: string
}

export interface BillAuditorViewProps {
  billItems: BillItem[]
  billTotal: string | null
}

export const BillAuditorView: React.FC<BillAuditorViewProps> = ({
  billItems,
  billTotal,
}) => {
  // Empty state: document is not a hospital bill or AI found no billing data
  if (!billItems || billItems.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-[32px] p-8 shadow-sm text-center space-y-3">
        <span className="text-4xl">🧾</span>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">
          No Billing Data Available
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
          This document doesn't appear to contain an itemized hospital bill or
          billing charges. Bill Auditor mode works best with hospital invoices
          and discharge bills.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
          <span className="text-teal-500 text-xl">🧾</span> Bill Auditor
        </h2>
        <span className="text-[10px] font-black px-3 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 uppercase tracking-wider">
          {billItems.length} line item{billItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-slate-400 dark:text-slate-500 font-medium leading-relaxed bg-amber-500/5 border border-amber-500/10 rounded-2xl px-4 py-3">
        ⚠️ These figures are extracted from your document for transparency. Always
        verify charges with your hospital's billing department before disputing.
      </p>

      {/* Line-items table */}
      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm min-w-[340px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-left text-xs font-black text-slate-400 uppercase tracking-widest pb-3 pl-2 w-full">
                Description
              </th>
              <th className="text-right text-xs font-black text-slate-400 uppercase tracking-widest pb-3 pr-2 whitespace-nowrap">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/60">
            {billItems.map((item, idx) => (
              <tr
                key={idx}
                className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
              >
                <td className="py-3 pl-2 pr-4">
                  <span className="font-semibold text-slate-700 dark:text-slate-200 leading-snug">
                    {item.description || '—'}
                  </span>
                </td>
                <td className="py-3 pr-2 text-right">
                  <span className="font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                    {item.amount || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {/* Grand total */}
          {billTotal && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700">
                <td className="pt-4 pl-2 text-sm font-black text-slate-900 dark:text-white uppercase tracking-wide">
                  Total
                </td>
                <td className="pt-4 pr-2 text-right">
                  <span className="text-base font-black text-teal-600 dark:text-teal-400 tabular-nums">
                    {billTotal}
                  </span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Audit tip */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/40 px-5 py-4 space-y-1.5">
        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          💡 Audit Tips
        </p>
        <ul className="text-xs text-slate-500 dark:text-slate-400 font-medium space-y-1 leading-relaxed list-disc list-inside">
          <li>Ask for an itemized bill if you received only a summary.</li>
          <li>Check for duplicate charges for the same service or medication.</li>
          <li>Verify that your insurance was billed before your out-of-pocket total.</li>
          <li>Any charge you don't recognize can be disputed — ask for a billing code.</li>
        </ul>
      </div>
    </div>
  )
}
