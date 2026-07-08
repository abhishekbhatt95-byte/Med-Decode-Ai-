const LIMIT_WINDOW_MS = 15 * 60 * 1000 
const MAX_ATTEMPTS = 5
const STORAGE_KEY = 'meddecode_auth_attempts'

interface RateLimitStatus {
  allowed: boolean
  remainingAttempts: number
  resetTimeMs?: number
}


export function checkAuthRateLimit(): RateLimitStatus {
  try {
    const rawAttempts = localStorage.getItem(STORAGE_KEY)
    let attempts: number[] = rawAttempts ? JSON.parse(rawAttempts) : []
    
    
    const now = Date.now()
    attempts = attempts.filter(timestamp => now - timestamp < LIMIT_WINDOW_MS)
    
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
    
    if (attempts.length >= MAX_ATTEMPTS) {
      
      const oldestAttempt = attempts[0]
      const resetTimeMs = oldestAttempt + LIMIT_WINDOW_MS
      
      return {
        allowed: false,
        remainingAttempts: 0,
        resetTimeMs
      }
    }
    
    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - attempts.length
    }
  } catch (err) {
    console.error("Rate limiter check error:", err)
    
    return { allowed: true, remainingAttempts: 1 }
  }
}


export function recordAuthAttempt(): void {
  try {
    const rawAttempts = localStorage.getItem(STORAGE_KEY)
    let attempts: number[] = rawAttempts ? JSON.parse(rawAttempts) : []
    
    attempts.push(Date.now())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
  } catch (err) {
    console.error("Rate limiter record error:", err)
  }
}
