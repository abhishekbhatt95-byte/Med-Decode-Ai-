import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import {
  FileText,
  CheckCircle2,
  Pill,
  Beaker,
  CreditCard,
  ClipboardList,
  Tag,
  Zap,
  BookOpen,
  FileSearch,
  Upload,
  Trash2,
  Lock
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10)
}

export const UploadPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { t } = useTranslation()

  
  // File and configuration states
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocType, setSelectedDocType] = useState<string>('prescription')
  const [selectedDetailLevel, setSelectedDetailLevel] = useState<string>('full')
  const [selectedLanguage, setSelectedLanguage] = useState<'english' | 'hindi'>('english')

  // Drag and drop / pipeline states
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isProcessingRef = useRef(false)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

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
      setSelectedFile(e.dataTransfer.files[0])
      setErrorMsg(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
      setErrorMsg(null)
    }
  }

  const processFile = async () => {
    if (!selectedFile || isProcessingRef.current) return

    setErrorMsg(null)

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(selectedFile.type) && !selectedFile.name.toLowerCase().endsWith('.heic')) {
      setErrorMsg("Wrong file type. Only PDF, JPG, PNG, and HEIC are supported.")
      return
    }

    const maxSize = 20 * 1024 * 1024
    if (selectedFile.size > maxSize) {
      setErrorMsg("File too large. Maximum file size is 20MB.")
      return
    }

    isProcessingRef.current = true
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()

    setLoading(true)
    setProgress(5)

    if (!user) {
      setErrorMsg(authLoading
        ? "Session is still setting up — please wait a moment and try again."
        : "Could not start a session. Please refresh the page and try again."
      )
      setLoading(false)
      setProgress(0)
      return
    }

    setProgress(10)

    try {
      const fileExt = selectedFile.name.split('.').pop()
      const folderName = user.id
      const uniquePart = generateId().replace(/-/g, '').substring(0, 8)
      const fileName = `${folderName}/${Date.now()}_${uniquePart}.${fileExt}`
      
      setProgress(30)
      
      const { data: storageData, error: storageErr } = await supabase.storage
        .from('Med Decode Ai')
        .upload(fileName, selectedFile, {
          cacheControl: '3600',
          upsert: false
        })

      if (storageErr) {
        throw new Error(`Upload error: ${storageErr.message}`)
      }

      setProgress(60)

      const sanitizedName = selectedFile.name.replace(/[^a-zA-Z0-9.\-_ ]/g, '_')

      const { data: docData, error: docErr } = await supabase
        .from('documents')
        .insert({
          user_id: user!.id,
          name: sanitizedName,
          file_path: storageData.path,
          mime_type: selectedFile.type || `image/${fileExt}`,
          size: selectedFile.size,
          status: 'uploaded',
          document_type: selectedDocType,
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
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type || `image/${fileExt}`,
      })

      setProgress(100)

      setTimeout(() => {
        navigate({ 
          to: '/processing', 
          search: { 
            docId: docData.id,
            detailLevel: selectedDetailLevel,
            docType: selectedDocType,
            outputLanguage: selectedLanguage
          }
        })
      }, 500)

    } catch (err: any) {
      if (err?.name === 'AbortError') return
      console.error("Pipeline error:", err)
      setErrorMsg(err?.message || String(err) || "Failed to complete upload pipeline.")
      setProgress(0)
      setLoading(false)

      try {
        await supabase.from('failed_uploads').insert({
          user_id: user?.id ?? null,
          file_name: selectedFile?.name || "unknown",
          error_message: err?.message || String(err) || "Unknown upload error",
        })
      } catch (logErr) {
        console.error("Failed to log failed upload in database", logErr)
      }
    } finally {
      isProcessingRef.current = false
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Card selections list
  const docTypeOptions = [
    { key: 'prescription', label: t('dashboard.filterPrescriptions'), icon: <Pill className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'दवा के नाम, खुराक की समय सारणी, रिफिल।' : 'Medication names, dosage schedules, refills.' },
    { key: 'blood_report', label: t('dashboard.filterBlood'), icon: <Beaker className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'लैब मान, संदर्भ सीमाएँ, परीक्षण किए गए पैनल।' : 'Lab values, reference ranges, tested panels.' },
    { key: 'hospital_bill', label: t('dashboard.filterBills'), icon: <CreditCard className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'चालान, बीमा कोडिंग, मदवार लागत।' : 'Invoices, insurance codings, itemized costs.' },
    { key: 'discharge_summary', label: t('dashboard.dischargeSummary'), icon: <ClipboardList className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'नैदानिक पाठ्यक्रम, निदान, डिस्चार्ज देखभाल।' : 'Clinical courses, diagnoses, discharge care.' },
    { key: 'medicine_label', label: t('dashboard.medicineLabel'), icon: <Tag className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'फार्मेसी की बोतलें, चेतावनी, खुराक गाइड।' : 'Pharmacy bottles, warnings, intake guides.' }
  ]

  const detailLevelOptions = [
    { key: 'quick', label: t('landing.workflowTitle').includes('प्रक्रिया') ? 'त्वरित सारांश' : 'Quick Summary', icon: <Zap className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'मुख्य संख्याओं पर केंद्रित एक अत्यंत संक्षिप्त, सरल-अंग्रेजी/हिंदी अवलोकन।' : 'An ultra-concise, plain-English overview focused on key numbers.' },
    { key: 'full', label: t('landing.workflowTitle').includes('प्रक्रिया') ? 'पूर्ण अनुवाद' : 'Full Translation', icon: <BookOpen className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'नैदानिक शब्दों को सरल शब्दों में दर्शाने वाली एक पूर्ण, विस्तृत रोगी मार्गदर्शिका।' : 'A complete, detailed patient guide mapping clinical terms to plain words.' },
    { key: 'audit', label: t('landing.workflowTitle').includes('प्रक्रिया') ? 'चिकित्सा लेखा परीक्षा' : 'Medical Audit', icon: <FileSearch className="w-6 h-6" />, desc: t('landing.workflowTitle').includes('प्रक्रिया') ? 'खुराक, असामान्यताओं और डॉक्टर के प्रश्नों की गहन सुरक्षा समीक्षा।' : 'Deep safety review checking dosages, abnormalities, and clinician questions.' }
  ]

  return (
    <div className="py-6 px-4 max-w-4xl mx-auto space-y-12">
      {/* Title */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl md:text-4xl font-black text-foreground font-serif">
          {t('landing.workflowTitle').includes('प्रक्रिया') ? 'नया दस्तावेज़ अनुवाद' : 'New Document Translation'}
        </h1>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
          {t('landing.workflowTitle').includes('प्रक्रिया') 
            ? 'अपने मेडिकल कागजात को आरामदायक, स्पष्ट हिंदी या अंग्रेजी में अनुवाद करने के लिए नीचे दिए गए तीन चरणों का पालन करें।' 
            : 'Follow the three steps below to upload, configure, and parse your medical papers into comforting, clear English.'}
        </p>
      </div>

      {errorMsg && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-4 text-sm font-semibold text-center max-w-lg mx-auto shadow-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      {authLoading ? (
        <div className="bg-card border border-border rounded-3xl p-16 shadow-sm text-center space-y-4 max-w-2xl mx-auto">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground font-semibold text-sm">
            {t('landing.workflowTitle').includes('प्रक्रिया') ? 'सुरक्षित अनुवाद सत्र सेट किया जा रहा है...' : 'Setting up secure translation session…'}
          </p>
        </div>
      ) : loading ? (
        <div className="bg-card border border-border rounded-3xl p-16 shadow-sm text-center space-y-6 max-w-2xl mx-auto">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <h3 className="text-xl font-bold font-serif">
            {t('landing.workflowTitle').includes('प्रक्रिया') ? 'दस्तावेज़ अपलोड किया जा रहा है...' : 'Uploading Document...'}
          </h3>

          <div className="w-full bg-muted rounded-full h-3 max-w-md mx-auto overflow-hidden">
            <div 
              className="bg-primary h-full transition-all duration-300 rounded-full" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-muted-foreground text-sm">
            {progress}% {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पूरा हुआ' : 'completed'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          
          {/* STEP 1: File Upload Box */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">1</span>
              <h2 className="text-lg font-black font-serif text-foreground">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'चिकित्सा दस्तावेज़ अपलोड करें' : 'Upload Medical Document'}
              </h2>
            </div>

            {!selectedFile ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={triggerFileSelect}
                className={`border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all flex flex-col items-center justify-center cursor-pointer ${
                  dragActive 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf, .png, .jpg, .jpeg"
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl mb-4">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-foreground mb-1">
                  {t('landing.workflowTitle').includes('प्रक्रिया') 
                    ? 'अपनी फ़ाइल यहाँ खींचें और छोड़ें, या ब्राउज़ करने के लिए क्लिक करें' 
                    : 'Drag and drop your file here, or click to browse'}
                </h3>
                <p className="text-muted-foreground text-xs font-semibold">
                  {t('landing.workflowTitle').includes('प्रक्रिया') 
                    ? 'PDF, JPG, PNG, या HEIC का समर्थन करता है (अधिकतम 20MB)' 
                    : 'Supports PDF, JPG, PNG, or HEIC (Max 20MB)'}
                </p>
              </div>
            ) : (
              <div className="border border-border bg-muted/30 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground break-all">{selectedFile.name}</h3>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {formatBytes(selectedFile.size)} • {selectedFile.type || 'unknown type'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="px-4 py-2 border border-destructive/20 hover:border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                  aria-label="Remove uploaded file"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('landing.workflowTitle').includes('प्रक्रिया') ? 'हटाएँ' : 'Remove'}</span>
                </button>
              </div>
            )}
          </div>


          {/* STEP 2: Document Type Selection Cards */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">2</span>
              <h2 className="text-lg font-black font-serif text-foreground">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'दस्तावेज़ प्रकार चुनें' : 'Select Document Type'}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {docTypeOptions.map((opt) => {
                const isActive = selectedDocType === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedDocType(opt.key)}
                    className={`p-6 rounded-3xl border text-left flex flex-col justify-between min-h-[11.5rem] transition-all cursor-pointer relative group ${
                      isActive 
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary' 
                        : 'border-border bg-card hover:border-primary/40 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
                      } transition-colors`}>
                        {opt.icon}
                      </div>
                      {isActive && (
                        <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-foreground mt-4">{opt.label}</h4>
                      <p className="text-xs font-semibold text-muted-foreground mt-1.5 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 3: Detail Level Selection Cards */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">3</span>
              <h2 className="text-lg font-black font-serif text-foreground">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'स्पष्टीकरण की गहराई चुनें' : 'Choose Explanation Depth'}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {detailLevelOptions.map((opt) => {
                const isActive = selectedDetailLevel === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedDetailLevel(opt.key)}
                    className={`p-6 rounded-3xl border text-left flex flex-col justify-between min-h-[11.5rem] transition-all cursor-pointer relative group ${
                      isActive 
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary' 
                        : 'border-border bg-card hover:border-primary/40 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                        isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10'
                      } transition-colors`}>
                        {opt.icon}
                      </div>
                      {isActive && (
                        <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-foreground mt-4">{opt.label}</h4>
                      <p className="text-xs font-semibold text-muted-foreground mt-1.5 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* STEP 4: Report Language */}
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs">4</span>
              <h2 className="text-lg font-black font-serif text-foreground">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'रिपोर्ट की भाषा चुनें' : 'Report Language'}
              </h2>
            </div>
            <p className="text-xs font-semibold text-muted-foreground -mt-2">
              {t('landing.workflowTitle').includes('प्रक्रिया')
                ? 'AI विश्लेषण (सारांश, स्पष्टीकरण, सुझाव) किस भाषा में तैयार हो?'
                : 'Choose the language for AI-generated report content (summary, explanations, doctor questions).'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                {
                  key: 'english' as const,
                  label: 'English',
                  flag: '🇬🇧',
                  desc: t('landing.workflowTitle').includes('प्रक्रिया')
                    ? 'डिफ़ॉल्ट। रिपोर्ट सादी अंग्रेजी में तैयार होगी।'
                    : 'Default. Report generated in plain, clear English.',
                },
                {
                  key: 'hindi' as const,
                  label: 'हिंदी (Hindi)',
                  flag: '🇮🇳',
                  desc: t('landing.workflowTitle').includes('प्रक्रिया')
                    ? 'रिपोर्ट हिंदी में तैयार होगी। चिकित्सा नाम अंग्रेजी में रहेंगे।'
                    : 'Report generated in Hindi. Medicine names stay in English as per Indian clinical practice.',
                },
              ] as const).map((opt) => {
                const isActive = selectedLanguage === opt.key
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSelectedLanguage(opt.key)}
                    className={`p-6 rounded-3xl border text-left flex flex-col justify-between min-h-[8rem] transition-all cursor-pointer relative group ${
                      isActive
                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary'
                        : 'border-border bg-card hover:border-primary/40 hover:scale-[1.01]'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className="text-3xl">{opt.flag}</span>
                      {isActive && <CheckCircle2 className="w-6 h-6 text-primary shrink-0" />}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-foreground mt-3">{opt.label}</h4>
                      <p className="text-xs font-semibold text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex flex-col items-center space-y-6 pt-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Lock className="w-3.5 h-3.5 text-primary" />
              <span>
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'आपके दस्तावेज़ निजी हैं और कभी साझा नहीं किए जाते।' : 'Your documents are private and never shared.'}
              </span>
            </div>

            <button
              type="button"
              onClick={processFile}
              disabled={!selectedFile}
              className={`w-full max-w-md py-4 rounded-full font-black text-center shadow-lg transition-all text-sm md:text-base flex items-center justify-center gap-2.5 ${
                selectedFile 
                  ? 'bg-primary text-primary-foreground hover:opacity-95 cursor-pointer active:scale-[0.99]' 
                  : 'bg-muted border border-border text-muted-foreground cursor-not-allowed opacity-60'
              }`}
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'दस्तावेज़ का विश्लेषण करें' : 'Analyze Document Now'}
              </span>
            </button>
          </div>


        </div>
      )}
    </div>
  )
}
