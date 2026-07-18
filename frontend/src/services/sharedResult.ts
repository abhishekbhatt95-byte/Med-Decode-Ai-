export interface SharedResultData {
  doc: {
    name: string
    document_type: string
  }
  analysis: {
    id: string
    summary: string
    structured_output: any
    doctor_questions: string[]
  }
  medicines: any[]
}

export async function fetchSharedResult(token: string): Promise<SharedResultData> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const res = await fetch(
    `${supabaseUrl}/functions/v1/shared-result?token=${token}`,
    {
      headers: { apikey: supabaseAnonKey },
    }
  )

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}))
    throw new Error(errJson.error || 'This link is invalid or has expired.')
  }

  return res.json()
}
