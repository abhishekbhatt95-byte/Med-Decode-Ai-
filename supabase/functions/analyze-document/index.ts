import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"
import { getCorsHeaders } from "../_shared/cors.ts"
import {
  authenticateRequest,
  enforceRequestSize,
  errorResponse,
  successResponse,
  logFailure,
  logRequest,
  getClientIp,
  createServiceClient,
} from '../_shared/security.ts'

function maskPII(text: string): string {
  if (!text) return ""
  let masked = text
  masked = masked.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_MASKED]')
  masked = masked.replace(/\b(\+?\d{1,3}[-.\\s]?)?\(?\d{3}\)?[-.\\s]?\d{3}[-.\\s]?\d{4}\b/g, '[PHONE_MASKED]')
  masked = masked.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[NATIONAL_ID_MASKED]')
  masked = masked.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_MASKED]')
  return masked
}


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


async function fetchWithRetry(url: string, options: RequestInit, timeoutMs: number, maxRetries = 3): Promise<Response> {
  let attempt = 0
  let delay = 2000 
  
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
  
  
  return fetchWithTimeout(url, options, timeoutMs)
}


async function runOcr(fileUrl: string, isPdf: boolean, ocrSpaceKey: string, engine: string): Promise<{ text: string; ocrExitCode: number | null }> {
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
    30000 
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

  const ocrExitCode = ocrJson.OCRExitCode !== undefined ? Number(ocrJson.OCRExitCode) : null
  return { text: extractedText, ocrExitCode }
}

