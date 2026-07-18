/**
 * Retry a promise-returning function with exponential backoff.
 *
 * @param fn - The async function to retry
 * @param options.maxAttempts - Maximum number of attempts (default: 3)
 * @param options.baseDelay - Initial delay in ms (default: 500)
 * @param options.maxDelay - Maximum delay cap in ms (default: 8000)
 * @param options.shouldRetry - Optional predicate; returning false stops retries
 * @param options.signal - Optional AbortSignal to cancel retries
 */

export interface RetryOptions {
  maxAttempts?: number
  baseDelay?: number
  maxDelay?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  signal?: AbortSignal
  onRetry?: (attempt: number, delay: number, error: unknown) => void
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 500,
    maxDelay = 8000,
    shouldRetry,
    signal,
    onRetry,
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    try {
      return await fn()
    } catch (err) {
      lastError = err

      // Don't retry on abort
      if (err instanceof DOMException && err.name === 'AbortError') throw err
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      // Custom predicate
      if (shouldRetry && !shouldRetry(err, attempt)) throw err

      // Last attempt — rethrow
      if (attempt === maxAttempts) break

      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1) + Math.random() * 200, maxDelay)
      onRetry?.(attempt, delay, err)
      await sleep(delay, signal)
    }
  }

  throw lastError
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))

    const timeout = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}
