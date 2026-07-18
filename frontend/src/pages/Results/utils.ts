/**
 * Pure helper utilities for the Results page.
 * Extracted verbatim from ResultsPage.tsx — no logic changes.
 */

export function formatMessageTime(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function formatMessageDate(dateStr?: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) {
    return 'Today'
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  } else {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }
}

export function getConfidenceDisplay(score: number): {
  label: string
  emoji: string
  textClass: string
  barClass: string
} {
  if (score >= 80) {
    return { label: 'Excellent', emoji: '✔️', textClass: 'text-emerald-500', barClass: 'bg-emerald-500' }
  }
  if (score >= 60) {
    return { label: 'Good', emoji: '👍', textClass: 'text-amber-500', barClass: 'bg-amber-500' }
  }
  return { label: 'Needs Review', emoji: '⚠️', textClass: 'text-rose-500', barClass: 'bg-rose-500' }
}

export function parseRangeAndValue(
  valueStr: string,
  rangeStr: string
): { val: number; min: number; max: number; percent: number; isValid: boolean } {
  try {
    const cleanValue = valueStr.replace(/,/g, '')
    const valMatch = cleanValue.match(/[\d\.]+/)
    if (!valMatch) return { val: 0, min: 0, max: 0, percent: 50, isValid: false }
    const val = parseFloat(valMatch[0])

    const cleanRange = rangeStr.replace(/,/g, '')
    const rangeMatches = cleanRange.match(/[\d\.]+/g)
    if (!rangeMatches || rangeMatches.length < 2) {
      return { val, min: 0, max: 0, percent: 50, isValid: false }
    }
    const min = parseFloat(rangeMatches[0])
    const max = parseFloat(rangeMatches[1])

    if (min === max) return { val, min, max, percent: 50, isValid: false }

    let percent = 50
    if (val < min) {
      percent = 5 + (val / min) * 25
      if (percent < 5) percent = 5
    } else if (val >= min && val <= max) {
      percent = 30 + ((val - min) / (max - min)) * 40
    } else {
      percent = 70 + ((val - max) / max) * 25
      if (percent > 95) percent = 95
    }

    return { val, min, max, percent, isValid: true }
  } catch (_err) {
    return { val: 0, min: 0, max: 0, percent: 50, isValid: false }
  }
}
