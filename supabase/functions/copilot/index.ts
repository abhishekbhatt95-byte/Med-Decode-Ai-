import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import {
  authenticateRequest,
  enforceRequestSize,
  sanitizeUserInput,
  escapeHtml,
  enforceReplayProtection,
  logRequest,
  fetchWithGuard,
  errorResponse,
  successResponse,
  logFailure,
  getClientIp,
  isValidUUID,
  createServiceClient,
} from '../_shared/security.ts'

const MODEL_MAP: Record<string, string> = {
  standard: 'gemini-3.5-flash',
  fast_lite: 'gemini-3.1-flash-lite',
  deep_pro: 'gemini-3.1-pro',
}

const ROLE_MAP: Record<string, string> = {
  default_clinical: `You are a medical assistant helping a patient understand their medical document. Explain findings in plain English.`,
  empathetic_advocate: `You are a warm, empathetic advocate. Use simple language, reduce anxiety, and avoid clinical jargon. Focus on comforting and guiding the patient.`,
  peer_physician: `You are a peer physician consulting with another practitioner. Use professional terminology, discuss differential diagnoses, evidence-oriented reasoning, and clearly label any uncertainty.`,
  billing_negotiator: `You are a billing negotiator analyzing a medical bill. Find potentially suspicious or duplicate charges, suggest dispute questions, but never claim fraud and never give legal advice.`,
}

