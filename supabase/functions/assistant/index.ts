import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import {
  authenticateRequest,
  enforceRequestSize,
  sanitizeUserInput,
  escapeHtml,
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
    const sizeErr = enforceRequestSize(req, 20480)
    if (sizeErr) return errorResponse(sizeErr, 413, corsHeaders)

    const supabase = createServiceClient()

    const auth = await authenticateRequest(req, supabase)
    if (auth.error) return errorResponse(auth.error, 401, corsHeaders)
    userId = auth.userId

    let body: any
    try {
      body = await req.json()
    } catch (_) {
      return errorResponse('Malformed JSON payload.', 400, corsHeaders)
    }

    const { message, conversationHistory, currentPageContext } = body

    const sanitized = sanitizeUserInput(message, 1000)
    if (sanitized.rejected) {
      return errorResponse(sanitized.reason || 'Invalid message.', 400, corsHeaders)
    }
    const cleanMessage = sanitized.clean

    const safeHistory = Array.isArray(conversationHistory)
      ? conversationHistory.slice(-10)
      : []

    const clientIp = getClientIp(req)
    await logRequest(supabase, userId, 'assistant', clientIp)

    const today = new Date().toISOString().split('T')[0]

    const { data: allowed, error: usageErr } = await supabase.rpc('try_increment_daily_usage', {
      p_user_id: userId,
      p_date: today,
      p_cap: 30,
      p_feature: 'assistant_chat',
    })

    if (usageErr) {
      logFailure('assistant', userId, `Usage check failed: ${usageErr.message}`)
    } else if (!allowed) {
      return errorResponse(
        'Daily limit reached. You can send up to 30 messages to the Assistant per day.',
        429,
        corsHeaders
      )
    }

    let pageContextStr = ''
    const documentId = currentPageContext?.documentId

    if (documentId && isValidUUID(documentId)) {
      const { data: document } = await supabase
        .from('documents')
        .select('user_id, name')
        .eq('id', documentId)
        .maybeSingle()

      if (document && document.user_id === userId) {
        const { data: analyses } = await supabase
          .from('analyses')
          .select('id, summary, structured_output')
          .eq('document_id', documentId)
          .order('created_at', { ascending: false })
          .limit(1)

        const analysis = analyses && analyses.length > 0 ? analyses[0] : null
        if (analysis) {
          const { data: medicines } = await supabase
            .from('medicines')
            .select('*')
            .eq('analysis_id', analysis.id)

          pageContextStr = `CURRENT RESULT CONTEXT (The user is viewing this document):
Document Name: ${document.name}
Summary: ${analysis.summary}
Medicines: ${JSON.stringify(medicines || [])}
Abnormal Values: ${JSON.stringify(analysis.structured_output?.abnormalValues || [])}
Sections: ${JSON.stringify(analysis.structured_output?.sections || [])}`
        }
      }
    }

    const systemPrompt = `You are a medical assistant and navigation guide for MedDecode AI.
Your goal is to answer general questions about using MedDecode AI itself, explaining its features, and answering queries.
Features of MedDecode AI:
1. Upload Flow: Users can upload prescriptions, blood panels, lab reports, hospital bills, or labels (PDF, JPG, PNG, HEIC up to 20MB).
2. Dashboard: View past results, search files, or delete files (which complies with data rights).
3. Trends View: If they upload 2+ blood reports, they can select parameters (like HbA1c, glucose) and chart values over time.
4. Sharing: They can generate secure, read-only links to share results with their doctor (expires in 7 days).
5. Quota Limits: 10 free document analyses per day. 30 general chat messages per day.

Keep responses concise (max 3-4 sentences), comforting, and simple.
If the current result context below is populated, you may also answer questions about the specific report the user is viewing.
Always remind the user you are an AI assistant and they should consult their doctor for clinical decisions. Do not use markdown other than bullet points.

${pageContextStr}`

    const contents = []
    for (const msg of safeHistory) {
      if (!msg || !msg.text || typeof msg.text !== 'string') continue
      const role = msg.sender === 'user' ? 'user' : 'model'
      const text = msg.text.substring(0, 500)
      contents.push({ role, parts: [{ text }] })
    }
    contents.push({
      role: 'user',
      parts: [{ text: cleanMessage }],
    })

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`

    const { response, error: fetchErr } = await fetchWithGuard(
      geminiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      },
      15000,
      2
    )

    if (fetchErr || !response) {
      logFailure('assistant', userId, fetchErr || 'No response from Gemini')
      return errorResponse(fetchErr || 'AI service unavailable. Please try again.', 502, corsHeaders)
    }

    const geminiJson = await response.json()
    const rawAnswer = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const safeAnswer = escapeHtml(rawAnswer)

    return successResponse({ answer: safeAnswer }, corsHeaders)
  } catch (err: any) {
    logFailure('assistant', userId, err.message)
    return errorResponse('Something went wrong. Please try again.', 500, getCorsHeaders(req))
  }
})
