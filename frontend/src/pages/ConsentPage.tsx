import React, { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'

export const ConsentPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { t } = useTranslation()

  
  
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [aiAccepted, setAiAccepted] = useState(false)
  
  
  const [submitting, setSubmitting] = useState(false)
  const [checkingConsent, setCheckingConsent] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  
  useEffect(() => {
    if (loading) return
    if (!user) {
      const isAccepted = localStorage.getItem('guest_consent_accepted') === 'true'
      if (isAccepted) {
        navigate({ to: '/upload' })
      } else {
        setCheckingConsent(false)
      }
      return
    }

    const verifyConsent = async () => {
      try {
        
        const { data: legalData, error: legalErr } = await supabase
          .from('legal_acceptances')
          .select('id')
          .eq('user_id', user.id)
          .eq('document_version', 'v1.0')
          .limit(1)

        
        const { data: privacyData, error: privacyErr } = await supabase
          .from('privacy_consents')
          .select('id')
          .eq('user_id', user.id)
          .eq('consent_type', 'data_processing')
          .eq('is_granted', true)
          .limit(1)

        if (!legalErr && !privacyErr && legalData?.length && privacyData?.length) {
          
          navigate({ to: '/dashboard' })
        }
      } catch (err) {
        console.error("Error checking consent:", err)
      } finally {
        setCheckingConsent(false)
      }
    }

    verifyConsent()
  }, [user, loading, navigate])

  const handleDecline = async () => {
    
    await supabase.auth.signOut()
    navigate({ to: '/' })
  }

  const handleAccept = async () => {
    if (!termsAccepted || !privacyAccepted || !aiAccepted) {
      setErrorMsg(
        t('landing.workflowTitle').includes('प्रक्रिया')
          ? 'आगे बढ़ने के लिए आपको सभी शर्तों, नीतियों और खुलासे को स्वीकार करना होगा।'
          : 'You must accept all terms, policies, and disclosures to proceed.'
      )
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    if (!user) {
      localStorage.setItem('guest_consent_accepted', 'true')
      setSubmitting(false)
      navigate({ to: '/upload' })
      return
    }

    try {
      
      const { error: legalErr } = await supabase
        .from('legal_acceptances')
        .insert({
          user_id: user.id,
          document_version: 'v1.0',
        })

      if (legalErr) throw new Error(legalErr.message)

      
      const { error: privacyErr } = await supabase
        .from('privacy_consents')
        .insert({
          user_id: user.id,
          consent_type: 'data_processing',
          is_granted: true,
        })

      if (privacyErr) throw new Error(privacyErr.message)

      
      const { error: logErr } = await supabase
        .from('consent_logs')
        .insert({
          user_id: user.id,
          action: 'grant',
          consent_type: 'data_processing',
          user_agent: navigator.userAgent,
        })

      if (logErr) throw new Error(logErr.message)

      
      navigate({ to: '/dashboard' })
    } catch (err: any) {
      setErrorMsg(
        err.message || 
        (t('landing.workflowTitle').includes('प्रक्रिया') ? 'सहमति दर्ज करने में विफल। कृपया पुन: प्रयास करें।' : 'Failed to record consent. Please try again.')
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || checkingConsent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-muted-foreground">
          {t('landing.workflowTitle').includes('प्रक्रिया') ? 'प्राधिकरण विवरण की जाँच की जा रही है...' : 'Checking authorization details...'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-8 px-4 max-w-2xl mx-auto">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-8 w-full">
        <div className="text-center mb-6">
          <span className="text-4xl">📋</span>
          <h1 className="text-3xl font-extrabold text-foreground mt-2">{t('consent.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('consent.subtitle')}</p>
        </div>

        {errorMsg && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-4 mb-6 text-sm font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="space-y-6 mb-8 text-neutral-600 dark:text-neutral-300 text-sm md:text-base max-h-80 overflow-y-auto border border-border rounded-xl p-5 bg-muted/30">
          
          <section>
            <h3 className="font-bold text-foreground mb-1 text-base">{t('consent.faq1Q')}</h3>
            <p className="leading-relaxed">
              {t('consent.faq1A')}
            </p>
          </section>

          <section>
            <h3 className="font-bold text-foreground mb-1 text-base">{t('consent.faq2Q')}</h3>
            <p className="leading-relaxed">
              {t('consent.faq2A')}
            </p>
          </section>

          <section>
            <h3 className="font-bold text-foreground mb-1 text-base">{t('consent.faq3Q')}</h3>
            <p className="leading-relaxed">
              {t('consent.faq3A')}
            </p>
          </section>

          <section>
            <h3 className="font-bold text-foreground mb-1 text-base">{t('consent.faq4Q')}</h3>
            <p className="leading-relaxed">
              {t('consent.faq4A')}
            </p>
          </section>
        </div>

        
        <div className="space-y-4 mb-8">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-foreground">
              {t('consent.chkTerms')}
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-foreground">
              {t('consent.chkPrivacy')}
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={aiAccepted}
              onChange={(e) => setAiAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 accent-primary cursor-pointer"
            />
            <span className="text-sm font-medium text-foreground">
              {t('consent.chkAi')}
            </span>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleDecline}
            disabled={submitting}
            className="flex-1 bg-secondary text-secondary-foreground font-semibold px-6 py-3.5 rounded-xl border border-border hover:bg-muted transition-all cursor-pointer text-base disabled:opacity-50"
          >
            {t('consent.btnDecline')}
          </button>
          <button
            onClick={handleAccept}
            disabled={submitting}
            className="flex-1 bg-primary text-primary-foreground font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-all cursor-pointer text-base disabled:opacity-50"
          >
            {submitting ? t('consent.btnAgreeing') : t('consent.btnAccept')}
          </button>
        </div>
      </div>
    </div>

  )
}
