import React, { useState, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  
  // UI states
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0])
    }
  }


  const processFile = async (file: File) => {
    setErrorMsg(null)
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic')) {
      setErrorMsg("Wrong file type. Only PDF, JPG, PNG, and HEIC are supported.")
      return
    }

    const maxSize = 20 * 1024 * 1024 // 20MB
    if (file.size > maxSize) {
      setErrorMsg("File too large. Maximum file size is 20MB.")
      return
    }

    setLoading(true)
    setProgress(5)

    // Guard: anonymous session should always exist by now, but if auth
    // is still bootstrapping (slow network) this prevents a null crash.
    if (!user) {
      setErrorMsg("Session is still loading — please wait a moment and try again.")
      setLoading(false)
      setProgress(0)
      return
    }

    setProgress(10)

    try {
      const fileExt = file.name.split('.').pop()
      const folderName = user.id
      const fileName = `${folderName}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
      
      setProgress(30)
      
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('Med Decode Ai')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (storageErr) {
        throw new Error(`Upload error: ${storageErr.message}`)
      }

      setProgress(60)

      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_')

      const { data: docData, error: docErr } = await supabase
        .from('documents')
        .insert({
          user_id: user!.id,
          name: sanitizedName,
          file_path: storageData.path,
          mime_type: file.type || `image/${fileExt}`,
          size: file.size,
          status: 'uploaded',
          document_type: 'unknown',
          is_medical: true
        })
        .select('id')
        .single()

      if (docErr) {
        throw new Error(`Database registration error: ${docErr.message}`)
      }

      setProgress(90)

      await supabase.from('file_uploads').insert({
        user_id: user!.id,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || `image/${fileExt}`,
      })

      setProgress(100)

      setTimeout(() => {
        navigate({ 
          to: '/processing', 
          search: { docId: docData.id }
        })
      }, 500)

    } catch (err: any) {
      console.error("Pipeline error:", err)
      setErrorMsg(err?.message || String(err) || "Failed to complete upload pipeline.")
      setProgress(0)
      setLoading(false)

      try {
        await supabase.from('failed_uploads').insert({
          user_id: user?.id ?? null,
          file_name: file?.name || "unknown",
          error_message: err?.message || String(err) || "Unknown upload error",
        })
      } catch (logErr) {
        console.error("Failed to log failed upload in database", logErr)
      }
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="py-12 px-4 max-w-4xl mx-auto space-y-12">
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#004bb3] tracking-tight">
          Upload Your Prescription or Report
        </h1>
        <p className="text-slate-500 font-medium mt-2 max-w-md mx-auto">
          We'll translate your complex medical reports, prescriptions, or lab results into plain, easy-to-understand language.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-4 text-sm font-semibold text-center max-w-lg mx-auto">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Upload zone — disabled while auth session is still bootstrapping */}
      {authLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 shadow-lg text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 font-semibold text-sm">Setting up your secure session…</p>
        </div>
      ) : loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-16 shadow-lg text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="text-xl font-bold">Uploading Document...</h3>
          <div className="w-full bg-muted rounded-full h-3 max-w-md mx-auto overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-muted-foreground text-sm">{progress}% completed</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/50 rounded-3xl p-8 md:p-12 shadow-sm max-w-2xl mx-auto space-y-8">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`border-2 border-dashed rounded-2xl p-10 md:p-14 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
              dragActive 
                ? 'border-[#004bb3] bg-[#004bb3]/5' 
                : 'border-blue-200 dark:border-slate-800 hover:border-[#004bb3]/50'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf, .png, .jpg, .jpeg"
              className="hidden"
            />
            
            <div className="w-16 h-16 rounded-full bg-[#004bb3] flex items-center justify-center text-white text-2xl mb-6">
              📥
            </div>
            
            <h2 className="font-extrabold text-lg md:text-xl text-[#004bb3] mb-2">
              Click to upload or drag your prescription or report here
            </h2>
            
            <p className="text-slate-400 text-xs md:text-sm font-medium mb-6">
              Supported files: PDF, JPG, PNG (Max 20MB)
            </p>
            
            <button
              type="button"
              className="bg-[#004bb3] hover:bg-[#003d99] text-white font-extrabold px-6 py-3 rounded-full text-sm inline-flex items-center gap-2 shadow-sm"
            >
              ➕ Select File
            </button>
          </div>

          {/* Badges for document types */}
          <div className="flex flex-wrap justify-center gap-3">
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-4 py-2 rounded-full text-xs">
              📝 Prescription
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-4 py-2 rounded-full text-xs">
              🔬 Blood Test or Medical Report
            </span>
            <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-4 py-2 rounded-full text-xs">
              💵 Hospital Bill
            </span>
          </div>

          {/* Footer security badges */}
          <div className="grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-slate-800 pt-6 text-center text-[10px] md:text-xs font-semibold text-slate-400">
            <div className="flex flex-col items-center gap-1">
              <span>🔒</span>
              <span>Your files are private</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span>🗑️</span>
              <span>Files can be deleted anytime</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span>📚</span>
              <span>Educational use only</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
