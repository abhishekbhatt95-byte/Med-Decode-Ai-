import { supabase } from '../utils/supabase'

export interface VoiceSessionParams {
  /** Required for voice mode. Not required for translate mode. */
  analysisId?: string
  modelKey?: string
  voiceSessionId?: string
  /** 'voice' (default) or 'translate' */
  mode?: 'voice' | 'translate'
  /** BCP-47 language code for the translation target. e.g. 'en', 'hi'. Default: 'en'. */
  targetLanguage?: string
}

export interface VoiceSessionPatchParams {
  voiceSessionId: string
  durationSeconds: number
  interruptions: number
}

export async function getVoiceSessionToken(params: VoiceSessionParams) {
  const { data, error } = await supabase.functions.invoke('voice-session-token', {
    body: params,
  })
  if (error) throw error
  return data
}

export async function patchVoiceSessionDetails(params: VoiceSessionPatchParams) {
  const { data, error } = await supabase.functions.invoke('voice-session-token', {
    method: 'PATCH',
    body: params,
  })
  if (error) throw error
  return data
}
