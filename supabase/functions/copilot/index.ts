import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { getCorsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MODEL_MAP: Record<string, string> = {
  standard: 'gemini-3.5-flash',
  fast_lite: 'gemini-3.1-flash-lite',
  deep_pro: 'gemini-3.1-pro'
}

const ROLE_MAP: Record<string, string> = {
  default_clinical: `You are a medical assistant helping a patient understand their medical document. Explain findings in plain English.`,
  empathetic_advocate: `You are a warm, empathetic advocate. Use simple language, reduce anxiety, and avoid clinical jargon. Focus on comforting and guiding the patient.`,
  peer_physician: `You are a peer physician consulting with another practitioner. Use professional terminology, discuss differential diagnoses, evidence-oriented reasoning, and clearly label any uncertainty.`,
  billing_negotiator: `You are a billing negotiator analyzing a medical bill. Find potentially suspicious or duplicate charges, suggest dispute questions, but never claim fraud and never give legal advice.`
}

const DISCLAIMER = "This information is educational and is not a substitute for professional medical advice."

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { conversationId, message, modelKey, roleKey, analysisId } = await req.json()

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Message is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!modelKey || !MODEL_MAP[modelKey]) {
      return new Response(JSON.stringify({ error: `Unknown modelKey: ${modelKey}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const roleKeyNormalized = roleKey || 'default_clinical'
    if (!ROLE_MAP[roleKeyNormalized]) {
      return new Response(JSON.stringify({ error: `Unknown roleKey: ${roleKey}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = userData.user.id
    const modelUsed = MODEL_MAP[modelKey]

    const today = new Date().toISOString().split('T')[0]
    const capMap: Record<string, number> = {
      standard: 40,
      fast_lite: 100,
      deep_pro: 10
    }
    const cap = capMap[modelKey]
    const featureName = `copilot_${modelKey}`

    const { data: allowed, error: usageErr } = await supabase
      .rpc('try_increment_daily_usage', {
        p_user_id: userId,
        p_date: today,
        p_cap: cap,
        p_feature: featureName
      })

    if (usageErr) {
      console.error("Failed to check and increment usage limits:", usageErr.message)
    } else if (!allowed) {
      return new Response(JSON.stringify({ error: `Daily limit exceeded for ${modelKey}. Limit is ${cap} requests per day.` }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let conversationIdValue = conversationId
    let analysisIdValue = analysisId

    if (conversationIdValue) {
      if (!UUID_REGEX.test(conversationIdValue)) {
        return new Response(JSON.stringify({ error: 'Invalid conversationId.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: conv, error: convErr } = await supabase
        .from('chat_conversations')
        .select('user_id, analysis_id')
        .eq('id', conversationIdValue)
        .single()

      if (convErr || !conv) {
        return new Response(JSON.stringify({ error: 'Conversation not found.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (conv.user_id !== userId) {
        return new Response(JSON.stringify({ error: 'Access denied.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
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
          title: 'New Conversation'
        })
        .select('id')
        .single()

      if (newConvErr || !newConv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      conversationIdValue = newConv.id
    }

    let analysisContext = ''
    if (analysisIdValue) {
      const { data: analysis } = await supabase
        .from('analyses')
        .select('summary, structured_output')
        .eq('id', analysisIdValue)
        .single()

      if (analysis) {
        const { data: medicines } = await supabase
          .from('medicines')
          .select('brand_name, generic_name, category, common_uses')
          .eq('analysis_id', analysisIdValue)

        analysisContext = `Medical Analysis Context:
Summary: ${analysis.summary}
Medicines: ${JSON.stringify(medicines || [])}
Abnormal Values: ${JSON.stringify(analysis.structured_output?.abnormalValues || [])}
Sections: ${JSON.stringify(analysis.structured_output?.sections || [])}`
      }
    }

    const rolePrompt = ROLE_MAP[roleKeyNormalized]
    const systemPrompt = `${rolePrompt}
${analysisContext}

Ensure your answers are accurate to the medical document context if provided. If asked about a medicine/finding not in this document, advise consulting their doctor. Remind them you are an AI and they should consult their doctor for clinical decisions. Do not use markdown.`

    const { data: dbMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('conversation_id', conversationIdValue)
      .order('created_at', { ascending: true })

    const geminiMessages: { role: 'user' | 'model'; parts: { text: string }[] }[] = []

    if (dbMessages && dbMessages.length > 0) {
      const chatHistory = dbMessages.filter(m => m.role === 'user' || m.role === 'assistant')

      if (chatHistory.length > 0) {
        const firstUser = chatHistory[0].role === 'user' ? chatHistory[0] : null
        const firstModel = (chatHistory.length > 1 && chatHistory[1].role === 'assistant') ? chatHistory[1] : null

        let startIdx = 0
        if (firstUser) startIdx = 1
        if (firstUser && firstModel) startIdx = 2

        const recentHistory = chatHistory.slice(startIdx)

        let totalTokens = 0
        const keptRecent: typeof recentHistory = []
        for (let i = recentHistory.length - 1; i >= 0; i--) {
          const msg = recentHistory[i]
          const msgTokens = Math.ceil(msg.content.length / 4)
          if (keptRecent.length >= 16 || (totalTokens + msgTokens) > 8000) {
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

        let lastRole = geminiMessages.length > 0 ? geminiMessages[geminiMessages.length - 1].role : null

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

    await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationIdValue,
        role: 'user',
        content: message,
        model_used: modelUsed,
        token_count: Math.ceil(message.length / 4),
        status: 'completed'
      })

    geminiMessages.push({
      role: 'user',
      parts: [{ text: message }]
    })

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:streamGenerateContent?key=${geminiKey}`

    let accumulatedAnswer = ''
    let completed = false

    const handleAbort = async () => {
      if (completed) return
      completed = true
      if (accumulatedAnswer.trim()) {
        const partialAnswer = `${accumulatedAnswer.trim()}\n\n[Interrupted] ${DISCLAIMER}`
        await supabase.from('chat_messages').insert({
          conversation_id: conversationIdValue,
          role: 'assistant',
          content: partialAnswer,
          model_used: modelUsed,
          token_count: Math.ceil(partialAnswer.length / 4),
          status: 'cancelled'
        })
      }
    }

    req.signal.addEventListener('abort', handleAbort)

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiMessages,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Gemini stream error: ${await response.text()}`)
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
                } catch (_) {
                  // Wait for more data
                }
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
      } catch (streamErr) {
        console.error('Error during streaming read:', streamErr)
      }
    }

    const finalAnswer = `${accumulatedAnswer.trim()}\n\n${DISCLAIMER}`

    if (completed) {
      return new Response(JSON.stringify({
        conversationId: conversationIdValue,
        answer: `${accumulatedAnswer.trim()}\n\n[Interrupted] ${DISCLAIMER}`,
        modelUsed
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } else {
      completed = true
      req.signal.removeEventListener('abort', handleAbort)

      await supabase.from('chat_messages').insert({
        conversation_id: conversationIdValue,
        role: 'assistant',
        content: finalAnswer,
        model_used: modelUsed,
        token_count: Math.ceil(finalAnswer.length / 4),
        status: 'completed'
      })

      return new Response(JSON.stringify({
        conversationId: conversationIdValue,
        answer: finalAnswer,
        modelUsed
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  } catch (err) {
    console.error('Copilot function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
