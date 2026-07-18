import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(all\s+)?previous/i,
  /forget\s+(all\s+)?previous/i,
  /override\s+(all\s+)?system/i,
  /you\s+are\s+now\s+(?:a\s+)?(?:different|new|evil|unrestricted)/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /\b<\|(?:im_start|im_end|system|endoftext)\|>/i,
  /\[\s*INST\s*\]/i,
  /\[\s*\/?\s*SYS\s*\]/i,
  /pretend\s+(?:you\s+are|to\s+be|that)/i,
  /act\s+as\s+(?:if|though)\s+(?:you|your)\s+(?:system|instructions)/i,
  /reveal\s+(?:your|the)\s+(?:system|initial|original)\s+(?:prompt|instructions)/i,
  /what\s+(?:are|is)\s+your\s+(?:system|initial)\s+(?:prompt|instructions)/i,
  /repeat\s+(?:your|the)\s+(?:system|above)\s+(?:prompt|instructions|text)/i,
  /print\s+(?:your|the)\s+(?:system|initial)\s+(?:prompt|instructions)/i,
]

export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

export async function authenticateRequest(
  req: Request,
  supabase: SupabaseClient
): Promise<{ userId: string; error: null } | { userId: null; error: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { userId: null, error: 'Missing or malformed authorization header.' }
  }

  const token = authHeader.slice(7).trim()
  if (!token || token.length < 10 || token.length > 8192) {
    return { userId: null, error: 'Invalid authorization token.' }
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return { userId: null, error: 'Session expired or invalid. Please sign in again.' }
    }
    return { userId: userData.user.id, error: null }
  } catch (_) {
    return { userId: null, error: 'Authentication service unavailable.' }
  }
}

export function enforceRequestSize(req: Request, maxBytes: number): string | null {
  const contentLength = req.headers.get('content-length')
  if (contentLength) {
    const size = parseInt(contentLength, 10)
    if (!isNaN(size) && size > maxBytes) {
      return `Request too large. Maximum size is ${Math.round(maxBytes / 1024)}KB.`
    }
  }
  return null
}

export function sanitizeUserInput(text: string, maxLength: number): { clean: string; rejected: boolean; reason?: string } {
  if (!text || typeof text !== 'string') {
    return { clean: '', rejected: true, reason: 'Message is required.' }
  }

  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return { clean: '', rejected: true, reason: 'Message cannot be empty.' }
  }

  if (trimmed.length > maxLength) {
    return { clean: '', rejected: true, reason: `Message too long. Maximum ${maxLength} characters.` }
  }

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { clean: '', rejected: true, reason: 'Message contains disallowed content.' }
    }
  }

  let cleaned = trimmed
  cleaned = cleaned.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  cleaned = cleaned.replace(/<\/?(?:script|iframe|object|embed|form|input|button|textarea|select|style|link|meta|base)\b[^>]*>/gi, '')
  cleaned = cleaned.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
  cleaned = cleaned.replace(/javascript\s*:/gi, '')
  cleaned = cleaned.replace(/data\s*:\s*text\/html/gi, '')
  // deno-lint-ignore no-control-regex
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  return { clean: cleaned, rejected: false }
}

export function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export async function enforceReplayProtection(
  supabase: SupabaseClient,
  userId: string,
  endpoint: string,
  windowMs = 5000
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - windowMs).toISOString()
    const { count, error } = await supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('endpoint', endpoint)
      .gt('created_at', since)

    if (error) return false
    return (count ?? 0) >= 3
  } catch (_) {
    return false
  }
}

export async function logRequest(
  supabase: SupabaseClient,
  userId: string | null,
  endpoint: string,
  ip?: string
): Promise<void> {
  try {
    await supabase.from('request_logs').insert({
      user_id: userId,
      ip_address: ip || 'unknown',
      endpoint
    })
  } catch (_) {}
}

export async function fetchWithGuard(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  maxRetries = 2
): Promise<{ response: Response; error: null } | { response: null; error: string }> {
  let attempt = 0
  let delay = 1500

  while (attempt <= maxRetries) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(url, { ...options, signal: controller.signal })
      clearTimeout(timer)

      if (response.ok) {
        return { response, error: null }
      }

      if (response.status === 429) {
        if (attempt < maxRetries) {
          attempt++
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
          continue
        }
        return { response: null, error: 'AI service is temporarily busy. Please try again in a few moments.' }
      }

      if (response.status === 503 || response.status === 502) {
        if (attempt < maxRetries) {
          attempt++
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
          continue
        }
        return { response: null, error: 'AI service is temporarily unavailable. Please try again shortly.' }
      }

      if (response.status === 401 || response.status === 403) {
        return { response: null, error: 'AI service authentication failed. Please contact support.' }
      }

      const errText = await response.text().catch(() => '')
      logFailure('fetchWithGuard', null, `HTTP ${response.status}: ${errText.substring(0, 200)}`, { url: url.split('?')[0] })
      return { response: null, error: 'AI service returned an unexpected error. Please try again.' }
    } catch (err: any) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        if (attempt < maxRetries) {
          attempt++
          await new Promise(r => setTimeout(r, delay))
          delay *= 2
          continue
        }
        return { response: null, error: 'Request timed out. The AI service took too long to respond. Please try again.' }
      }

      if (attempt < maxRetries) {
        attempt++
        await new Promise(r => setTimeout(r, delay))
        delay *= 2
        continue
      }
      logFailure('fetchWithGuard', null, `Network error: ${err.message}`, { url: url.split('?')[0] })
      return { response: null, error: 'Network error. Please check your connection and try again.' }
    }
  }

  return { response: null, error: 'Service unavailable after multiple attempts.' }
}

export function errorResponse(
  message: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

export function successResponse(
  data: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

export function logFailure(
  endpoint: string,
  userId: string | null,
  errorMessage: string,
  metadata?: Record<string, unknown>
): void {
  const sanitizedError = errorMessage
    .replace(/key=[^&\s]+/gi, 'key=[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[JWT_REDACTED]')
    .substring(0, 500)

  console.error(JSON.stringify({
    ts: new Date().toISOString(),
    endpoint,
    userId: userId || 'anonymous',
    error: sanitizedError,
    ...(metadata || {})
  }))
}

export function getClientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || 'unknown'
}

export function validateTokenFormat(token: string): boolean {
  return typeof token === 'string'
    && token.length > 0
    && token.length <= 128
    && /^[a-zA-Z0-9_-]+$/.test(token)
}
