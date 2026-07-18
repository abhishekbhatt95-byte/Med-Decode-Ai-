import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../utils/supabase'
import { useNavigate } from '@tanstack/react-router'
import { User, Settings, Sliders, LogOut, Mail, Database } from 'lucide-react'
import { AccessibilityPopover } from '../components/AccessibilityPopover'
import { useTranslation } from 'react-i18next'

export const ProfilePage: React.FC = () => {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { t } = useTranslation()
  const [isAccessPopoverOpen, setIsAccessPopoverOpen] = useState(false)


  const handleExportData = async () => {
    if (!user) return
    try {
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

  const handleClearDocuments = async () => {
    if (!user) return
    const confirm = window.confirm(
      t('landing.workflowTitle').includes('प्रक्रिया')
        ? 'क्या आप वाकई अपने सभी अपलोड किए गए दस्तावेज़ और सरलीकृत विश्लेषण रिकॉर्ड हटाना चाहते हैं? यह कार्रवाई स्थायी है।'
        : 'Are you sure you want to delete all your uploaded documents and simplified analysis records? This action is permanent.'
    )
    if (!confirm) return

    try {
      await supabase.from('data_deletion_requests').insert({
        user_id: user.id,
        status: 'completed',
        completed_at: new Date().toISOString()
      })

      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      alert(
        t('landing.workflowTitle').includes('प्रक्रिया')
          ? 'सभी दस्तावेज़ रिकॉर्ड सफलतापूर्वक हटा दिए गए!'
          : 'All document records cleared successfully!'
      )
    } catch (e: any) {
      alert(`Failed to clear records: ${e.message}`)
    }
  }

  return (
    <div className="py-8 px-4 max-w-4xl mx-auto space-y-6 text-left animate-fade-in">
      <div>
        <h1 className="text-3xl font-black text-foreground font-serif tracking-tight">{t('settings.title')}</h1>
      </div>

      {/* 1. Profile Information Card */}
      <section className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <User className="w-5 h-5 text-foreground" />
          <h2 className="text-xl font-bold text-foreground font-serif leading-none">{t('settings.profileInfo')}</h2>
        </div>

        <div className="flex items-center gap-5 pt-2">

          {/* User Avatar Circle */}
          <div className="w-16 h-16 rounded-full bg-[#E65F00] flex items-center justify-center text-white text-2xl font-black shrink-0 shadow-sm select-none">
            {(profile?.full_name?.charAt(0) || user?.email?.charAt(0) || 'G').toUpperCase()}
          </div>
          
          <div className="space-y-1">
            <span className="font-bold text-lg block text-foreground leading-snug">
              {profile?.full_name || (user?.email ? user.email.split('@')[0] : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'अतिथि उपयोगकर्ता' : 'Guest User'))}
            </span>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span className="text-sm font-semibold leading-none">
                {user?.is_anonymous ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'कोई ईमेल नहीं (अनाम अतिथि)' : 'No email (Anonymous Guest)') : (user?.email || (t('landing.workflowTitle').includes('प्रक्रिया') ? 'कोई ईमेल संबद्ध नहीं है' : 'No email associated'))}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Display Settings Card */}
      <section className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-foreground" />
          <h2 className="text-xl font-bold text-foreground font-serif leading-none">{t('settings.displaySettings')}</h2>
        </div>

        <p className="text-muted-foreground text-sm font-semibold">
          {t('settings.displaySub')}
        </p>

        {/* Accessibility sub-card */}
        <div className="border border-border rounded-2xl p-5 flex justify-between items-center bg-card">
          <div className="space-y-1">
            <span className="font-bold text-sm block text-foreground font-serif leading-normal">
              {t('settings.accessibilityTitle')}
            </span>
            <p className="text-xs text-muted-foreground font-semibold leading-normal">
              {t('settings.accessibilitySub')}
            </p>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setIsAccessPopoverOpen(!isAccessPopoverOpen)}
              className="p-3 bg-secondary/50 border border-border rounded-2xl flex items-center justify-center cursor-pointer hover:bg-secondary/80 transition-all shrink-0"
              aria-label="Toggle Accessibility Preferences"
            >
              <Sliders className="w-5 h-5 text-foreground" />
            </button>

            <AccessibilityPopover
              isOpen={isAccessPopoverOpen}
              onClose={() => setIsAccessPopoverOpen(false)}
            />
          </div>
        </div>
      </section>

      {/* 3. Data Management & Session Card */}
      <section className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-border">
          <Database className="w-5 h-5 text-foreground" />
          <h2 className="text-xl font-bold text-foreground font-serif leading-none">{t('settings.dataMgmt')}</h2>
        </div>

        <div className="divide-y divide-border">
          {/* Row 1: Export My Records */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 first:pt-0 gap-4">
            <div className="space-y-1">
              <span className="font-bold text-sm block text-foreground">{t('settings.exportTitle')}</span>
              <span className="text-xs text-muted-foreground block">{t('settings.exportText')}</span>
            </div>
            <button 
              onClick={handleExportData}
              className="bg-secondary text-secondary-foreground font-bold px-4 py-2 border border-border rounded-full hover:bg-muted cursor-pointer text-xs w-full sm:w-auto shrink-0 transition-all active:scale-[0.98] text-center"
            >
              {t('settings.exportBtn')}
            </button>
          </div>

          {/* Row 2: Clear Upload History */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-4 bg-rose-500/[0.02] -mx-6 md:-mx-8 px-6 md:px-8 border-y border-border/80">
            <div className="space-y-1">
              <span className="font-bold text-sm block text-rose-600 dark:text-rose-400">{t('settings.clearTitle')}</span>
              <span className="text-xs text-muted-foreground block">{t('settings.clearText')}</span>
            </div>
            <button 
              onClick={handleClearDocuments}
              className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold px-4 py-2 rounded-full hover:bg-rose-500/20 cursor-pointer text-xs w-full sm:w-auto shrink-0 transition-all active:scale-[0.98] text-center"
            >
              {t('settings.clearBtn')}
            </button>
          </div>

          {/* Row 3: Sign Out */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 last:pb-0 gap-4">
            <div className="space-y-1">
              <span className="font-bold text-sm block text-foreground">{t('settings.signOutTitle')}</span>
              <span className="text-xs text-muted-foreground block">{t('settings.signOutText')}</span>
            </div>
            <button 
              onClick={async () => {
                await signOut()
                navigate({ to: '/' })
              }}
              className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-full hover:opacity-95 cursor-pointer text-xs w-full sm:w-auto shrink-0 transition-all active:scale-[0.98] text-center flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t('settings.signOutBtn')}</span>
            </button>
          </div>
        </div>
      </section>

    </div>
  )
}
