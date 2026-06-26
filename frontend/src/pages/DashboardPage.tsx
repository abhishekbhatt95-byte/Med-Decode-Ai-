import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { supabase } from '../utils/supabase'
import { useAuth } from '../context/AuthContext'

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
  
  // State variables
  const [documents, setDocuments] = useState<Document[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string>('all')

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

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate({ to: '/auth' })
      return
    }

    fetchDocuments()

    // Subscribe to realtime updates for document status changes
    const channel = supabase
      .channel('document-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents', filter: `user_id=eq.${user.id}` },
        () => {
          fetchDocuments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, authLoading, navigate])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent row click navigation
    const confirm = window.confirm("Are you sure you want to permanently delete this document and its analysis records? This meets your DPDP deletion request rights.")
    if (!confirm) return

    try {
      // Create deletion requests logs
      await supabase.from('data_deletion_requests').insert({
        user_id: user?.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      // Delete document (cascade rules will delete extracted_text and analyses)
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Refresh list
      setDocuments(prev => prev.filter(doc => doc.id !== id))
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`)
    }
  }

  // Formatting utilities
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

  // Filter and search logic
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    if (activeFilter === 'all') return matchesSearch
    return matchesSearch && doc.document_type === activeFilter
  })

  // Group filters
  const filterOptions = [
    { key: 'all', label: 'All Files' },
    { key: 'prescription', label: 'Prescriptions' },
    { key: 'blood_report', label: 'Blood Reports' },
    { key: 'hospital_bill', label: 'Bills' },
    { key: 'discharge_summary', label: 'Discharge Summaries' },
    { key: 'medicine_label', label: 'Labels' }
  ]

  if (authLoading || loadingDocs) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">Retrieving document history...</p>
      </div>
    )
  }

  return (
    <div className="py-6 px-4 max-w-6xl mx-auto space-y-8">
      
      {/* Dashboard Top Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-1">Translate, manage, and audit your medical document history</p>
        </div>
        <Link
          to="/upload"
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-primary/20 hover:opacity-95 transition-all text-base cursor-pointer"
        >
          ➕ Upload Document
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-stretch">
        {/* Search Input */}
        <div className="flex-1 max-w-md relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 Search files by name..."
            className="w-full border border-border rounded-xl px-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/50 text-base shadow-sm"
          />
        </div>
        
        {/* Filter Badges */}
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

      {/* Document History Table / List */}
      {filteredDocuments.length === 0 ? (
        <div className="bg-card border border-border border-dashed rounded-2xl p-16 text-center text-muted-foreground shadow-sm">
          <span className="text-5xl mb-4 block">📁</span>
          <h3 className="text-lg font-bold text-foreground mb-1">No Documents Found</h3>
          <p className="text-sm max-w-sm mx-auto mb-6">
            {searchQuery 
              ? "We couldn't find any documents matching your search term."
              : "You haven't uploaded any medical records yet. Click Upload above to start."}
          </p>
          {!searchQuery && (
            <Link
              to="/upload"
              className="bg-primary text-primary-foreground font-bold px-6 py-2.5 rounded-xl inline-block"
            >
              Upload First File
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredDocuments.map((doc) => {
            let statusBadge = "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
            let statusLabel = "Processing"
            let icon = "⏳"
            let cursorStyle = "cursor-wait"
            let routeTarget = `/processing`

            if (doc.status === 'completed') {
              statusBadge = "bg-green-500/10 text-green-600 border-green-500/20"
              statusLabel = "Ready"
              icon = "✅"
              cursorStyle = "cursor-pointer"
              routeTarget = `/results`
            } else if (doc.status === 'failed') {
              statusBadge = "bg-destructive/10 text-destructive border-destructive/20"
              statusLabel = "Failed"
              icon = "❌"
              cursorStyle = "cursor-pointer"
              routeTarget = `/processing`
            }

            return (
              <div
                key={doc.id}
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
                      <span>Uploaded: {formatDate(doc.created_at)}</span>
                      <span>•</span>
                      <span>Size: {formatBytes(doc.size)}</span>
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
                  {/* Status Indicator */}
                  <span className={`border px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${statusBadge}`}>
                    <span>{icon}</span>
                    <span>{statusLabel}</span>
                  </span>

                  {/* Actions */}
                  <button
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl transition-all cursor-pointer"
                    title="Delete document and wipe logs"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Trust foot banner */}
      <div className="text-center text-xs text-muted-foreground pt-4">
        🔒 All files and extracted medical analysis records are fully encrypted and private to your account.
      </div>
    </div>
  )
}
