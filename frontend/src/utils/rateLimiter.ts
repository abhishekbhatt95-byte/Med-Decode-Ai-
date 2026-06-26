const LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5
const STORAGE_KEY = 'meddecode_auth_attempts'

interface RateLimitStatus {
  allowed: boolean
  remainingAttempts: number
  resetTimeMs?: number
}

/**
 * Checks if the client is allowed to perform an auth request.
 * Cleans up expired attempts from the window.
 */
export function checkAuthRateLimit(): RateLimitStatus {
  try {
    const rawAttempts = localStorage.getItem(STORAGE_KEY)
    let attempts: number[] = rawAttempts ? JSON.parse(rawAttempts) : []
    
    // Filter out attempts older than 15 minutes
    const now = Date.now()
    attempts = attempts.filter(timestamp => now - timestamp < LIMIT_WINDOW_MS)
    
    // Save cleaned list
    localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts))
    
    if (attempts.length >= MAX_ATTEMPTS) {
      // Find when the oldest attempt in the current window will expire
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
    // Fail-open for safety (so users aren't locked out due to local storage issues)
    return { allowed: true, remainingAttempts: 1 }
  }
}

/**
 * Records a new auth attempt.
 */
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
