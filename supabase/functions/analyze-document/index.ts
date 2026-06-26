import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function maskPII(text: string): string {
  if (!text) return ""
  let masked = text
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_MASKED]')
  masked = masked.replace(/\b(\+?\d{1,3}[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}\b/g, '[PHONE_MASKED]')
  masked = masked.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[NATIONAL_ID_MASKED]')
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_MASKED]')
  return masked
}

// Fetch with a timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch (err: any) {
    clearTimeout(timer)
    if (err.name === 'AbortError') throw new Error(`Request timed out after ${timeoutMs / 1000}s`)
    throw err
  }
}

// Fetch with Retry (handles 429 and 503 errors with exponential backoff)
async function fetchWithRetry(url: string, options: RequestInit, timeoutMs: number, maxRetries = 3): Promise<Response> {
  let attempt = 0
  let delay = 2000 // 2 seconds initial delay
  
  while (attempt < maxRetries) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs)
      if (response.status === 200) {
        return response
      }
      
      if (response.status === 429 || response.status === 503) {
        console.warn(`Request to ${url} returned ${response.status}. Retrying in ${delay / 1000}s (Attempt ${attempt + 1}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        attempt++
        delay *= 2
        continue
      }
      
      return response
    } catch (err: any) {
      console.warn(`Request to ${url} threw error: ${err.message}. Retrying in ${delay / 1000}s (Attempt ${attempt + 1}/${maxRetries})...`)
      await new Promise(resolve => setTimeout(resolve, delay))
      attempt++
      delay *= 2
      if (attempt >= maxRetries) throw err
    }
  }
  
  // Final attempt if retries exhausted
  return fetchWithTimeout(url, options, timeoutMs)
}// Run OCR using OCR.space with a specific OCREngine
async function runOcr(fileUrl: string, isPdf: boolean, ocrSpaceKey: string, engine: string): Promise<string> {
  const formData = new FormData()
  formData.append('url', fileUrl)
  formData.append('language', 'eng')
  formData.append('isOverlayRequired', 'false')
  formData.append('detectOrientation', 'true')
  formData.append('scale', 'true')
  formData.append('OCREngine', engine)
  if (isPdf && engine !== '3') {
    formData.append('isCreateSearchablePdf', 'false')
  }

  console.log(`Calling OCR.space with Engine ${engine}...`)
  const ocrResponse = await fetchWithTimeout(
    'https://api.ocr.space/parse/image',
    { method: 'POST', headers: { 'apikey': ocrSpaceKey }, body: formData },
    30000 // 30 second timeout
  )

  const ocrText = await ocrResponse.text()
  let ocrJson: any
  try {
    ocrJson = JSON.parse(ocrText)
  } catch (err: any) {
    throw new Error(`Failed to parse OCR response JSON: ${err.message}. Raw response: ${ocrText.substring(0, 500)}`)
  }
  console.log(`OCR Engine ${engine} exit code:`, ocrJson.OCRExitCode)

  const parsedResults = ocrJson.ParsedResults
  const hasText = parsedResults?.some((r: any) => r.ParsedText?.trim().length > 5)

  if (ocrJson.IsErroredOnProcessing && !hasText) {
    const errMsg = Array.isArray(ocrJson.ErrorMessage)
      ? ocrJson.ErrorMessage.join(', ')
      : (ocrJson.ErrorMessage || 'Unknown OCR error')
    throw new Error(`OCR error: ${errMsg}`)
  }

  let extractedText = ""
  if (parsedResults?.length > 0) {
    extractedText = parsedResults
      .filter((r: any) => r.ParsedText?.trim().length > 0 && !r.ParsedText.includes('extraction limited'))
      .map((r: any) => r.ParsedText)
      .join('\n')
      .trim()
  }

  if (!extractedText || extractedText.length < 10) {
    throw new Error('No readable text found in document.')
  }

  return extractedText
}

function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = "";
  const len = uint8.byteLength;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    const subarr = uint8.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(null, subarr as any);
  }
  return btoa(binary);
}

function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const firstNewlineIndex = cleaned.indexOf("\n");
    if (firstNewlineIndex !== -1) {
      cleaned = cleaned.substring(firstNewlineIndex + 1);
    } else {
      cleaned = cleaned.substring(3);
    }
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  let documentId: string | null = null

  try {
    // 1. Sanitize and validate request payload size
    const contentLength = req.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 1000) {
      return new Response(JSON.stringify({ error: "Payload too large. Limit is 1KB." }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Validate JSON format
    let body: any
    try {
      body = await req.json()
    } catch (_) {
      return new Response(JSON.stringify({ error: "Malformed JSON payload" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 3. Validate documentId format (UUID regex)
    documentId = body?.documentId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!documentId || typeof documentId !== 'string' || !uuidRegex.test(documentId)) {
      return new Response(JSON.stringify({ error: "Invalid or malformed documentId" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 4. Resolve client IP and auth user
    const clientIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id || null
      } catch (_) { /* ignore invalid token */ }
    }

    // 5. Rate limit check: max 5 requests per 15 minutes per IP/User
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    let query = supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', 'analyze-document')
      .gt('created_at', fifteenMinutesAgo)

    if (userId) {
      query = query.or(`ip_address.eq.${clientIp},user_id.eq.${userId}`)
    } else {
      query = query.eq('ip_address', clientIp)
    }

    const { count, error: countErr } = await query
    if (countErr) {
      console.error("Failed to query rate limits:", countErr.message)
    } else if (count !== null && count >= 5) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 5 requests per 15 minutes." }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Log request
    await supabase.from('request_logs').insert({
      ip_address: clientIp,
      user_id: userId,
      endpoint: 'analyze-document'
    })

    // 1. Fetch Document Info
    const { data: document, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docErr || !document) {
      throw new Error(`Failed to fetch document: ${docErr?.message || 'Not found'}`)
    }

    // Update status to processing
    await supabase.from('documents').update({ status: 'processing' }).eq('id', documentId)

    // Delete any existing OCR results, extracted text, and analyses for this document to prevent duplicate entries
    await supabase.from('analyses').delete().eq('document_id', documentId)
    await supabase.from('extracted_text').delete().eq('document_id', documentId)
    await supabase.from('ocr_results').delete().eq('document_id', documentId)

    // 2. Create a signed URL (no download needed - OCR.space fetches it directly)
    const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
      .from('Med Decode Ai')
      .createSignedUrl(document.file_path, 300)

    if (signedUrlErr || !signedUrlData?.signedUrl) {
      throw new Error(`Could not create signed URL: ${signedUrlErr?.message}`)
    }

    const fileUrl = signedUrlData.signedUrl
    const mimeType = document.mime_type || 'image/jpeg'
    const isPdf = mimeType === 'application/pdf' || document.file_path?.endsWith('.pdf')

    console.log(`Processing: ${document.name} (${isPdf ? 'PDF' : 'image'})`)

    // Pre-fetch file contents for multimodal vision input if size < 15MB
    let base64Data = ""
    let includeFile = false
    const sizeInMb = document.size / (1024 * 1024)
    let geminiMimeType = mimeType

    if (geminiMimeType === 'image/jpg') {
      geminiMimeType = 'image/jpeg'
    } else if (document.file_path?.toLowerCase().endsWith('.heic')) {
      geminiMimeType = 'image/heic'
    } else if (document.file_path?.toLowerCase().endsWith('.heif')) {
      geminiMimeType = 'image/heif'
    }

    if (sizeInMb < 21) {
      try {
        console.log(`Fetching document file from storage: ${fileUrl.substring(0, 80)}...`)
        const fileResponse = await fetch(fileUrl)
        if (fileResponse.ok) {
          const fileBuffer = await fileResponse.arrayBuffer()
          const uint8Array = new Uint8Array(fileBuffer)
          base64Data = uint8ArrayToBase64(uint8Array)
          includeFile = true
          console.log(`Document file base64 encoded successfully. Length: ${base64Data.length} chars.`)
        } else {
          console.warn(`Failed to fetch file from storage: ${fileResponse.statusText}`)
        }
      } catch (fileErr: any) {
        console.warn(`Failed to retrieve or base64 encode file: ${fileErr.message}`)
      }
    } else {
      console.log(`File size (${sizeInMb.toFixed(2)} MB) is 21MB or larger. Skipping inline file transmission.`)
    }

    // 3. OCR via OCR.space (with 30s timeout)
    let extractedText = ""
    const ocrProvider = "ocr_space"
    const ocrSpaceKey = Deno.env.get('OCR_SPACE_API_KEY') || 'helloworld'

    try {
      // Try Engine 3 first as it is designed for high-accuracy and handwriting (doctor prescriptions)
      try {
        extractedText = await runOcr(fileUrl, isPdf, ocrSpaceKey, '3')
        console.log(`OCR Engine 3 succeeded. Text length: ${extractedText.length}`)
      } catch (engine3Err: any) {
        console.warn(`OCR Engine 3 failed: ${engine3Err.message}. Falling back to Engine 1...`)
        // Fallback to Engine 1 (standard speed/printed engine)
        extractedText = await runOcr(fileUrl, isPdf, ocrSpaceKey, '1')
        console.log(`OCR Engine 1 (fallback) succeeded. Text length: ${extractedText.length}`)
      }
    } catch (ocrErr: any) {
      console.warn("OCR failed on all engines, but will attempt to proceed with multimodal Gemini analysis:", ocrErr.message)
      await supabase.from('ocr_failures').insert({
        document_id: documentId,
        provider: ocrProvider,
        error_message: ocrErr.message
      })

      if (!includeFile) {
        await supabase.from('documents').update({ status: 'failed' }).eq('id', documentId)
        throw ocrErr
      }
    }

    // Save extracted text (if we got any)
    if (extractedText) {
      await supabase.from('extracted_text').insert({
        document_id: documentId,
        raw_text: extractedText,
        ocr_provider: ocrProvider,
        confidence: 0.90
      })

      await supabase.from('ocr_results').insert({
        document_id: documentId,
        provider: ocrProvider,
        raw_output: { textLength: extractedText.length },
        duration_ms: 0
      })
    }

    // 4. AI Analysis using Google Gemini (multimodal)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY not configured")

    const prompt = `You are a medical document translator and an expert in deciphering doctor handwriting, clinical reports, and laboratory panels.
Your task is to analyze the medical document provided (which may contain multiple pages, diagrams, handwritten notes, printed charts, or bills).
You are given a raw OCR text extraction of the document (note: this OCR may be partial, incomplete, or cover only the first page), and the actual document file itself as a multimodal image/PDF.

OCR Text:
${maskPII(extractedText.substring(0, 4000))}

Please perform a deep, comprehensive analysis of both the OCR text and the visual document across ALL pages to transcribe and translate all information accurately.

Instructions:
1. MULTI-PAGE ANALYSIS: Scan every single page of the document. Do not stop after the first page. Keep scrolling through all pages to capture all prescriptions, doctor handwritten notes, diagnostic reports, vitals, and lab values.
2. DECIPHER HANDWRITING: Carefully examine any handwritten sections. Focus on transcribing all written notes, prescription items, medicine names, dosages, and clinical impressions. Do not skip any handwritten text. Cross-reference scribbled or partially-readable words with known medications, medical conditions, and therapeutic dosages (e.g. Voveran, Mecobalamin, Diclofenac, etc.).
3. SUPPORT ALL MEDICAL DOCUMENT TYPES:
   - PRESCRIPTIONS: Extract all medicine brand names, generic names, categories, common uses, side effects, food restrictions, and precautions.
   - BLOOD REPORTS & LAB PANELS: Identify all tested parameters (e.g. hemoglobin, lipid profile, thyroid levels, blood sugar). Find any values outside the normal reference range, and list them in the "abnormalValues" array with parameter, value, referenceRange, and a simple explanation of what it means.
   - DIAGNOSTIC REPORTS (Ultrasound, ECG, X-Ray, CT/MRI): Extract clinical impressions, organ measurements, and heart rhythm status. Define abnormal or key diagnostic findings (e.g., kidney hydronephrosis, gallstones, ECG lead warnings) in "abnormalValues".
   - DISCHARGE SUMMARIES / CONSULTATION SLIPS: Summarize the primary diagnosis, symptoms, clinical examinations, and post-discharge care instructions.
4. TRANSLATE MEDICAL SHORT-HAND: Translate common medical abbreviations and Latin symbols (e.g., OD, BD, TDS, HS, PRN, QID, p.c., a.c., SOS, stat) into plain English instructions (e.g., Once daily, Twice daily, Three times daily, At bedtime, As needed, Four times daily, After food, Before food, In emergency, Immediately).
5. EXPLAIN CLINICAL TERMS: In the "explanation.sections" field, define and explain any medical terms, clinical conditions, or diagnostic findings mentioned (e.g., hydronephrosis, sinus rhythm, lead off, hyperlipidemia) in comforting, patient-friendly, plain English terms.
6. NON-MEDICAL REJECTION: If the document is completely unrelated to medical care (e.g., a fee receipt, invoice, design document, bank statement, ID card), set "isMedical" to false.

Return ONLY valid JSON (no markdown block, no explanation) matching this exact format:
{
  "isMedical": boolean,
  "documentType": "prescription" | "blood_report" | "diagnostic_report" | "hospital_bill" | "discharge_summary" | "medicine_label" | "unknown",
  "summary": "A 2-3 sentence plain English overview of what the document is, its main findings, and the general clinical picture.",
  "medicalSummary": "A 2-3 sentence professional, clinically accurate medical summary of the document, using standard medical terminology suitable for a doctor or medical advisor.",
  "explanation": {
    "sections": [
      {
        "title": "Clinical Condition Explained" | "Test Results Summary" | "Care Instructions",
        "content": "Patient-friendly explanation of the findings, clinical suspicions, or next steps in plain English."
      }
    ]
  },
  "medicines": [
    {
      "brandName": "string",
      "genericName": "string",
      "category": "string",
      "commonUses": "string",
      "howItWorks": "string",
      "sideEffects": "string",
      "foodRestrictions": "string",
      "precautions": "string"
    }
  ],
  "doctorQuestions": [
    "A list of 3-4 specific, patient-centric questions they should ask their doctor at their next visit based on this document."
  ],
  "abnormalValues": [
    {
      "parameter": "string",
      "value": "string",
      "referenceRange": "string",
      "explanation": "A plain English explanation of why this parameter is flag-worthy and what it indicates."
    }
  ]
}`

    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.0-flash',
      'gemini-flash-latest'
    ]

    let geminiResponse: Response | null = null
    let lastError: Error | null = null
    let usedModel = ""

    for (const model of modelsToTry) {
      try {
        console.log(`Calling Gemini with model: ${model}...`)
        
        const parts: any[] = [{ text: prompt }]
        if (includeFile) {
          parts.push({
            inlineData: {
              mimeType: geminiMimeType,
              data: base64Data
            }
          })
        }

        geminiResponse = await fetchWithRetry(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts }],
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192,
                responseMimeType: 'application/json'
              }
            })
          },
          45000
        )

        if (geminiResponse.status === 200) {
          console.log(`Successfully completed call with model: ${model}`)
          usedModel = model
          break
        }

        const errText = await geminiResponse.text()
        console.warn(`Model ${model} returned status ${geminiResponse.status}: ${errText.substring(0, 150)}`)
        lastError = new Error(`Model ${model} failed with status ${geminiResponse.status}: ${errText}`)
      } catch (err: any) {
        console.warn(`Model ${model} call failed with exception: ${err.message}`)
        lastError = err
      }
    }

    if (!geminiResponse || geminiResponse.status !== 200) {
      throw lastError || new Error("All Gemini models failed to process the request due to quota or availability issues.")
    }

    const geminiRawText = await geminiResponse.text()
    let geminiJson: any
    try {
      geminiJson = JSON.parse(geminiRawText)
    } catch (err: any) {
      throw new Error(`Failed to parse Gemini response JSON: ${err.message}. Raw response: ${geminiRawText.substring(0, 500)}`)
    }
    console.log(`Gemini success. Used model: ${usedModel}. Status: ${geminiResponse.status}`)

    const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      throw new Error(`Gemini returned no content: ${JSON.stringify(geminiJson).substring(0, 300)}`)
    }

    let rawAnalysis: any
    try {
      rawAnalysis = cleanAndParseJson(rawText)
    } catch (err: any) {
      throw new Error(`Failed to parse Gemini candidate text JSON: ${err.message}. Candidate text: ${rawText.substring(0, 500)}`)
    }
    console.log("Parsed Gemini analysis:", JSON.stringify(rawAnalysis, null, 2))


    // 5. Non-medical rejection
    if (rawAnalysis.isMedical === false) {
      await supabase.from('documents').update({ is_medical: false, status: 'failed' }).eq('id', documentId)
      return new Response(JSON.stringify({ success: true, isMedical: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 6. Save results
    const { data: analysisData, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        document_id: documentId,
        summary: rawAnalysis.summary || '',
        structured_output: {
          sections: rawAnalysis.explanation?.sections || [],
          abnormalValues: rawAnalysis.abnormalValues || [],
          medicalSummary: rawAnalysis.medicalSummary || ''
        },
        doctor_questions: rawAnalysis.doctorQuestions || []
      })
      .select('id')
      .single()

    if (analysisErr || !analysisData) {
      throw new Error(`Failed to save analysis: ${analysisErr?.message}`)
    }

    if (rawAnalysis.medicines?.length > 0) {
      console.log(`Mapping ${rawAnalysis.medicines.length} medicines for insert...`)
      const medicinesRows = rawAnalysis.medicines.map((m: any) => ({
        analysis_id: analysisData.id,
        brand_name: m.brandName || "Unknown",
        generic_name: m.genericName || "",
        category: m.category || "",
        common_uses: m.commonUses || "",
        how_it_works: m.howItWorks || "",
        side_effects: m.sideEffects || "",
        food_restrictions: m.foodRestrictions || "",
        precautions: m.precautions || "",
        confidence_score: 95.0
      }))
      const { error: medsErr } = await supabase.from('medicines').insert(medicinesRows)
      if (medsErr) {
        console.error("Database error inserting medicines:", medsErr.message)
      } else {
        console.log(`Successfully inserted ${medicinesRows.length} medicines rows into database.`)
      }
    } else {
      console.log("No medicines were extracted in rawAnalysis.medicines.")
    }

    await supabase.from('confidence_scores').insert({
      analysis_id: analysisData.id,
      ocr_confidence: 90.0,
      ai_confidence: 98.0,
      overall_confidence: 94.0
    })

    const allowedDocTypes = [
      'prescription',
      'blood_report',
      'diagnostic_report',
      'hospital_bill',
      'discharge_summary',
      'medicine_label',
      'unknown'
    ]
    let docType = String(rawAnalysis.documentType || 'unknown').toLowerCase().trim()
    if (!allowedDocTypes.includes(docType)) {
      console.warn(`Gemini returned invalid documentType: "${docType}". Falling back to "unknown".`)
      docType = 'unknown'
    }

    const { error: updateErr } = await supabase.from('documents').update({
      status: 'completed',
      document_type: docType
    }).eq('id', documentId)

    if (updateErr) {
      throw new Error(`Failed to update document status to completed: ${updateErr.message}`)
    }

    console.log("Document processed successfully!")

    return new Response(JSON.stringify({
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err: any) {
    console.error("Edge Function error:", err.message)

    // Always try to update document status to failed
    if (documentId) {
      try {
        await supabase.from('documents')
          .update({ status: 'failed' })
          .eq('id', documentId)
          .in('status', ['processing', 'uploaded'])
      } catch (_) { /* ignore */ }
    }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
