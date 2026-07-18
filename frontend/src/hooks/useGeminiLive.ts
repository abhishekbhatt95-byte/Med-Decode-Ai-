import { useState, useRef, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { getVoiceSessionToken, patchVoiceSessionDetails } from '../services/voiceSession'

export type LiveVoiceStatus = 'Connecting' | 'Listening' | 'Thinking' | 'Speaking' | 'Disconnected' | 'Ended'
export type LiveVoiceMode = 'voice' | 'translate'

const WORKLET_CODE = `
class LiveVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.inputBuffer = [];
    this.inputRatio = sampleRate / 16000;
    this.inputIndex = 0;

    this.outputRingBuffer = new Float32Array(48000 * 2);
    this.outputReadPtr = 0;
    this.outputWritePtr = 0;
    this.outputRatio = 24000 / sampleRate;
    this.outputIndex = 0;

    this.rmsThreshold = 0.03;
    this.speechStartThresholdSamples = 0.15 * 16000;
    this.speechEndThresholdSamples = 0.6 * 16000;
    this.consecutiveAboveCount = 0;
    this.consecutiveBelowCount = 0;
    this.isUserSpeaking = false;
    this.runningRmsSq = 0;
    this.wasPlaying = false;
    this.isPlaybackActive = false;

    this.port.onmessage = (event) => {
      if (event.data.type === 'output_audio') {
        this.writeToOutputRingBuffer(event.data.samples);
      } else if (event.data.type === 'clear_output') {
        this.clearOutputRingBuffer();
      } else if (event.data.type === 'set_playback_active') {
        this.isPlaybackActive = event.data.active;
      }
    };
  }

  writeToOutputRingBuffer(samples) {
    for (let i = 0; i < samples.length; i++) {
      this.outputRingBuffer[this.outputWritePtr] = samples[i];
      this.outputWritePtr = (this.outputWritePtr + 1) % this.outputRingBuffer.length;
    }
  }

  clearOutputRingBuffer() {
    this.outputRingBuffer.fill(0);
    this.outputReadPtr = 0;
    this.outputWritePtr = 0;
    this.outputIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const inputChannels = inputs[0];
    if (inputChannels && inputChannels.length > 0) {
      this.processInput(inputChannels[0]);
    }

    const outputChannels = outputs[0];
    if (outputChannels && outputChannels.length > 0) {
      this.processOutput(outputChannels[0]);
    }

    return true;
  }

  processInput(inputData) {
    for (let i = 0; i < inputData.length; i++) {
      this.inputBuffer.push(inputData[i]);
    }

    const resampled = [];
    while (this.inputIndex < this.inputBuffer.length - 1) {
      const idx = Math.floor(this.inputIndex);
      const nextIdx = idx + 1;
      const frac = this.inputIndex - idx;
      
      const sample = this.inputBuffer[idx] * (1 - frac) + this.inputBuffer[nextIdx] * frac;
      resampled.push(sample);
      
      this.inputIndex += this.inputRatio;
    }

    if (this.inputIndex >= 1) {
      const dropCount = Math.floor(this.inputIndex);
      this.inputBuffer = this.inputBuffer.slice(dropCount);
      this.inputIndex -= dropCount;
    }

    if (resampled.length === 0) return;

    const activeThreshold = this.isPlaybackActive ? 0.09 : this.rmsThreshold;

    for (let i = 0; i < resampled.length; i++) {
      const sample = resampled[i];
      this.runningRmsSq = 0.95 * this.runningRmsSq + 0.05 * (sample * sample);
      const currentRms = Math.sqrt(this.runningRmsSq);

      if (currentRms >= activeThreshold) {
        this.consecutiveAboveCount++;
        this.consecutiveBelowCount = 0;
        if (!this.isUserSpeaking && this.consecutiveAboveCount >= this.speechStartThresholdSamples) {
          this.isUserSpeaking = true;
          this.port.postMessage({ type: 'speech_start' });
          this.clearOutputRingBuffer();
        }
      } else {
        this.consecutiveBelowCount++;
        if (this.isUserSpeaking) {
          if (this.consecutiveBelowCount >= this.speechEndThresholdSamples) {
            this.isUserSpeaking = false;
            this.consecutiveAboveCount = 0;
            this.port.postMessage({ type: 'speech_end' });
          }
        } else {
          if (this.consecutiveBelowCount > 1000) {
            this.consecutiveAboveCount = 0;
          }
        }
      }
    }

    const pcm16 = new Int16Array(resampled.length);
    for (let i = 0; i < resampled.length; i++) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    this.port.postMessage({ type: 'input_audio', samples: pcm16 }, [pcm16.buffer]);
  }

  processOutput(outputData) {
    const available = (this.outputWritePtr - this.outputReadPtr + this.outputRingBuffer.length) % this.outputRingBuffer.length;
    
    if (available > 2) {
      this.wasPlaying = true;
      for (let i = 0; i < outputData.length; i++) {
        const idx = Math.floor(this.outputIndex);
        const nextIdx = (idx + 1) % this.outputRingBuffer.length;
        const frac = this.outputIndex - Math.floor(this.outputIndex);
        
        const readIdxReal = (this.outputReadPtr + idx) % this.outputRingBuffer.length;
        const readIdxNextReal = (this.outputReadPtr + nextIdx) % this.outputRingBuffer.length;

        const sample = this.outputRingBuffer[readIdxReal] * (1 - frac) + this.outputRingBuffer[readIdxNextReal] * frac;
        outputData[i] = sample;
        
        this.outputIndex += this.outputRatio;
        if (this.outputIndex >= 1) {
          const advance = Math.floor(this.outputIndex);
          this.outputReadPtr = (this.outputReadPtr + advance) % this.outputRingBuffer.length;
          this.outputIndex -= advance;
        }
      }
    } else {
      outputData.fill(0);
      if (this.wasPlaying) {
        this.wasPlaying = false;
        this.port.postMessage({ type: 'playback_empty' });
      }
    }
  }
}

registerProcessor('live-voice-processor', LiveVoiceProcessor);
`

export const useGeminiLive = (
  analysisId: string,
  modelKey: string,
  mode: LiveVoiceMode = 'voice',
  targetLanguageCode = 'en'
) => {
  const [status, setStatusState] = useState<LiveVoiceStatus>('Disconnected')
  const statusRef = useRef<LiveVoiceStatus>('Disconnected')
  const setStatus = (s: LiveVoiceStatus) => {
    statusRef.current = s
    setStatusState(s)
  }
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [microphoneAnalyser, setMicrophoneAnalyser] = useState<AnalyserNode | null>(null)
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null)
  /** Text transcript returned by the translate model (audio + text modalities) */
  const [translatedText, setTranslatedText] = useState<string>('')

  const audioContextRef = useRef<AudioContext | null>(null)
  const workletNodeRef = useRef<AudioWorkletNode | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const webSocketRef = useRef<WebSocket | null>(null)
  const voiceSessionIdRef = useRef<string | null>(null)
  const sessionStartTimeRef = useRef<number>(0)
  const interruptionsRef = useRef<number>(0)
  const reconnectTimeoutRef = useRef<number | null>(null)

  const inputAudioQueueRef = useRef<Int16Array[]>([])
  const inputAudioQueueSamplesRef = useRef<number>(0)

  const analysisContextRef = useRef<string>('')
  const turnCompleteReceivedRef = useRef<boolean>(false)

  const isMutedRef = useRef(isMuted)
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    const fetchContext = async () => {
      if (!analysisId) return
      const { data: analysis } = await supabase
        .from('analyses')
        .select('summary, structured_output, doctor_questions, document_id')
        .eq('id', analysisId)
        .single()

      if (!analysis) return

      const { data: medicines } = await supabase
        .from('medicines')
        .select('brand_name, generic_name, common_uses, side_effects, food_restrictions, precautions')
        .eq('analysis_id', analysisId)

      let docMeta: any = null
      if (analysis.document_id) {
        const { data: doc } = await supabase
          .from('documents')
          .select('name, document_type, created_at')
          .eq('id', analysis.document_id)
          .single()
        docMeta = doc
      }

      const so = analysis.structured_output || {} as any
      const abnormals = so.abnormalValues || []
      const sections = so.sections || []
      const medSummary = so.medicalSummary || ''
      const docTypePretty = (docMeta?.document_type || 'unknown').replace(/_/g, ' ')
      const docDate = docMeta?.created_at
        ? new Date(docMeta.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'Unknown'

      let ctx = `\n=== PATIENT REPORT CONTEXT ===\n`
      ctx += `\nDOCUMENT METADATA:\n- Document: ${docMeta?.name || 'Uploaded Document'}\n- Type: ${docTypePretty}\n- Date: ${docDate}\n`
      ctx += `\nGENERAL SUMMARY:\n${analysis.summary}\n`
      if (medSummary) ctx += `\nCLINICAL SUMMARY:\n${medSummary}\n`
      if (abnormals.length > 0) {
        ctx += `\nABNORMAL / FLAGGED FINDINGS:\n`
        abnormals.forEach((a: any) => { ctx += `- ${a.parameter}: ${a.value} (Normal: ${a.referenceRange}) — ${a.explanation}\n` })
      }
      if (sections.length > 0) {
        ctx += `\nDETECTED CONDITIONS & EXPLANATIONS:\n`
        sections.forEach((s: any) => { ctx += `- ${s.title}: ${s.content}\n` })
      }
      if (medicines && medicines.length > 0) {
        ctx += `\nPRESCRIBED MEDICINES:\n`
        medicines.forEach((m: any) => { ctx += `- ${m.brand_name} (${m.generic_name || 'N/A'}): ${m.common_uses || 'N/A'}. Side effects: ${m.side_effects || 'N/A'}. Food: ${m.food_restrictions || 'N/A'}. Precautions: ${m.precautions || 'N/A'}.\n` })
      }
      if (analysis.doctor_questions && analysis.doctor_questions.length > 0) {
        ctx += `\nSUGGESTED DOCTOR QUESTIONS:\n`
        analysis.doctor_questions.forEach((q: string) => { ctx += `- ${q}\n` })
      }
      ctx += `\n=== END OF REPORT CONTEXT ===`
      analysisContextRef.current = ctx
    }
    fetchContext()
  }, [analysisId])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (webSocketRef.current) {
      webSocketRef.current.onclose = null
      webSocketRef.current.close()
      webSocketRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close()
      }
      audioContextRef.current = null
    }
    workletNodeRef.current = null
    setMicrophoneAnalyser(null)
    setPlaybackAnalyser(null)
  }

  const startSession = async () => {
    cleanup()
    setError(null)
    setStatus('Connecting')

    try {
      const tokenData = await getVoiceSessionToken({
        analysisId: mode === 'translate' ? undefined : analysisId,
        modelKey,
        voiceSessionId: voiceSessionIdRef.current || undefined,
        mode,
        targetLanguage: targetLanguageCode,
      })

      if (!tokenData?.token) {
        throw new Error('Failed to obtain voice session token.')
      }

      voiceSessionIdRef.current = tokenData.voiceSessionId
      if (!sessionStartTimeRef.current) {
        sessionStartTimeRef.current = Date.now()
      }

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive'
      })
      audioContextRef.current = audioCtx

      try {
        // Try 1: Standard resolved Vite asset URL (supports custom base paths / domains)
        const workletUrl = new URL('/live-voice-processor.js', import.meta.url).href
        await audioCtx.audioWorklet.addModule(workletUrl)
      } catch (err1) {
        console.warn('Same-origin static worklet load failed, trying base64 Data URI:', err1)
        try {
          // Try 2: Network-independent base64 Data URI (bypasses 404s, CORS, and network glitches)
          const base64Code = btoa(unescape(encodeURIComponent(WORKLET_CODE)))
          const dataUri = `data:application/javascript;base64,${base64Code}`
          await audioCtx.audioWorklet.addModule(dataUri)
        } catch (err2) {
          console.warn('Data URI worklet load failed, falling back to Blob URL:', err2)
          // Try 3: Blob URL fallback
          const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
          const blobUrl = URL.createObjectURL(blob)
          await audioCtx.audioWorklet.addModule(blobUrl)
          URL.revokeObjectURL(blobUrl)
        }
      }

      const workletNode = new AudioWorkletNode(audioCtx, 'live-voice-processor')
      workletNodeRef.current = workletNode

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 48000,
          echoCancellation: true,
          noiseSuppression: true
        }
      })
      mediaStreamRef.current = micStream

      const micSource = audioCtx.createMediaStreamSource(micStream)
      micSource.connect(workletNode)
      workletNode.connect(audioCtx.destination)

      const micAnalyser = audioCtx.createAnalyser()
      micAnalyser.fftSize = 256
      micSource.connect(micAnalyser)
      setMicrophoneAnalyser(micAnalyser)

      const playAnalyser = audioCtx.createAnalyser()
      playAnalyser.fftSize = 256
      workletNode.connect(playAnalyser)
      setPlaybackAnalyser(playAnalyser)

      workletNode.port.onmessage = (event) => {
        if (event.data.type === 'speech_start') {
          interruptionsRef.current++
          // If we interrupted, send interruption message to server
          if (webSocketRef.current && webSocketRef.current.readyState === WebSocket.OPEN) {
            webSocketRef.current.send(JSON.stringify({
              clientContent: {
                turnComplete: false,
                interrupted: true
              }
            }))
          }
          workletNode.port.postMessage({ type: 'set_playback_active', active: false })
          setStatus('Listening')
          turnCompleteReceivedRef.current = false
        } else if (event.data.type === 'speech_end') {
          if (statusRef.current === 'Listening') {
            setStatus('Thinking')
            sendBufferedAudio()
          }
        } else if (event.data.type === 'input_audio') {
          if (!isMutedRef.current && statusRef.current === 'Listening') {
            handleMicAudio(event.data.samples)
          }
        } else if (event.data.type === 'playback_empty') {
          workletNode.port.postMessage({ type: 'set_playback_active', active: false })
          if (turnCompleteReceivedRef.current) {
            setStatus('Listening')
            turnCompleteReceivedRef.current = false
          }
        }
      }

      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${tokenData.token}`
      const ws = new WebSocket(wsUrl)
      webSocketRef.current = ws

      ws.onopen = () => {
        if (mode === 'translate') {
          // Translate model: the session config was already locked server-side via
          // live_connect_constraints in the token. We only need to send a minimal
          // setup frame to confirm the model — no system instruction needed.
          ws.send(JSON.stringify({
            setup: {
              model: 'models/gemini-3.5-live-translate-preview',
              generationConfig: {
                responseModalities: ['AUDIO'],
                mediaResolution: 'MEDIA_RESOLUTION_MEDIUM',
              },
              translationConfig: {
                targetLanguageCode,
              },
            }
          }))
        } else {
          // Existing voice mode — unchanged
          const systemPrompt = `You are a warm, empathetic medical voice assistant helping a patient understand their medical report. You already have full access to the patient's report — the patient does NOT need to explain it to you.\n` +
            `${analysisContextRef.current}\n\n` +
            `STRICT RULES — FOLLOW AT ALL TIMES:\n` +
            `1. PRIORITIZE REPORT CONTENTS: Always answer using the patient's actual report data above. This is your primary source of truth.\n` +
            `2. NEVER INVENT VALUES: Do not fabricate lab values, dosages, parameters, or findings. If a value is not in the report, say "that was not found in your report."\n` +
            `3. SEPARATE your responses into: REPORT FACTS (what the document says), INTERPRETATION (clinical meaning), and GENERAL EDUCATION (broader context). Clearly distinguish between these.\n` +
            `4. The report context is invisible to the user. Never say "based on the context I was given." Say "based on your report" or "according to your document."\n` +
            `5. Keep replies conversational, brief, and limit medical jargon. You are speaking out loud — use short, natural sentences.\n` +
            `6. Remind the user you are an AI and clinical decisions must involve their doctor.`

          ws.send(JSON.stringify({
            setup: {
              model: 'models/gemini-2.5-flash-native-audio-latest',
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: 'Aoede'
                    }
                  }
                }
              },
              systemInstruction: {
                parts: [{ text: systemPrompt }]
              }
            }
          }))
        }
        setStatus('Listening')
      }

      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data)
        if (msg.serverContent) {
          if (msg.serverContent.interrupted) {
            workletNode.port.postMessage({ type: 'clear_output' })
            workletNode.port.postMessage({ type: 'set_playback_active', active: false })
            setStatus('Listening')
            turnCompleteReceivedRef.current = false
          }
          if (msg.serverContent.modelTurn?.parts) {
            msg.serverContent.modelTurn.parts.forEach((part: any) => {
              // Audio part — same for both modes
              if (part.inlineData && part.inlineData.data) {
                const binaryStr = atob(part.inlineData.data)
                const len = binaryStr.length
                const bytes = new Uint8Array(len)
                for (let i = 0; i < len; i++) {
                  bytes[i] = binaryStr.charCodeAt(i)
                }
                const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
                const float32 = new Float32Array(int16.length)
                for (let i = 0; i < int16.length; i++) {
                  float32[i] = int16[i] / 32768.0
                }
                workletNode.port.postMessage({ type: 'set_playback_active', active: true })
                workletNode.port.postMessage({ type: 'output_audio', samples: float32 })
                setStatus('Speaking')
              }
              // Text part — translate model returns a text transcript alongside audio
              if (part.text && mode === 'translate') {
                setTranslatedText(prev => prev + part.text)
              }
            })
          }
          if (msg.serverContent.turnComplete) {
            turnCompleteReceivedRef.current = true
            // Reset transcript accumulator at start of each new utterance
            if (mode === 'translate') setTranslatedText('')
          }
        }
      }

      ws.onclose = () => {
        if (status !== 'Ended' && status !== 'Disconnected') {
          setStatus('Connecting')
          reconnectTimeoutRef.current = setTimeout(() => {
            startSession()
          }, 1500)
        }
      }

      ws.onerror = (err) => {
        console.error('Gemini Live WS error:', err)
      }

    } catch (err: any) {
      setError(err.message)
      setStatus('Disconnected')
      cleanup()
    }
  }

  const handleMicAudio = (samples: Int16Array) => {
    inputAudioQueueRef.current.push(samples)
    inputAudioQueueSamplesRef.current += samples.length

    if (inputAudioQueueSamplesRef.current >= 2400) {
      sendBufferedAudio()
    }
  }

  const sendBufferedAudio = () => {
    if (inputAudioQueueRef.current.length === 0) return
    if (!webSocketRef.current || webSocketRef.current.readyState !== WebSocket.OPEN) return

    const totalSamples = inputAudioQueueSamplesRef.current
    const merged = new Int16Array(totalSamples)
    let offset = 0
    inputAudioQueueRef.current.forEach((arr) => {
      merged.set(arr, offset)
      offset += arr.length
    })

    inputAudioQueueRef.current = []
    inputAudioQueueSamplesRef.current = 0

    const bytes = new Uint8Array(merged.buffer, merged.byteOffset, merged.byteLength)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    webSocketRef.current.send(JSON.stringify({
      realtimeInput: {
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64
          }
        ]
      }
    }))
  }

  const endSession = async () => {
    setStatus('Ended')
    cleanup()

    if (voiceSessionIdRef.current && sessionStartTimeRef.current) {
      const durationSeconds = Math.round((Date.now() - sessionStartTimeRef.current) / 1000)
      const interruptions = interruptionsRef.current
      const sessionId = voiceSessionIdRef.current

      sessionStartTimeRef.current = 0
      interruptionsRef.current = 0
      voiceSessionIdRef.current = null

      try {
        await patchVoiceSessionDetails({
          voiceSessionId: sessionId,
          durationSeconds,
          interruptions
        })
      } catch (err) {
        console.error('Failed to patch voice session details:', err)
      }
    }
  }

  const muteMic = () => {
    setIsMuted((prev) => !prev)
  }

  return {
    status,
    error,
    isMuted,
    microphoneAnalyser,
    playbackAnalyser,
    translatedText,
    mode,
    startSession,
    endSession,
    muteMic
  }
}