const DISCLAIMER = "This information is educational and is not a substitute for professional medical advice."

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let userId: string | null = null

  try {
    const sizeErr = enforceRequestSize(req, 51200)
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

    const { conversationId, message, modelKey, roleKey, analysisId } = body

    const sanitized = sanitizeUserInput(message, 2000)
    if (sanitized.rejected) {
      return errorResponse(sanitized.reason || 'Invalid message.', 400, corsHeaders)
    }
    const cleanMessage = sanitized.clean

    if (!modelKey || !MODEL_MAP[modelKey]) {
      return errorResponse(`Unknown model selection.`, 400, corsHeaders)
    }

    const roleKeyNormalized = roleKey || 'default_clinical'
    if (!ROLE_MAP[roleKeyNormalized]) {
      return errorResponse(`Unknown persona selection.`, 400, corsHeaders)
    }

    const clientIp = getClientIp(req)
    const isReplay = await enforceReplayProtection(supabase, userId, 'copilot', 5000)
    if (isReplay) {
      return errorResponse('Too many requests. Please wait a few seconds.', 429, corsHeaders)
    }

    await logRequest(supabase, userId, 'copilot', clientIp)

    const modelUsed = MODEL_MAP[modelKey]

    const today = new Date().toISOString().split('T')[0]
    const capMap: Record<string, number> = {
      standard: 40,
      fast_lite: 100,
      deep_pro: 10,
    }
    const cap = capMap[modelKey]
    const featureName = `copilot_${modelKey}`

    const { data: allowed, error: usageErr } = await supabase.rpc('try_increment_daily_usage', {
      p_user_id: userId,
      p_date: today,
      p_cap: cap,
      p_feature: featureName,
    })

    if (usageErr) {
      logFailure('copilot', userId, `Usage check failed: ${usageErr.message}`)
    } else if (!allowed) {
      return errorResponse(
        `Daily limit reached for this model. You can send up to ${cap} messages per day.`,
        429,
        corsHeaders
      )
    }

    let conversationIdValue = conversationId
    let analysisIdValue = analysisId

    if (conversationIdValue) {
      if (!isValidUUID(conversationIdValue)) {
        return errorResponse('Invalid conversation ID.', 400, corsHeaders)
      }

      const { data: conv, error: convErr } = await supabase
        .from('chat_conversations')
        .select('user_id, analysis_id')
        .eq('id', conversationIdValue)
        .single()

      if (convErr || !conv) {
        return errorResponse('Conversation not found.', 404, corsHeaders)
      }

      if (conv.user_id !== userId) {
        return errorResponse('Access denied.', 403, corsHeaders)
      }

      if (conv.analysis_id) {
        analysisIdValue = conv.analysis_id
      }
    } else {
      const { data: newConv, error: newConvErr } = await supabase
        .from('chat_conversations')
        .insert({
          user_id: userId,
          analysis_id: analysisIdValue || null,
          role_persona: roleKeyNormalized,
          title: 'New Conversation',
        })
        .select('id')
        .single()

      if (newConvErr || !newConv) {
        logFailure('copilot', userId, `Failed to create conversation: ${newConvErr?.message}`)
        return errorResponse('Failed to create conversation.', 500, corsHeaders)
      }

      conversationIdValue = newConv.id
    }

    let analysisContext = ''
    if (analysisIdValue) {
      const { data: analysis } = await supabase
        .from('analyses')
        .select('summary, structured_output, doctor_questions, document_id')
        .eq('id', analysisIdValue)
        .single()

      if (analysis) {
        const { data: medicines } = await supabase
          .from('medicines')
          .select(
            'brand_name, generic_name, category, common_uses, how_it_works, side_effects, food_restrictions, precautions'
          )
          .eq('analysis_id', analysisIdValue)

        let docMeta: any = null
        if (analysis.document_id) {
          const { data: doc } = await supabase
            .from('documents')
            .select('name, document_type, created_at')
            .eq('id', analysis.document_id)
            .single()
          docMeta = doc
        }

        const so = analysis.structured_output || {}
        const abnormals = so.abnormalValues || []
        const sections = so.sections || []
        const medSummary = so.medicalSummary || ''

        const docTypePretty = (docMeta?.document_type || 'unknown').replace(/_/g, ' ')
        const docDate = docMeta?.created_at
          ? new Date(docMeta.created_at).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : 'Unknown'

        analysisContext = `
=== PATIENT REPORT CONTEXT (INVISIBLE TO USER — DO NOT REPEAT VERBATIM) ===

DOCUMENT METADATA:
- Document Name: ${docMeta?.name || 'Uploaded Document'}
- Document Type: ${docTypePretty}
- Upload Date: ${docDate}

GENERAL SUMMARY:
${analysis.summary}

${medSummary ? `CLINICAL SUMMARY:\n${medSummary}\n` : ''}
${abnormals.length > 0 ? `ABNORMAL / FLAGGED FINDINGS:\n${abnormals.map((a: any) => `- ${a.parameter}: ${a.value} (Normal range: ${a.referenceRange}) — ${a.explanation}`).join('\n')}\n` : ''}
${sections.length > 0 ? `DETECTED CONDITIONS & EXPLANATIONS:\n${sections.map((s: any) => `- ${s.title}: ${s.content}`).join('\n')}\n` : ''}
${medicines && medicines.length > 0 ? `PRESCRIBED MEDICINES:\n${medicines.map((m: any) => `- ${m.brand_name} (${m.generic_name || 'N/A'}): ${m.common_uses || 'N/A'}. Side effects: ${m.side_effects || 'N/A'}. Food: ${m.food_restrictions || 'N/A'}. Precautions: ${m.precautions || 'N/A'}.`).join('\n')}\n` : ''}
${analysis.doctor_questions && analysis.doctor_questions.length > 0 ? `SUGGESTED DOCTOR QUESTIONS:\n${analysis.doctor_questions.map((q: string) => `- ${q}`).join('\n')}\n` : ''}
=== END OF REPORT CONTEXT ===`
      }
    }

    const rolePrompt = ROLE_MAP[roleKeyNormalized]
    const systemPrompt = `${rolePrompt}
${analysisContext}

STRICT RULES — FOLLOW AT ALL TIMES:
1. PRIORITIZE REPORT CONTENTS: Always answer using the patient's actual report data above. The report context is your primary source of truth.
2. NEVER INVENT VALUES: Do not fabricate lab values, dosages, parameters, or findings. If a value is not present in the report context, say "this was not found in your report."
3. SEPARATE YOUR RESPONSE INTO CLEAR CATEGORIES:
   - REPORT FACTS: Direct observations from the document (e.g., "Your hemoglobin is 10.2 g/dL, which is below the normal range of 12-16 g/dL").
   - INTERPRETATION: What these findings may indicate in clinical context (e.g., "This could suggest mild anemia").
   - GENERAL EDUCATION: Broader context that is not specific to this report (e.g., "Anemia can be caused by iron deficiency, chronic disease, or blood loss").
   Always clearly distinguish between what the report says vs. your clinical interpretation vs. general medical knowledge.
4. The report context above is INVISIBLE to the user. Never say "based on the context I was given" — instead say "based on your report" or "according to your document."
5. You are an AI assistant. Remind the user that clinical decisions must involve their doctor. Do not use markdown formatting.`

    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationIdValue)
      .order('created_at', { ascending: true })

    const geminiMessages: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

    if (dbMessages && dbMessages.length > 0) {
      const chatHistory = dbMessages.filter((m) => m.role === 'user' || m.role === 'assistant')

      if (chatHistory.length > 0) {
        const firstUser = chatHistory[0].role === 'user' ? chatHistory[0] : null
        const firstModel =
          chatHistory.length > 1 && chatHistory[1].role === 'assistant' ? chatHistory[1] : null

        let startIdx = 0
        if (firstUser) startIdx = 1
        if (firstUser && firstModel) startIdx = 2

        const recentHistory = chatHistory.slice(startIdx)

        let totalTokens = 0
        const keptRecent: typeof recentHistory = []
        for (let i = recentHistory.length - 1; i >= 0; i--) {
          const msg = recentHistory[i]
          const msgTokens = Math.ceil(msg.content.length / 4)
          if (keptRecent.length >= 16 || totalTokens + msgTokens > 8000) {
            break
          }
          keptRecent.unshift(msg)
          totalTokens += msgTokens
        }

        if (firstUser) {
          geminiMessages.push({ role: 'user', parts: [{ text: firstUser.content }] })
        }
        if (firstUser && firstModel) {
          geminiMessages.push({ role: 'model', parts: [{ text: firstModel.content }] })
        }

        let lastRole =
          geminiMessages.length > 0 ? geminiMessages[geminiMessages.length - 1].role : null

        for (const msg of keptRecent) {
          const gRole = msg.role === 'user' ? 'user' : 'model'
          if (gRole === lastRole) {
            continue
          }
          geminiMessages.push({ role: gRole, parts: [{ text: msg.content }] })
          lastRole = gRole
        }
      }
    }

    await supabase.from('chat_messages').insert({
      conversation_id: conversationIdValue,
      role: 'user',
      content: cleanMessage,
      model_used: modelUsed,
      token_count: Math.ceil(cleanMessage.length / 4),
      status: 'completed',
    })

    geminiMessages.push({
      role: 'user',
      parts: [{ text: cleanMessage }],
    })

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:streamGenerateContent?key=${geminiKey}`

    let accumulatedAnswer = ''
    let completed = false

    const handleAbort = async () => {
      if (completed) return
      completed = true
      if (accumulatedAnswer.trim()) {
        const partialAnswer = escapeHtml(`${accumulatedAnswer.trim()}\n\n[Interrupted] ${DISCLAIMER}`)
        await supabase.from('chat_messages').insert({
          conversation_id: conversationIdValue,
          role: 'assistant',
          content: partialAnswer,
          model_used: modelUsed,
          token_count: Math.ceil(partialAnswer.length / 4),
          status: 'cancelled',
        })
      }
    }

    req.signal.addEventListener('abort', handleAbort)

    const { response, error: fetchErr } = await fetchWithGuard(
      geminiUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
          },
        }),
      },
      30000,
      2
    )

    if (fetchErr || !response) {
      logFailure('copilot', userId, fetchErr || 'No response from Gemini')
      return errorResponse(fetchErr || 'AI service unavailable. Please try again.', 502, corsHeaders)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    let streamBuffer = ''

    if (reader) {
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          streamBuffer += decoder.decode(value, { stream: true })

          let cleaned = streamBuffer.trim()
          if (cleaned.startsWith('[')) {
            cleaned = cleaned.substring(1).trim()
          }
          if (cleaned.startsWith(',')) {
            cleaned = cleaned.substring(1).trim()
          }

          let braceCount = 0
          let startIdx = -1
          for (let i = 0; i < cleaned.length; i++) {
            if (cleaned[i] === '{') {
              if (braceCount === 0) startIdx = i
              braceCount++
            } else if (cleaned[i] === '}') {
              braceCount--
              if (braceCount === 0 && startIdx !== -1) {
                const jsonStr = cleaned.substring(startIdx, i + 1)
                try {
                  const parsed = JSON.parse(jsonStr)
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    accumulatedAnswer += text
                  }
                } catch (_) {}
                cleaned = cleaned.substring(i + 1).trim()
                if (cleaned.startsWith(',')) {
                  cleaned = cleaned.substring(1).trim()
                }
                streamBuffer = cleaned
                i = -1
                startIdx = -1
              }
            }
          }
        }
      } catch (streamErr: any) {
        logFailure('copilot', userId, `Stream read error: ${streamErr.message}`)
      }
    }

    const rawAnswer = accumulatedAnswer.trim()
    const safeAnswer = escapeHtml(rawAnswer)
    const finalAnswer = `${safeAnswer}\n\n${DISCLAIMER}`

    if (completed) {
      return successResponse(
        {
          conversationId: conversationIdValue,
          answer: escapeHtml(`${rawAnswer}\n\n[Interrupted] ${DISCLAIMER}`),
          modelUsed,
        },
        corsHeaders
      )
    } else {
      completed = true
      req.signal.removeEventListener('abort', handleAbort)

      await supabase.from('chat_messages').insert({
        conversation_id: conversationIdValue,
        role: 'assistant',
        content: finalAnswer,
        model_used: modelUsed,
        token_count: Math.ceil(finalAnswer.length / 4),
        status: 'completed',
      })

      return successResponse(
        {
          conversationId: conversationIdValue,
          answer: finalAnswer,
          modelUsed,
        },
        corsHeaders
      )
    }
  } catch (err: any) {
    logFailure('copilot', userId, err.message)
    return errorResponse('Something went wrong. Please try again.', 500, getCorsHeaders(req))
  }
})
