import { supabase } from '../utils/supabase'

export interface AssistantParams {
  message: string
  conversationHistory: any[]
  currentPageContext?: { documentId: string }
}

export async function invokeAssistant(params: AssistantParams) {
  return supabase.functions.invoke('assistant', {
    body: params,
  })
}
