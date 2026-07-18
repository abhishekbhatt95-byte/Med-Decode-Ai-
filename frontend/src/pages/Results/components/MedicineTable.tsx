import React from 'react'
import { getConfidenceDisplay } from '../utils'

export interface Medicine {
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

export interface MedicineTableProps {
  medicines: Medicine[]
  expandedMedicines: Record<string, boolean>
  onToggleExpand: (id: string) => void
  /** Heading to display above the list */
  heading: string
}

function getIntakeSchedule(med: Medicine) {
  const text = `${med.brand_name} ${med.generic_name || ''} ${med.category || ''} ${med.common_uses || ''} ${med.how_it_works || ''} ${med.precautions || ''} ${med.food_restrictions || ''}`.toLowerCase()

  const morning =
    text.includes('morning') || text.includes('am') || text.includes('o.d') || text.includes('od') ||
    text.includes('1-0-0') || text.includes('1-1-1') || text.includes('1-0-1') || text.includes('1-1-0') ||
    text.includes('twice daily') || text.includes('three times') || text.includes('daily') ||
    text.includes('b.d') || text.includes('bd') || text.includes('t.d.s') || text.includes('tds')

  const afternoon =
    text.includes('afternoon') || text.includes('noon') || text.includes('pm') ||
    text.includes('1-1-1') || text.includes('1-1-0') || text.includes('0-1-0') ||
    text.includes('three times') || text.includes('t.d.s') || text.includes('tds')

  const night =
    text.includes('night') || text.includes('evening') || text.includes('hs') || text.includes('h.s') ||
    text.includes('bedtime') || text.includes('pm') || text.includes('1-0-1') || text.includes('1-1-1') ||
    text.includes('0-0-1') || text.includes('0-1-1') || text.includes('twice daily') ||
    text.includes('three times') || text.includes('b.d') || text.includes('bd') ||
    text.includes('t.d.s') || text.includes('tds')

  return { morning, afternoon, night }
}

export const MedicineTable: React.FC<MedicineTableProps> = ({
  medicines,
  expandedMedicines,
  onToggleExpand,
  heading,
}) => {
  if (medicines.length === 0) return null

  return (
    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">{heading}</h2>

      <div className="space-y-4">
        {medicines.map((med) => {
          const isExpanded = !!expandedMedicines[med.id]
          return (
            <div
              key={med.id}
              className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Header row — click to expand */}
              <div
                onClick={() => onToggleExpand(med.id)}
                className="p-5 flex justify-between items-center cursor-pointer select-none hover:bg-slate-50/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-xl text-primary">
                    💊
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900 dark:text-white inline-flex items-center gap-2">
                      {med.brand_name}
                      <span className="bg-primary/10 text-primary text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                        {med.category || 'Medication'}
                      </span>
                    </h3>
                  </div>
                </div>
                <span className="text-slate-400 text-sm font-bold">{isExpanded ? '▲' : '▼'}</span>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/20 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        WHAT IT'S FOR
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        {med.common_uses || 'Not specified'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        HOW IT WORKS
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        {med.how_it_works || 'Not specified'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        SIDE EFFECTS
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        {med.side_effects || 'None listed'}
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        FOOD RESTRICTIONS
                      </span>
                      <p className="text-slate-700 dark:text-slate-300 font-semibold leading-relaxed">
                        {med.food_restrictions || 'No special instructions'}
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        IMPORTANT NOTES & PRECAUTIONS
                      </span>
                      <p className="text-primary font-bold leading-relaxed">
                        {med.precautions || 'Finish all the pills even if you feel better.'}
                      </p>
                    </div>
                  </div>

                  {/* Dosage schedule */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 space-y-4">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      DOSAGE INSTRUCTIONS
                    </span>
                    <h4 className="text-lg font-extrabold text-slate-800 dark:text-white">
                      {med.generic_name || 'Dosage not specified'}
                    </h4>

                    <div className="flex flex-wrap gap-3 border-t border-slate-200/50 pt-4 text-xs font-bold">
                      {(() => {
                        const { morning, afternoon, night } = getIntakeSchedule(med)
                        return (
                          <>
                            <span
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                                morning
                                  ? 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                              }`}
                            >
                              🌅 Morning {morning ? '✓' : '✗'}
                            </span>
                            <span
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                                afternoon
                                  ? 'bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
                                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                              }`}
                            >
                              ☀️ Afternoon {afternoon ? '✓' : '✗'}
                            </span>
                            <span
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                                night
                                  ? 'bg-indigo-500/10 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300'
                                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'
                              }`}
                            >
                              🌙 Bedtime/Night {night ? '✓' : '✗'}
                            </span>
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="pt-2">
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
                      <span>RECOGNITION CONFIDENCE</span>
                      <span>{med.confidence_score || 95}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`${getConfidenceDisplay(med.confidence_score || 95).barClass} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${med.confidence_score || 95}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
