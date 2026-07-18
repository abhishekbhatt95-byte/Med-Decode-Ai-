import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders } from "../_shared/cors.ts"
import {
  errorResponse,
  successResponse,
  logFailure,
  logRequest,
  getClientIp,
  validateTokenFormat,
  createServiceClient,
} from "../_shared/security.ts"

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()
    const clientIp = getClientIp(req)

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count, error: rateErr } = await supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', 'shared-result')
      .eq('ip_address', clientIp)
      .gt('created_at', fifteenMinutesAgo)

    if (!rateErr && count !== null && count >= 30) {
      return errorResponse('Too many requests. Please try again later.', 429, corsHeaders)
    }

    await logRequest(supabase, null, 'shared-result', clientIp)

    const url = new URL(req.url)
    const token = url.searchParams.get('token')

    if (!token || !validateTokenFormat(token)) {
      return errorResponse('Invalid or missing share token.', 400, corsHeaders)
    }

    const now = new Date().toISOString()
    const { data: link, error: linkError } = await supabase
      .from('shared_links')
      .select('document_id')
      .eq('token', token)
      .gt('expires_at', now)
      .maybeSingle()

    if (linkError || !link) {
      return errorResponse('This link has expired or is invalid.', 404, corsHeaders)
    }

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('name, document_type')
      .eq('id', link.document_id)
      .single()

    if (docError || !doc) {
      return errorResponse('Document not found.', 404, corsHeaders)
    }

    const { data: analyses, error: analysisError } = await supabase
      .from('analyses')
      .select('id, summary, structured_output, doctor_questions')
      .eq('document_id', link.document_id)
      .order('created_at', { ascending: false })
      .limit(1)

    if (analysisError || !analyses || analyses.length === 0) {
      return errorResponse('Analysis not found.', 404, corsHeaders)
    }

    const analysis = analyses[0]

    const { data: medicines } = await supabase
      .from('medicines')
      .select('*')
      .eq('analysis_id', analysis.id)

    return successResponse({ doc, analysis, medicines }, corsHeaders)
  } catch (err: any) {
    logFailure('shared-result', null, err.message)
    return errorResponse('Something went wrong. Please try again.', 500, getCorsHeaders(req))
  }
})
