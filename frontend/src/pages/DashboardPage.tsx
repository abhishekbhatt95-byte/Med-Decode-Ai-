import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { EmptyState } from '../components/EmptyState'
import { useTranslation } from 'react-i18next'

interface Document {
  id: string
  name: string
  created_at: string
  size: number
  status: 'uploaded' | 'processing' | 'completed' | 'failed'
  document_type: string
  is_medical: boolean
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { t } = useTranslation()

  
  
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [todayUsage, setTodayUsage] = useState<number | null>(null)

  const fetchDocuments = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (err) {
      console.error("Error fetching documents:", err)
    } finally {
      setLoadingDocs(false)
    }
  }

  const fetchUsage = async () => {
    if (!user) return
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('usage')
        .select('count')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle()

      if (error) throw error
      setTodayUsage(data?.count ?? 0)
    } catch (err) {
      console.error("Error fetching usage:", err)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate({ to: '/auth' })
      return
    }

    fetchDocuments()
    fetchUsage()

    
    const channel = supabase
      .channel('document-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
        () => {
          fetchDocuments()
          fetchUsage()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, authLoading, navigate])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() 
    const confirm = window.confirm(t('dashboard.deleteConfirm'))
    if (!confirm) return

    try {
      
      await supabase.from('data_deletion_requests').insert({
        user_id: user?.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) throw error

      
      setDocuments(prev => prev.filter(doc => doc.id !== id))
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`)
    }
  }

  
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (activeFilter === 'all') return matchesSearch
    return matchesSearch && doc.document_type === activeFilter
  })

  
  const filterOptions = [
    { key: 'all', label: t('dashboard.filterAll') },
    { key: 'prescription', label: t('dashboard.filterPrescriptions') },
    { key: 'blood_report', label: t('dashboard.filterBlood') },
    { key: 'hospital_bill', label: t('dashboard.filterBills') },
    { key: 'discharge_summary', label: t('dashboard.dischargeSummary') },
    { key: 'medicine_label', label: t('dashboard.medicineLabel') }
  ]


  if (authLoading || loadingDocs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">{t('consent.faq4A').includes('प्रक्रिया') ? 'दस्तावेज़ इतिहास प्राप्त किया जा रहा है...' : 'Retrieving document history...'}</p>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="py-6 px-4 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-black text-foreground font-serif">{t('dashboard.title')}</h1>
            <p className="text-muted-foreground mt-1 mb-2">{t('dashboard.subtitle')}</p>
            {todayUsage !== null && (
              <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-bold shadow-sm">
                📊 {t('landing.workflowTitle').includes('प्रक्रिया') 
                  ? `10 में से ${todayUsage} दैनिक मुफ्त विश्लेषणों का उपयोग किया गया`
                  : `${todayUsage} of 10 daily free analyses used`}
              </span>
            )}
          </div>
          <Link
            to="/upload"
            className="bg-primary text-primary-foreground font-bold px-6 py-3.5 rounded-full shadow-md hover:opacity-95 transition-all text-sm cursor-pointer"
          >
            {t('dashboard.newBtn')}
          </Link>
        </div>

        <EmptyState
          icon={<FileText className="w-8 h-8 text-primary" />}
          title={t('dashboard.emptyTitle')}
          description={t('dashboard.emptyText')}
          actionLabel={t('landing.ctaUpload')}
          onAction={() => navigate({ to: '/upload' })}
        />
      </div>
    )
  }


  const listVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
    },
  };

  return (
    <div className="py-6 px-4 max-w-6xl mx-auto space-y-8">
      
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground font-serif">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground mt-1 mb-2">{t('dashboard.subtitle')}</p>
          {todayUsage !== null && (
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 rounded-full px-3 py-1 text-xs font-bold shadow-sm">
              📊 {t('landing.workflowTitle').includes('प्रक्रिया') 
                ? `10 में से ${todayUsage} दैनिक मुफ्त विश्लेषणों का उपयोग किया गया`
                : `${todayUsage} of 10 daily free analyses used`}
            </span>
          )}
        </div>
        <Link
          to="/upload"
          className="bg-primary text-primary-foreground font-bold px-6 py-3.5 rounded-full shadow-md hover:opacity-95 transition-all text-sm cursor-pointer"
        >
          {t('dashboard.newBtn')}
        </Link>
      </div>

      
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
        
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`🔍 ${t('dashboard.searchPlaceholder')}`}
            className="w-full border border-border rounded-xl px-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 text-base shadow-sm"
          />
        </div>
        
        
        <div className="flex flex-wrap gap-2 items-center">
          {filterOptions.map(opt => (
            <button
              key={opt.key}
              onClick={() => setActiveFilter(opt.key)}
              className={`px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                activeFilter === opt.key
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      
      {filteredDocuments.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl p-16 text-center text-muted-foreground shadow-sm">
          <span className="text-5xl mb-4 block">📁</span>
          <h3 className="text-lg font-bold text-foreground mb-1">
            {t('landing.workflowTitle').includes('प्रक्रिया') ? 'कोई दस्तावेज़ नहीं मिला' : 'No Documents Found'}
          </h3>
          <p className="text-sm max-w-sm mx-auto mb-6">
            {searchQuery 
              ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'हम आपकी खोज से मेल खाने वाला कोई दस्तावेज़ नहीं ढूंढ सके।' : "We couldn't find any documents matching your search term.")
              : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'आपने अभी तक कोई मेडिकल रिकॉर्ड अपलोड नहीं किया है। शुरू करने के लिए ऊपर अपलोड पर क्लिक करें।' : "You haven't uploaded any medical records yet. Click Upload above to start.")}
          </p>
          {!searchQuery && (
            <Link
              to="/upload"
              className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl inline-block"
            >
              {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पहली फ़ाइल अपलोड करें' : 'Upload First File'}
            </Link>
          )}
        </div>
      ) : (
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 gap-4"
        >
          {filteredDocuments.map((doc) => {
            let statusBadge = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            let statusLabel = "Processing"
            let icon = "⏳"
            let cursorStyle = "cursor-wait"
            let routeTarget = `/processing`

            if (doc.status === 'completed') {
              statusBadge = "bg-green-500/10 text-green-600 border-green-500/20"
              statusLabel = t('landing.workflowTitle').includes('प्रक्रिया') ? 'तैयार' : 'Ready'
              icon = "✅"
              cursorStyle = "cursor-pointer"
              routeTarget = `/results`
            } else if (doc.status === 'failed') {
              statusBadge = "bg-destructive/10 text-destructive border-destructive/20"
              statusLabel = t('landing.workflowTitle').includes('प्रक्रिया') ? 'विफल' : 'Failed'
              icon = "❌"
              cursorStyle = "cursor-pointer"
              routeTarget = `/processing`
            } else {
              statusLabel = t('landing.workflowTitle').includes('प्रक्रिया') ? 'प्रसंस्करण' : 'Processing'
            }

            return (
              <motion.div
                key={doc.id}
                variants={itemVariants}
                onClick={() => navigate({ to: routeTarget, search: { docId: doc.id } })}
                className={`bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${cursorStyle}`}
              >
                <div className="flex items-start gap-4">
                  <span className="text-3xl mt-1">📄</span>
                  <div>
                    <h3 className="font-extrabold text-base md:text-lg text-foreground hover:text-primary transition-colors">
                      {doc.name}
                    </h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span>{t('landing.workflowTitle').includes('प्रक्रिया') ? 'अपलोड किया गया:' : 'Uploaded:'} {formatDate(doc.created_at)}</span>
                      <span>•</span>
                      <span>{t('landing.workflowTitle').includes('प्रक्रिया') ? 'आकार:' : 'Size:'} {formatBytes(doc.size)}</span>
                      {doc.document_type !== 'unknown' && (
                        <>
                          <span>•</span>
                          <span className="bg-muted px-2 py-0.5 rounded font-semibold text-foreground uppercase tracking-wide">
                            {doc.document_type.replace('_', ' ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                  
                  <span className={`border px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${statusBadge}`}>
                    <span>{icon}</span>
                    <span>{statusLabel}</span>
                  </span>

                  
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer"
                    title={t('landing.workflowTitle').includes('प्रक्रिया') ? 'दस्तावेज़ हटाएँ' : 'Delete document and wipe logs'}
                  >
                    🗑️
                  </button>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      
      <div className="text-center text-xs text-muted-foreground pt-4">
        {t('landing.workflowTitle').includes('प्रक्रिया') 
          ? '🔒 सभी फाइलें और निकाले गए चिकित्सा विश्लेषण रिकॉर्ड आपके खाते के लिए निजी हैं और कभी साझा नहीं किए जाते हैं।' 
          : '🔒 All files and extracted medical analysis records are private and never shared.'}
      </div>

    </div>
  )
}
