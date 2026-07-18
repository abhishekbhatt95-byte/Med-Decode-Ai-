import { useState, useEffect, useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number
  action?: { label: string; onClick: () => void }
}

type Listener = (toasts: Toast[]) => void

// Module-level singleton so toast() works outside React
let _toasts: Toast[] = []
const _listeners: Set<Listener> = new Set()

function notify() {
  _listeners.forEach(l => l([..._toasts]))
}

let _idCounter = 0

export function toast(
  message: string,
  type: ToastType = 'info',
  duration = 4000,
  action?: Toast['action']
): string {
  const id = `toast-${++_idCounter}-${Date.now()}`
  const entry: Toast = { id, type, message, duration, action }
  _toasts = [..._toasts, entry]
  notify()

  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration)
  }
  return id
}

export function dismissToast(id: string) {
  _toasts = _toasts.filter(t => t.id !== id)
  notify()
}

export function clearAllToasts() {
  _toasts = []
  notify()
}

// Convenience shortcuts
toast.success = (msg: string, dur?: number, action?: Toast['action']) =>
  toast(msg, 'success', dur, action)
toast.error = (msg: string, dur?: number, action?: Toast['action']) =>
  toast(msg, 'error', dur ?? 6000, action)
toast.info = (msg: string, dur?: number, action?: Toast['action']) =>
  toast(msg, 'info', dur, action)
toast.warning = (msg: string, dur?: number, action?: Toast['action']) =>
  toast(msg, 'warning', dur, action)

// React hook to subscribe to toast state
export function useToastState(): Toast[] {
  const [toasts, setToasts] = useState<Toast[]>([..._toasts])

  useEffect(() => {
    const listener: Listener = updated => setToasts(updated)
    _listeners.add(listener)
    return () => { _listeners.delete(listener) }
  }, [])

  return toasts
}

// Hook for components that need to dispatch toasts
export function useToast() {
  const dismiss = useCallback((id: string) => dismissToast(id), [])
  const clear = useCallback(() => clearAllToasts(), [])

  return {
    toast,
    dismiss,
    clear,
  }
}
