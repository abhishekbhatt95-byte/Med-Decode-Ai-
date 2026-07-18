import React, { useEffect, useRef, useState } from 'react'
import { useToastState, dismissToast, type Toast, type ToastType } from '../hooks/useToast'

const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
}

const COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-600 border-emerald-500',
  error: 'bg-red-600 border-red-500',
  info: 'bg-primary border-primary/60',
  warning: 'bg-amber-500 border-amber-400',
}

const PROGRESS_COLORS: Record<ToastType, string> = {
  success: 'bg-emerald-300',
  error: 'bg-red-300',
  info: 'bg-primary/40',
  warning: 'bg-amber-300',
}

interface ToastItemProps {
  toast: Toast
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(100)
  const startRef = useRef<number>(Date.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    // Animate in
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return
    const duration = toast.duration
    startRef.current = Date.now()

    const tick = () => {
      const elapsed = Date.now() - startRef.current
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [toast.duration])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(() => dismissToast(toast.id), 280)
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-xl
        text-white text-sm font-semibold min-w-[280px] max-w-[420px] overflow-hidden
        transition-all duration-300 ease-out
        ${COLORS[toast.type]}
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'}
      `}
    >
      {/* Icon */}
      <span
        className="shrink-0 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-black mt-0.5"
        aria-hidden="true"
      >
        {ICONS[toast.type]}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="leading-snug break-words">{toast.message}</p>
        {toast.action && (
          <button
            onClick={() => {
              toast.action!.onClick()
              handleDismiss()
            }}
            className="mt-1.5 text-white/80 hover:text-white underline underline-offset-2 text-xs font-bold cursor-pointer transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close */}
      <button
        onClick={handleDismiss}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity cursor-pointer p-0.5 rounded"
        aria-label="Dismiss notification"
      >
        ✕
      </button>

      {/* Progress bar */}
      {toast.duration && toast.duration > 0 && (
        <div
          className={`absolute bottom-0 left-0 h-[3px] ${PROGRESS_COLORS[toast.type]} transition-none rounded-b-2xl`}
          style={{ width: `${progress}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export const ToastRenderer: React.FC = () => {
  const toasts = useToastState()

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 items-end pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
