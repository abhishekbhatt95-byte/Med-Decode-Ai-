import React, { useEffect, useRef } from 'react'

interface VoiceVisualizerProps {
  status: 'Connecting' | 'Listening' | 'Thinking' | 'Speaking' | 'Disconnected' | 'Ended'
  analyser: AnalyserNode | null
}

interface WaveConfig {
  color: string
  speed: number
  freq: number
  opacity: number
}

const WAVES: WaveConfig[] = [
  { color: '0, 180, 216', speed: 0.05, freq: 1.0, opacity: 0.8 },      // Bright blue
  { color: '16, 185, 129', speed: -0.04, freq: 1.8, opacity: 0.75 },   // Emerald
  { color: '99, 102, 241', speed: 0.03, freq: 0.6, opacity: 0.7 },      // Indigo
  { color: '168, 85, 247', speed: -0.05, freq: 2.5, opacity: 0.6 }     // Purple
]

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ status, analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const timeRef = useRef<number>(0)
  const ampRef = useRef<number>(5)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * window.devicePixelRatio
      canvas.height = rect.height * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)

    const dataArray = analyser ? new Uint8Array(analyser.fftSize) : null

    const render = () => {
      const width = canvas.width / window.devicePixelRatio
      const height = canvas.height / window.devicePixelRatio
      const centerY = height / 2

      ctx.clearRect(0, 0, width, height)

      let targetAmp = 2
      if (status === 'Disconnected' || status === 'Ended') {
        targetAmp = 0.5
      } else if (status === 'Connecting' || status === 'Thinking') {
        // Rhythmic pulsing when thinking
        targetAmp = 6 + 3 * Math.sin(timeRef.current * 0.05)
      } else if (analyser && dataArray && (status === 'Listening' || status === 'Speaking')) {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128
          sum += val * val
        }
        const rms = Math.sqrt(sum / dataArray.length)
        targetAmp = rms * 220 + 3
      } else {
        targetAmp = 4 + 2 * Math.sin(timeRef.current * 0.02)
      }

      ampRef.current = ampRef.current * 0.8 + targetAmp * 0.2
      timeRef.current += 1.5

      ctx.save()
      ctx.globalCompositeOperation = 'screen'

      WAVES.forEach((wave) => {
        ctx.beginPath()
        ctx.lineWidth = 3
        ctx.strokeStyle = `rgba(${wave.color}, ${wave.opacity})`
        
        // Add neon glowing shadow effect
        ctx.shadowBlur = 18
        ctx.shadowColor = `rgba(${wave.color}, 0.9)`

        const phase = timeRef.current * wave.speed * 0.25

        for (let x = 0; x <= width; x += 2) {
          // Envelope limits the height at the edges for a natural vocal pinch look
          const env = Math.sin((x / width) * Math.PI)
          const angle = (x / width) * Math.PI * 2 * wave.freq + phase
          const y = centerY + ampRef.current * env * Math.sin(angle)
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
      })

      ctx.restore()
      animationRef.current = requestAnimationFrame(render)
    }

    animationRef.current = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('resize', resizeCanvas)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [status, analyser])

  return (
    <div className="w-full h-48 bg-slate-950 rounded-2xl overflow-hidden border border-slate-900/60 shadow-2xl relative flex items-center justify-center">
      {/* Dynamic ambient backdrop glowing gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-indigo-500/5 to-purple-500/5 blur-xl pointer-events-none" />
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full blur-3xl opacity-15 pointer-events-none transition-all duration-700 ${
        status === 'Listening' ? 'bg-emerald-500' :
        status === 'Speaking' ? 'bg-indigo-500 scale-125' :
        status === 'Thinking' ? 'bg-purple-500 animate-pulse' :
        status === 'Connecting' ? 'bg-amber-500' :
        'bg-slate-700'
      }`} />

      <canvas ref={canvasRef} className="w-full h-full block relative z-10" />
      
      {/* Elegant glass badge */}
      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-800/80 z-25 shadow-lg">
        <span className={`w-2.5 h-2.5 rounded-full ${
          status === 'Listening' ? 'bg-emerald-500 animate-pulse' :
          status === 'Speaking' ? 'bg-cyan-500 animate-pulse shadow-[0_0_10px_#00b4d8]' :
          status === 'Thinking' ? 'bg-purple-500 animate-bounce' :
          status === 'Connecting' ? 'bg-amber-500 animate-pulse' :
          'bg-slate-500'
        }`} />
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">
          {status}
        </span>
      </div>
    </div>
  )
}
