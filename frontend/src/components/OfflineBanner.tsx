import React, { useEffect, useRef } from 'react'
import { useOffline } from '../hooks/useOffline'

export const OfflineBanner: React.FC = () => {
  const { isOffline, wasOffline } = useOffline()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showReconnected, setShowReconnected] = React.useState(false)

  useEffect(() => {
    if (wasOffline) {
      setShowReconnected(true)
      timerRef.current = setTimeout(() => setShowReconnected(false), 3000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [wasOffline])

  if (!isOffline && !showReconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-16 left-1/2 -translate-x-1/2 z-[9998] px-5 py-2.5 rounded-full text-white text-xs font-extrabold shadow-xl flex items-center gap-2 transition-all duration-500
        ${isOffline
          ? 'bg-red-600 border border-red-500'
          : 'bg-emerald-600 border border-emerald-500'
        }`}
    >
      {isOffline ? (
        <>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden="true" />
          You're offline — changes will sync when reconnected
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-white" aria-hidden="true" />
          Back online ✓
        </>
      )}
    </div>
  )
}
