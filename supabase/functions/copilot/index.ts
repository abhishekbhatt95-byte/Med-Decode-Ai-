import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8'
import { getCorsHeaders } from '../_shared/cors.ts'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { analysisId, question } = await req.json()

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Question is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (question.length > 500) {
      return new Response(JSON.stringify({ error: 'Question is too long (max 500 characters).' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!analysisId || !UUID_REGEX.test(analysisId)) {
      return new Response(JSON.stringify({ error: 'Invalid analysisId.' }), {
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

    const { data: analysis, error: analysisError } = await supabase
      .from('analyses')
      .select('id, summary, structured_output, doctor_questions, document_id')
      .eq('id', analysisId)
      .single()

    if (analysisError || !analysis) {
      return new Response(JSON.stringify({ error: 'Analysis not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('user_id')
      .eq('id', analysis.document_id)
      .single()

    if (docError || !document) {
      return new Response(JSON.stringify({ error: 'Document not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (document.user_id !== userId) {
      return new Response(JSON.stringify({ error: 'Access denied.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: medicines } = await supabase
      .from('medicines')
      .select('*')
      .eq('analysis_id', analysisId)

    const prompt = `You are a medical assistant helping a patient understand their medical document.
Summary: ${analysis.summary}
Medicines: ${JSON.stringify(medicines || [])}
Abnormal Values: ${JSON.stringify(analysis.structured_output?.abnormalValues || [])}
Sections: ${JSON.stringify(analysis.structured_output?.sections || [])}
Patient's Question: "${question}"
Provide a brief, comforting, plain English response (max 3-4 sentences). If asked about a medicine not in this document, advise consulting their doctor. Remind them you are an AI and they should consult their doctor for clinical decisions. Do not use markdown.`

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ error: 'AI service unavailable.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiJson = await geminiRes.json()
    const answer = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || ''

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Copilot function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
