import { supabase } from '../utils/supabase'

export interface CopilotParams {
  conversationId?: string
  analysisId: string
  message: string
  modelKey: 'standard' | 'fast_lite' | 'deep_pro'
  roleKey: 'default_clinical' | 'empathetic_advocate' | 'peer_physician' | 'billing_negotiator'
}

export async function invokeCopilot(params: CopilotParams) {
  return supabase.functions.invoke('copilot', {
    body: params,
  })
}
