import { useState, useEffect } from 'react'

export interface OfflineState {
  isOffline: boolean
  wasOffline: boolean   // true if we just came back online
}

export function useOffline(): OfflineState {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true)
      setWasOffline(false)
    }
    const handleOnline = () => {
      setIsOffline(false)
      setWasOffline(true)
      // reset wasOffline after a moment so callers can react
      setTimeout(() => setWasOffline(false), 3000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  return { isOffline, wasOffline }
}
