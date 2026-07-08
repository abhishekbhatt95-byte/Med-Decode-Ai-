import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { getCorsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Token is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const now = new Date().toISOString()
    const { data: link, error: linkError } = await supabase
      .from('shared_links')
      .select('document_id')
      .eq('token', token)
      .gt('expires_at', now)
      .maybeSingle()

    if (linkError || !link) {
      return new Response(JSON.stringify({ error: 'Link has expired or is invalid.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('name, document_type')
      .eq('id', link.document_id)
      .single()

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: analyses, error: analysisError } = await supabase
      .from('analyses')
      .select('id, summary, structured_output, doctor_questions')
      .eq('document_id', link.document_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (analysisError || !analyses || analyses.length === 0) {
      return new Response(JSON.stringify({ error: 'Analysis not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const analysis = analyses[0]

    const { data: medicines } = await supabase
      .from('medicines')
      .select('*')
      .eq('analysis_id', analysis.id)

    return new Response(JSON.stringify({ doc, analysis, medicines }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Shared-result function error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
