import { supabase } from '../utils/supabase'

export interface AnalyzeDocumentParams {
  documentId: string
  detailLevel: 'quick' | 'full' | 'audit'
  docType: string
  outputLanguage?: 'english' | 'hindi'
  reuseOcr?: boolean
}

export async function invokeAnalyzeDocument(params: AnalyzeDocumentParams) {
  return supabase.functions.invoke('analyze-document', {
    body: params,
  })
}
