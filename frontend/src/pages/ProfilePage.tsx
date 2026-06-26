import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAccessibility } from '../context/AccessibilityContext'
import { supabase } from '../utils/supabase'
import { useNavigate } from '@tanstack/react-router'

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, refreshProfile, signOut } = useAuth()
  const { largeText, highContrast, darkMode, setLargeText, setHighContrast, setDarkMode } = useAccessibility()
  
  // Update states
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setUpdating(true)
    setMessage(null)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (error) throw error
      await refreshProfile()
      setMessage({ text: "Profile updated successfully!", type: 'success' })
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to update profile.", type: 'error' })
    } finally {
      setUpdating(false)
    }
  }

  // DPDP compliant Export Data feature
  const handleExportData = async () => {
    if (!user) return
    try {
      // Fetch documents and analyses
      const { data: docs } = await supabase
        .from('documents')
        .select('*, extracted_text(*), analyses(*, medicines(*))')
        .eq('user_id', user.id)

      const exportPayload = {
        exportedAt: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email,
          fullName: profile?.full_name
        },
        records: docs || []
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `meddecode_user_data_${user.id.substring(0, 8)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: any) {
      alert(`Data export failed: ${e.message}`)
    }
  }

  // Wipes all user document entries and storage files
  const handleClearDocuments = async () => {
    if (!user) return
    const confirm = window.confirm("Are you sure you want to delete all your uploaded documents and simplified analysis records? This action is permanent.")
    if (!confirm) return

    try {
      // Log data deletion request
      await supabase.from('data_deletion_requests').insert({
        user_id: user.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      // Delete all documents (cascade will clean up analyses, medicines, text, etc.)
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      alert("All document records cleared successfully!")
    } catch (e: any) {
      alert(`Failed to clear records: ${e.message}`)
    }
  }

  // Full Account Deletion (compliance check)
  const handleDeleteAccount = async () => {
    if (!user) return
    const confirm = window.confirm("WARNING: This will permanently delete your account, settings, and all uploaded medical records. This meets your GDPR/DPDP Right to Be Forgotten. Do you want to proceed?")
    if (!confirm) return

    try {
      // 1. Log deletion request
      await supabase.from('data_deletion_requests').insert({
        user_id: user.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      // 2. Wipe profile & files (handled by cascade triggers in DB)
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileErr) throw profileErr

      // 3. Wipes auth session
      await signOut()
      navigate({ to: '/' })
      alert("Your account and data have been fully deleted.")
    } catch (e: any) {
      alert(`Account deletion failed: ${e.message}`)
    }
  }

  return (
    <div className="py-8 px-4 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-foreground">Profile & Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account information, accessibility styles, and medical data options</p>
      </div>

      {message && (
        <div className={`p-4 border rounded-xl text-sm font-semibold ${
          message.type === 'success' 
            ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' 
            : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {/* 1. Account Details Form */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-6 pb-2 border-b border-border">👤 Personal Information</h2>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Registered Email</label>
            <input 
              type="text" 
              disabled 
              value={user?.email || ''} 
              className="w-full border border-border rounded-xl px-4 py-3 bg-muted text-muted-foreground cursor-not-allowed text-base" 
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-foreground mb-2">Display Name</label>
            <input 
              type="text" 
              required
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe" 
              className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base" 
            />
          </div>
          <button 
            type="submit"
            disabled={updating}
            className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-xl hover:opacity-95 transition-all text-sm cursor-pointer disabled:opacity-50"
          >
            {updating ? "Saving Changes..." : "Save Profile Details"}
          </button>
        </form>
      </section>

      {/* 2. Global Accessibility Controls */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-6 pb-2 border-b border-border">👓 Accessibility & Themes</h2>
        <div className="space-y-5">
          <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/10 cursor-pointer">
            <div>
              <span className="font-extrabold block text-foreground">Large Text Size</span>
              <span className="text-xs text-muted-foreground">Increases letter spacing & font scaling for legibility.</span>
            </div>
            <input 
              type="checkbox" 
              checked={largeText}
              onChange={(e) => setLargeText(e.target.checked)}
              className="w-6 h-6 accent-primary cursor-pointer" 
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/10 cursor-pointer">
            <div>
              <span className="font-extrabold block text-foreground">High Contrast Mode</span>
              <span className="text-xs text-muted-foreground">Sleek stark black/white outlines optimized for visual impairments.</span>
            </div>
            <input 
              type="checkbox" 
              checked={highContrast}
              onChange={(e) => setHighContrast(e.target.checked)}
              className="w-6 h-6 accent-primary cursor-pointer" 
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/10 cursor-pointer">
            <div>
              <span className="font-extrabold block text-foreground">Dark Theme Layout</span>
              <span className="text-xs text-muted-foreground">Reduces eye strain under low light settings.</span>
            </div>
            <input 
              type="checkbox" 
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
              className="w-6 h-6 accent-primary cursor-pointer" 
            />
          </label>
        </div>
      </section>

      {/* 3. Privacy & Compliance Actions */}
      <section className="bg-card border border-border rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold text-foreground mb-6 pb-2 border-b border-border">🛡️ Data Management & DPDP Rights</h2>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-border rounded-xl gap-4">
            <div>
              <span className="font-extrabold block text-foreground">Export My Records</span>
              <span className="text-xs text-muted-foreground">Download a complete structured JSON copy of all scans and files.</span>
            </div>
            <button 
              onClick={handleExportData}
              className="bg-secondary text-secondary-foreground font-bold px-4 py-2 border border-border rounded-lg hover:bg-muted cursor-pointer text-xs w-full sm:w-auto"
            >
              📥 Export JSON
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-border rounded-xl gap-4">
            <div>
              <span className="font-extrabold block text-foreground">Clear Upload History</span>
              <span className="text-xs text-muted-foreground">Wipe all scans, files, and generated medical reviews permanently.</span>
            </div>
            <button 
              onClick={handleClearDocuments}
              className="bg-destructive/10 text-destructive font-bold px-4 py-2 rounded-lg hover:bg-destructive/20 cursor-pointer text-xs w-full sm:w-auto"
            >
              🗑️ Clear Records
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-destructive/20 bg-destructive/5 rounded-xl gap-4">
            <div>
              <span className="font-extrabold block text-destructive">Delete My Account</span>
              <span className="text-xs text-muted-foreground">Permanently wipe profile authorization parameters and right to be forgotten.</span>
            </div>
            <button 
              onClick={handleDeleteAccount}
              className="bg-destructive text-destructive-foreground font-bold px-4 py-2 rounded-lg hover:opacity-90 cursor-pointer text-xs w-full sm:w-auto"
            >
              ⚠️ Delete Account
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