function sanitizeOcrText(text: string): string {
  if (!text) return ''
  // deno-lint-ignore no-control-regex
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
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





function confidenceLabelToScore(label: any): number {
  switch (String(label || '').toLowerCase().trim()) {
    case 'high': return 95
    case 'medium': return 70
    case 'low': return 40
    default: return 50 
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createServiceClient()
  let documentId: string | null = null
  let userId: string | null = null

  try {
    const sizeErr = enforceRequestSize(req, 2048)
    if (sizeErr) return errorResponse(sizeErr, 413, corsHeaders)

    const auth = await authenticateRequest(req, supabase)
    if (auth.error) return errorResponse(auth.error, 401, corsHeaders)
    userId = auth.userId

    let body: any
    try {
      body = await req.json()
    } catch (_) {
      return errorResponse('Malformed JSON payload.', 400, corsHeaders)
    }

    documentId = body?.documentId
    const detailLevel = body?.detailLevel || 'full'
    const docType = body?.docType || 'unknown'
    // outputLanguage: 'hindi' generates all report text in Hindi (Devanagari); defaults to 'english'
    const outputLanguage: 'english' | 'hindi' = body?.outputLanguage === 'hindi' ? 'hindi' : 'english'
    // reuseOcr: true skips the OCR step and reuses stored extracted_text — used for re-analyze in a different language
    const reuseOcr: boolean = body?.reuseOcr === true
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!documentId || typeof documentId !== 'string' || !uuidRegex.test(documentId)) {
      return errorResponse('Invalid document ID.', 400, corsHeaders)
    }

    const clientIp = getClientIp(req)

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabase
      .from('request_logs')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', 'analyze-document')
      .gt('created_at', fifteenMinutesAgo)
      .or(`ip_address.eq.${clientIp},user_id.eq.${userId}`)

    if (countErr) {
      logFailure('analyze-document', userId, `Rate limit check failed: ${countErr.message}`)
    } else if (count !== null && count >= 5) {
      return errorResponse('Rate limit exceeded. Max 5 analyses per 15 minutes.', 429, corsHeaders)
    }

    await logRequest(supabase, userId, 'analyze-document', clientIp)

    const today = new Date().toISOString().split('T')[0]
    const { data: allowed, error: usageErr } = await supabase
      .rpc('try_increment_daily_usage', { p_user_id: userId, p_date: today, p_cap: 10 })

    if (usageErr) {
      logFailure('analyze-document', userId, `Usage check failed: ${usageErr.message}`)
    } else if (!allowed) {
      return errorResponse('Daily limit reached. Max 10 free analyses per day.', 429, corsHeaders)
    }

    const { data: document, error: docErr } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    if (docErr || !document) {
      return errorResponse('Document not found.', 404, corsHeaders)
    }

    if (document.user_id !== userId) {
      return errorResponse('Access denied.', 403, corsHeaders)
    }

    const fileSizeMb = (document.size || 0) / (1024 * 1024)
    if (fileSizeMb > 20) {
      return errorResponse('File too large. Maximum upload size is 20MB.', 413, corsHeaders)
    }

    
    await supabase.from('documents').update({ status: 'processing', processing_stage: 'ocr' }).eq('id', documentId)

    if (!reuseOcr) {
      // Fresh analysis: wipe all existing records and re-run full pipeline
      await supabase.from('analyses').delete().eq('document_id', documentId)
      await supabase.from('extracted_text').delete().eq('document_id', documentId)
      await supabase.from('ocr_results').delete().eq('document_id', documentId)
    } else {
      // Re-analyze in new language: keep OCR results, only delete the AI analysis
      await supabase.from('analyses').delete().eq('document_id', documentId)
    }

    
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

    
    let extractedText = ""
    let ocrExitCode: number | null = null
    let usedFallbackEngine = false
    const ocrProvider = "tesseract"

    if (reuseOcr) {
      // Re-analyze path: fetch the OCR text we already stored from the previous run
      const { data: storedOcr } = await supabase
        .from('extracted_text')
        .select('raw_text')
        .eq('document_id', documentId)
        .maybeSingle()
      extractedText = storedOcr?.raw_text || ''
      ocrExitCode = 1 // Previously accepted quality
      console.log(`reuseOcr=true: using stored extracted_text (${extractedText.length} chars)`)
    } else {
      // Fresh analysis path: run the full OCR pipeline
      const configuredOcrKey = Deno.env.get('OCR_SPACE_API_KEY')
      if (!configuredOcrKey) {
        console.error("OCR_SPACE_API_KEY is not set! Falling back to the public 'helloworld' demo key, " +
          "which is heavily rate-limited and size-capped. Set a real key as a Supabase secret before relying on this in production.")
      }
      const ocrSpaceKey = configuredOcrKey || 'helloworld'

      try {
        try {
          const engine3Result = await runOcr(fileUrl, isPdf, ocrSpaceKey, '3')
          extractedText = engine3Result.text
          ocrExitCode = engine3Result.ocrExitCode
          console.log(`OCR Engine 3 succeeded. Text length: ${extractedText.length}`)
        } catch (engine3Err: any) {
          console.warn(`OCR Engine 3 failed: ${engine3Err.message}. Falling back to Engine 1...`)
          
          const engine1Result = await runOcr(fileUrl, isPdf, ocrSpaceKey, '1')
          extractedText = engine1Result.text
          ocrExitCode = engine1Result.ocrExitCode
          usedFallbackEngine = true
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

      
      if (extractedText) {
        await supabase.from('extracted_text').insert({
          document_id: documentId,
          raw_text: extractedText,
          ocr_provider: ocrProvider,
          confidence: computeOcrConfidence() / 100
        })

        await supabase.from('ocr_results').insert({
          document_id: documentId,
          provider: ocrProvider,
          raw_output: { textLength: extractedText.length },
          duration_ms: 0
        })
      }
    } 

    
    function computeOcrConfidence(): number {
      if (!extractedText) return 20 
      let score = ocrExitCode === 1 ? 90 : ocrExitCode === 2 ? 65 : 35
      if (usedFallbackEngine) score -= 10 
      return Math.max(0, Math.min(100, score))
    }

    await supabase.from('documents').update({ processing_stage: 'ai_analysis' }).eq('id', documentId)

    
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY not configured")

    const detailLevelInstruction = detailLevel === 'quick' 
      ? "FORMATTING REQUEST: Provide a highly concise, quick summary translation. Keep explanations brief, simple, and straight to the point."
      : detailLevel === 'audit'
      ? "FORMATTING REQUEST: Provide a highly detailed medical audit. Carefully cross-reference all reference ranges, drug interactions, clinical impressions, and potential ambiguities."
      : "FORMATTING REQUEST: Provide a comprehensive, full patient-friendly translation."

    const docTypeInstruction = docType !== 'unknown'
      ? `DOCUMENT TYPE HINT: The user has classified this document as a "${docType}". Use this as guidance during transcription and parsing.`
      : ""

    // Language instruction — English is the explicit default so the prompt is identical to pre-feature behaviour
    const languageInstruction = outputLanguage === 'hindi'
      ? `LANGUAGE REQUIREMENT: Generate ALL explanatory text in Hindi (Devanagari script). This includes: summary, medicalSummary, all explanation section titles and content, doctorQuestions, commonUses, howItWorks, sideEffects, foodRestrictions, precautions, and abnormalValue explanations. Medicine brand names, generic names, chemical parameter names, and reference range values must remain in English — they are universally used in Indian clinical practice and translating them would cause confusion. Use natural, patient-friendly Hindi as found in Indian health education materials. Add a brief note at the end of the summary field: "(यह रिपोर्ट AI द्वारा हिंदी में अनुवादित है। चिकित्सीय निर्णयों के लिए डॉक्टर से परामर्श करें।)"`
      : `LANGUAGE: Generate all text in clear, plain English.`

    const prompt = `You are a medical document translator and an expert in deciphering doctor handwriting, clinical reports, and laboratory panels.
${languageInstruction}
${detailLevelInstruction}
${docTypeInstruction}
Your task is to analyze the medical document provided (which may contain multiple pages, diagrams, handwritten notes, printed charts, or bills).
You are given a raw OCR text extraction of the document (note: this OCR may be partial, incomplete, or cover only the first page), and the actual document file itself as a multimodal image/PDF.

OCR Text:
${maskPII(sanitizeOcrText(extractedText.substring(0, 16000)))}

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
7. SELF-RATE YOUR CONFIDENCE: For every medicine and every abnormal value you extract, add a "confidence" field set to "high", "medium", or "low":
   - "high": the text was clearly printed/typed, or handwriting was unambiguous.
   - "medium": legible but with some uncertainty (stylized handwriting, partial visibility, minor inference needed).
   - "low": the handwriting or print was genuinely hard to read and you are pattern-matching to a plausible known medication/value rather than reading it directly.
   Be conservative and honest here — if you had to guess, mark it "low", not "high". Also set a top-level "overallConfidence" ("high"/"medium"/"low") reflecting your overall certainty about the whole document's transcription.
8. BILLING DOCUMENTS: If the document includes an itemized hospital bill, invoice, or charges (common when stapled to discharge summaries), extract each line item into the "billItems" array with its description and amount, and the grand total into "billTotal". If there is no billing content, return an empty array and null total.

Return ONLY valid JSON (no markdown block, no explanation) matching this exact format:
{
  "isMedical": boolean,
  "documentType": "prescription" | "blood_report" | "diagnostic_report" | "hospital_bill" | "discharge_summary" | "medicine_label" | "unknown",
  "overallConfidence": "high" | "medium" | "low",
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
      "precautions": "string",
      "confidence": "high" | "medium" | "low"
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
      "explanation": "A plain English explanation of why this parameter is flag-worthy and what it indicates.",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "billItems": [
    {
      "description": "string",
      "amount": "string"
    }
  ],
  "billTotal": "string or null"
}`

    const modelsToTry = [
      'gemini-3.5-flash',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
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
    console.log(`Parsed Gemini analysis. documentType=${rawAnalysis.documentType}, isMedical=${rawAnalysis.isMedical}`)


    
    if (rawAnalysis.isMedical === false) {
      await supabase.from('documents').update({ is_medical: false, status: 'failed' }).eq('id', documentId)
      return successResponse({ success: true, isMedical: false }, corsHeaders)
    }

    await supabase.from('documents').update({ processing_stage: 'saving' }).eq('id', documentId)

    
    const { data: analysisData, error: analysisErr } = await supabase
      .from('analyses')
      .insert({
        document_id: documentId,
        summary: rawAnalysis.summary || '',
        structured_output: {
          sections: rawAnalysis.explanation?.sections || [],
          abnormalValues: rawAnalysis.abnormalValues || [],
          medicalSummary: rawAnalysis.medicalSummary || '',
          billItems: rawAnalysis.billItems || [],
          billTotal: rawAnalysis.billTotal ?? null,
          outputLanguage: outputLanguage
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
        confidence_score: confidenceLabelToScore(m.confidence)
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

    
    
    
    
    
    
    const ocrConfidenceScore = computeOcrConfidence()
    const aiConfidenceScore = confidenceLabelToScore(rawAnalysis.overallConfidence)
    const overallConfidenceScore = Math.round(ocrConfidenceScore * 0.4 + aiConfidenceScore * 0.6)

    await supabase.from('confidence_scores').insert({
      analysis_id: analysisData.id,
      ocr_confidence: ocrConfidenceScore,
      ai_confidence: aiConfidenceScore,
      overall_confidence: overallConfidenceScore
    })

    
    
    if (overallConfidenceScore < 60) {
      const { error: flagErr } = await supabase.from('review_flags').insert({
        analysis_id: analysisData.id,
        flag_reason: `Low confidence analysis (${overallConfidenceScore}%) — OCR and/or AI had difficulty reading this document clearly. Recommend the patient verify medicines, dosages, and values with their doctor or pharmacist before relying on them.`
      })
      if (flagErr) {
        console.error("Failed to insert review_flags row:", flagErr.message)
      }
    }

    const allowedDocTypes = [
      'prescription',
      'blood_report',
      'diagnostic_report',
      'hospital_bill',
      'discharge_summary',
      'medicine_label',
      'unknown'
    ]
    let computedDocType = String(rawAnalysis.documentType || 'unknown').toLowerCase().trim()
    if (!allowedDocTypes.includes(computedDocType)) {
      console.warn(`Gemini returned invalid documentType: "${computedDocType}". Falling back to "unknown".`)
      computedDocType = 'unknown'
    }



    const { error: updateErr } = await supabase.from('documents').update({
      status: 'completed',
      document_type: computedDocType,
      processing_stage: null
    }).eq('id', documentId)

    if (updateErr) {
      throw new Error(`Failed to update document status to completed: ${updateErr.message}`)
    }

    console.log("Document processed successfully!")

    return successResponse({ success: true }, corsHeaders)

  } catch (err: any) {
    logFailure('analyze-document', userId, err.message, { documentId })

    if (documentId) {
      try {
        await supabase.from('documents')
          .update({ status: 'failed' })
          .eq('id', documentId)
          .in('status', ['processing', 'uploaded'])
      } catch (_) {}
    }

    let userMessage = 'Something went wrong while analyzing your document. Please try again.'
    if (err.message?.includes('timed out')) {
      userMessage = 'The analysis took too long. Please try again with a clearer image.'
    } else if (err.message?.includes('No readable text')) {
      userMessage = 'Could not read text from this document. Please upload a clearer image.'
    } else if (err.message?.includes('All Gemini models failed')) {
      userMessage = 'Our AI service is temporarily busy. Please try again in a few minutes.'
    }

    return errorResponse(userMessage, 500, corsHeaders)
  }
})
