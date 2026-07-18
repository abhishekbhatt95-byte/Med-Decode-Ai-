import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import {
  authenticateRequest,
  enforceRequestSize,
  fetchWithGuard,
  errorResponse,
  successResponse,
  logFailure,
  logRequest,
  getClientIp,
  isValidUUID,
  createServiceClient,
} from '../_shared/security.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let userId: string | null = null

  try {
    const sizeErr = enforceRequestSize(req, 2048)
    if (sizeErr) return errorResponse(sizeErr, 413, corsHeaders)

    const supabase = createServiceClient()

    const auth = await authenticateRequest(req, supabase)
    if (auth.error) return errorResponse(auth.error, 401, corsHeaders)
    userId = auth.userId

    const clientIp = getClientIp(req)
    await logRequest(supabase, userId, 'voice-session-token', clientIp)

    if (req.method === 'POST') {
      let body: any
      try {
        body = await req.json()
      } catch (_) {
        return errorResponse('Malformed JSON payload.', 400, corsHeaders)
      }

      const { analysisId, modelKey, voiceSessionId, mode = 'voice', targetLanguage = 'en' } = body

      // translate mode doesn't require an analysisId — it's a stateless language session
      if (mode !== 'translate' && (!analysisId || !isValidUUID(analysisId))) {
        return errorResponse('Invalid analysis ID.', 400, corsHeaders)
      }
      if (mode === 'translate' && (!targetLanguage || typeof targetLanguage !== 'string')) {
        return errorResponse('Invalid targetLanguage.', 400, corsHeaders)
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: allowed, error: usageErr } = await supabase.rpc('try_increment_daily_usage', {
        p_user_id: userId,
        p_date: today,
        p_cap: 20,
        p_feature: 'live_session',
      })

      if (usageErr) {
        logFailure('voice-session-token', userId, `Usage check failed: ${usageErr.message}`)
      } else if (!allowed) {
        return errorResponse(
          'Daily limit reached. You can start up to 20 live sessions (voice/translation) per day.',
          429,
          corsHeaders
        )
      }

      // translate mode is standalone (no analysisId/document), so document-ownership check is intentionally skipped here — authenticateRequest() above still applies and is required.
      if (mode !== 'translate') {
        const { data: analysis, error: analysisErr } = await supabase
          .from('analyses')
          .select('id, document_id')
          .eq('id', analysisId)
          .single()

        if (analysisErr || !analysis) {
          return errorResponse('Analysis not found.', 404, corsHeaders)
        }

        const { data: doc, error: docErr } = await supabase
          .from('documents')
          .select('user_id')
          .eq('id', analysis.document_id)
          .single()

        if (docErr || !doc || doc.user_id !== userId) {
          return errorResponse('Access denied.', 403, corsHeaders)
        }
      }

      const TRANSLATE_MODEL = 'models/gemini-3.5-live-translate-preview'
      const VOICE_MODEL = 'models/gemini-2.5-flash-native-audio-latest'
      const modelUsed = mode === 'translate' ? TRANSLATE_MODEL : VOICE_MODEL

      let sessionId: string | null = null
      let reconnectSuccess = false

      if (voiceSessionId && isValidUUID(voiceSessionId)) {
        const { data: session } = await supabase
          .from('voice_sessions')
          .select('*')
          .eq('id', voiceSessionId)
          .eq('user_id', userId)
          .maybeSingle()

        if (session) {
          const timeMark = session.ended_at || session.started_at
          const diff = Math.abs(Date.now() - new Date(timeMark).getTime())
          if (diff <= 5000) {
            const { data: updatedSession } = await supabase
              .from('voice_sessions')
              .update({
                reconnects: (session.reconnects || 0) + 1,
                ended_at: null,
              })
              .eq('id', session.id)
              .select()
              .single()

            if (updatedSession) {
              sessionId = updatedSession.id
              reconnectSuccess = true
            }
          }
        }
      }

      if (!reconnectSuccess) {
        const { data: recentSessions } = await supabase
          .from('voice_sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('analysis_id', analysisId)
          .order('started_at', { ascending: false })
          .limit(1)

        if (recentSessions && recentSessions.length > 0) {
          const session = recentSessions[0]
          const timeMark = session.ended_at || session.started_at
          const diff = Math.abs(Date.now() - new Date(timeMark).getTime())
          if (diff <= 5000) {
            const { data: updatedSession } = await supabase
              .from('voice_sessions')
              .update({
                reconnects: (session.reconnects || 0) + 1,
                ended_at: null,
              })
              .eq('id', session.id)
              .select()
              .single()

            if (updatedSession) {
              sessionId = updatedSession.id
              reconnectSuccess = true
            }
          }
        }
      }

      if (!reconnectSuccess) {
        const insertPayload: Record<string, any> = {
          user_id: userId,
          model_used: modelUsed,
          reconnects: 0,
          interruptions: 0,
          duration_seconds: 0,
        }
        // analysis_id is optional — translate sessions are not document-scoped
        if (mode !== 'translate' && analysisId) {
          insertPayload.analysis_id = analysisId
        }

        const { data: newSession, error: insertErr } = await supabase
          .from('voice_sessions')
          .insert(insertPayload)
          .select()
          .single()

        if (insertErr || !newSession) {
          logFailure('voice-session-token', userId, `Failed to create session: ${insertErr?.message}`)
          return errorResponse('Failed to create voice session.', 500, corsHeaders)
        }
        sessionId = newSession.id
      }

      const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''
      const expireTime = new Date(Date.now() + 60 * 1000).toISOString()
      const requestUrl = `https://generativelanguage.googleapis.com/v1alpha/auth_tokens?key=${geminiKey}`

      const tokenBody: Record<string, any> = {
        uses: 1,
        expire_time: expireTime,
        new_session_expire_time: expireTime,
        bidi_generate_content_setup: {
          model: modelUsed,
        },
      }

      let responseText = ''
      let responseStatus = 0
      let ok = false

      try {
        const res = await fetch(requestUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenBody),
        })
        responseStatus = res.status
        ok = res.ok
        responseText = await res.text()
      } catch (err: any) {
        responseText = `Fetch error: ${err.message}`
      }

      if (!ok) {
        logFailure(
          'voice-session-token',
          userId,
          `Gemini API failed. Status: ${responseStatus}. Body: ${responseText}`
        )
        return errorResponse(
          `Failed to initialize ${mode === 'translate' ? 'translation' : 'voice'} session. Please try again.`,
          502,
          corsHeaders
        )
      }

      const geminiData = JSON.parse(responseText)
      return successResponse(
        {
          token: geminiData.name,
          voiceSessionId: sessionId,
          mode,
        },
        corsHeaders
      )
    }

    if (req.method === 'PATCH') {
      let body: any
      try {
        body = await req.json()
      } catch (_) {
        return errorResponse('Malformed JSON payload.', 400, corsHeaders)
      }

      const { voiceSessionId, durationSeconds, interruptions } = body

      if (!voiceSessionId || !isValidUUID(voiceSessionId)) {
        return errorResponse('Invalid voice session ID.', 400, corsHeaders)
      }

      const safeDuration = typeof durationSeconds === 'number'
        ? Math.min(Math.max(0, Math.floor(durationSeconds)), 7200)
        : 0
      const safeInterruptions = typeof interruptions === 'number'
        ? Math.min(Math.max(0, Math.floor(interruptions)), 10000)
        : 0

      const { data: session, error: fetchErr } = await supabase
        .from('voice_sessions')
        .select('*')
        .eq('id', voiceSessionId)
        .eq('user_id', userId)
        .maybeSingle()

      if (fetchErr || !session) {
        return errorResponse('Voice session not found.', 404, corsHeaders)
      }

      const { data: updated, error: updateErr } = await supabase
        .from('voice_sessions')
        .update({
          duration_seconds: safeDuration,
          interruptions: safeInterruptions,
          ended_at: new Date().toISOString(),
        })
        .eq('id', voiceSessionId)
        .select()
        .single()

      if (updateErr) {
        logFailure('voice-session-token', userId, `Failed to end session: ${updateErr.message}`)
        return errorResponse('Failed to end voice session.', 500, corsHeaders)
      }

      return successResponse({ success: true, session: updated }, corsHeaders)
    }

    return errorResponse('Method not allowed.', 405, corsHeaders)
  } catch (err: any) {
    logFailure('voice-session-token', userId, err.message)
    return errorResponse('Something went wrong. Please try again.', 500, getCorsHeaders(req))
  }
})
