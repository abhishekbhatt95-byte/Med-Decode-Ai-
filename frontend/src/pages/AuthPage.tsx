import React, { useState } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '../context/AuthContext'
import { checkAuthRateLimit, recordAuthAttempt } from '../utils/rateLimiter'
import { Mail, Lock, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'magiclink'

export const AuthPage: React.FC = () => {
  const navigate = useNavigate()
  const { user, isAnonymous, upgradeAnonymous } = useAuth()
  const { t } = useTranslation()
  const [mode, setMode] = useState<AuthMode>('signin')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [consentAgreed, setConsentAgreed] = useState(false)
  
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  React.useEffect(() => {
    if (user && !isAnonymous) {
      navigate({ to: '/dashboard' })
    }
  }, [user, isAnonymous, navigate])

  const sanitize = (val: string) => {
    return val.replace(/<[^>]*>/g, '').trim()
  }

  const enforceRateLimit = (): boolean => {
    const rateLimit = checkAuthRateLimit()
    if (!rateLimit.allowed) {
      const waitTimeMs = (rateLimit.resetTimeMs || Date.now()) - Date.now()
      const waitMins = Math.ceil(waitTimeMs / 1000 / 60)
      setErrorMsg(`Too many auth attempts. Please wait ${waitMins} minute(s) before trying again.`)
      setLoading(false)
      return false
    }
    recordAuthAttempt()
    return true
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!enforceRateLimit()) return

    const sanitizedEmail = sanitize(email)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: sanitizedEmail,
        password,
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setSuccessMsg("Success! Redirecting...")
        setTimeout(() => navigate({ to: '/dashboard' }), 1000)
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!consentAgreed) {
      setErrorMsg("Please agree to the medical information disclaimer and privacy terms to continue.")
      setLoading(false)
      return
    }

    if (!enforceRateLimit()) return

    const sanitizedEmail = sanitize(email)
    const sanitizedFullName = sanitize(fullName)

    try {
      if (isAnonymous) {
        const { user: updatedUser, error } = await upgradeAnonymous(sanitizedEmail, password, sanitizedFullName)
        if (error) {
          setErrorMsg(error)
        } else {
          const isPending = (updatedUser as any)?.new_email || (updatedUser as any)?.unconfirmed_email || updatedUser?.is_anonymous
          if (isPending) {
            setSuccessMsg("Check your email to confirm your new account — your history is safely linked and will appear once confirmed.")
            setEmail('')
            setPassword('')
            setFullName('')
          } else {
            setSuccessMsg("Account created successfully! Your guest history has been saved to your account.")
            setEmail('')
            setPassword('')
            setFullName('')
            setTimeout(() => navigate({ to: '/dashboard' }), 1500)
          }
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email: sanitizedEmail,
          password,
          options: {
            data: {
              full_name: sanitizedFullName,
            },
            emailRedirectTo: `${window.location.origin}/consent`,
          },
        })

        if (error) {
          setErrorMsg(error.message)
        } else {
          setSuccessMsg("Registration successful! Please check your email for verification link.")
          setEmail('')
          setPassword('')
          setFullName('')
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!enforceRateLimit()) return

    const sanitizedEmail = sanitize(email)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: sanitizedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/consent`,
        },
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setSuccessMsg("Magic Link sent! Please check your email inbox.")
        setEmail('')
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!enforceRateLimit()) return

    const sanitizedEmail = sanitize(email)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${window.location.origin}/profile`,
      })

      if (error) {
        setErrorMsg(error.message)
      } else {
        setSuccessMsg("Password reset link sent! Please check your email inbox.")
        setEmail('')
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/consent`
        }
      })
      if (error) throw error
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to initiate Google sign-in.")
      setLoading(false)
    }
  }

  const isHindi = t('landing.workflowTitle').includes('प्रक्रिया')

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background text-foreground">
      {/* ============================================================== */}
      {/* LEFT PANEL: Deep forest-green branding, value prop & privacy   */}
      {/* ============================================================== */}
      <section 
        className="w-full lg:w-1/2 bg-[#0F6E56] text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between shrink-0 relative overflow-hidden"
        aria-label="MedDecode Introduction"
      >
        {/* Top brand mark */}
        <div className="flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-3.5 hover:opacity-95 transition-opacity group"
            aria-label="MedDecode AI — Back to Home"
          >
            <div className="w-11 h-11 rounded-2xl bg-white text-[#0F6E56] flex items-center justify-center font-serif font-black text-xl shadow-md group-hover:scale-[1.02] transition-transform">
              M
            </div>
            <span className="text-2xl font-serif font-black tracking-tight text-white">
              MedDecode
            </span>
          </Link>
        </div>

        {/* Vertically centered message */}
        <div className="my-10 lg:my-auto max-w-lg space-y-6">
          <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-serif font-black text-white leading-[1.12] tracking-tight">
            Medical information should be easier to understand.
          </h1>
          <p className="text-white/85 text-base sm:text-lg leading-relaxed font-normal">
            Understand prescriptions, blood reports, hospital bills, discharge summaries, and medicine labels through clear, simple explanations.
          </p>
        </div>

        {/* Bottom privacy notice */}
        <div className="pt-6 border-t border-white/15">
          <p className="text-xs sm:text-sm text-white/70 font-medium tracking-wide">
            Your medical information deserves clarity and care.
          </p>
        </div>
      </section>

      {/* ============================================================== */}
      {/* RIGHT PANEL: Centered authentication form                      */}
      {/* ============================================================== */}
      <section 
        className="w-full lg:w-1/2 bg-background flex items-center justify-center p-6 sm:p-10 lg:p-14 overflow-y-auto"
        aria-label="Authentication Form"
      >
        <div className="w-full max-w-[480px] space-y-6 py-4">

          {/* Guest upgrade banner */}
          {isAnonymous && (
            <div className="bg-primary/5 text-primary border border-primary/20 rounded-2xl p-4 text-xs font-semibold leading-relaxed">
              {isHindi
                ? '💡 आप वर्तमान में एक अतिथि के रूप में ब्राउज़ कर रहे हैं। अपने इतिहास को स्थायी रूप से सहेजने के लिए नीचे खाता बनाएँ।'
                : '💡 You are currently browsing as a guest. Create an account below to save your history permanently.'}
            </div>
          )}

          {/* Form Header */}
          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black text-foreground font-serif tracking-tight">
              {mode === 'signin' && (isHindi ? 'आपका स्वागत है' : 'Welcome back')}
              {mode === 'signup' && (isHindi ? 'अपना खाता बनाएँ' : 'Create your account')}
              {mode === 'magiclink' && (isHindi ? 'लिंक के माध्यम से साइन इन करें' : 'Sign in via Link')}
              {mode === 'forgot' && (isHindi ? 'पासवर्ड रीसेट करें' : 'Reset your password')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {mode === 'signin' && (isHindi ? 'अपने मेडिकल दस्तावेज़ों को समझने के लिए साइन इन करें।' : 'Sign in to understand your medical documents.')}
              {mode === 'signup' && (isHindi ? 'विश्वास के साथ अपने मेडिकल दस्तावेज़ों को समझना शुरू करें।' : 'Start understanding your medical documents with confidence.')}
              {mode === 'magiclink' && (isHindi ? 'अपना ईमेल दर्ज करें। हम आपको एक त्वरित लॉगिन टोकन भेजेंगे।' : "Enter your email address to receive an instant sign-in link.")}
              {mode === 'forgot' && (isHindi ? 'हम आपको एक नया पासवर्ड कॉन्फ़िगर करने के लिए एक लिंक भेजेंगे।' : "Enter your email and we'll send a password reset link.")}
            </p>
          </div>

          {/* Feedback Alerts */}
          {errorMsg && (
            <div 
              role="alert" 
              className="bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-4 text-xs sm:text-sm font-semibold leading-relaxed"
            >
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div 
              role="status" 
              className="bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 rounded-2xl p-4 text-xs sm:text-sm font-semibold leading-relaxed"
            >
              ✅ {successMsg}
            </div>
          )}

          {/* Back button for Forgot / Magic Link */}
          {(mode === 'forgot' || mode === 'magiclink') && (
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className="text-primary hover:opacity-85 font-bold text-xs sm:text-sm cursor-pointer flex items-center gap-1.5 transition-all"
            >
              ← Back to Sign In
            </button>
          )}

          {/* Google OAuth & Divider for Sign In and Sign Up */}
          {(mode === 'signin' || mode === 'signup') && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-card hover:bg-muted/40 border border-border text-foreground font-bold py-3.5 px-4 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-xs"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <span className="relative px-3 bg-background text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
                  or
                </span>
              </div>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="text-xs text-primary hover:underline font-semibold cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-sm cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-sm mt-2"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="pt-2 flex flex-col items-center gap-3 text-xs sm:text-sm text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setMode('magiclink')}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium underline cursor-pointer"
                >
                  Sign in with email link instead
                </button>

                <p className="pt-2 text-center text-xs sm:text-sm">
                  New to MedDecode?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setErrorMsg(null)
                      setSuccessMsg(null)
                    }}
                    className="text-primary hover:underline font-bold cursor-pointer inline-flex"
                  >
                    Create account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* SIGN UP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              {/* Consent checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer text-xs text-muted-foreground leading-snug">
                  <input
                    type="checkbox"
                    required
                    checked={consentAgreed}
                    onChange={(e) => setConsentAgreed(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary shrink-0"
                  />
                  <span>
                    I understand that MedDecode AI explains medical information and does not replace professional medical advice. I agree to the processing of my information as described in the{' '}
                    <Link to="/consent" className="text-primary underline font-medium hover:opacity-80">
                      Privacy Policy
                    </Link>.
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-sm cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-sm mt-2"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <div className="pt-2 text-center text-xs sm:text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-primary hover:underline font-bold cursor-pointer inline-flex"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-sm cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-sm mt-2"
              >
                {loading ? 'Sending link...' : 'Send reset link'}
              </button>

              <div className="pt-2 text-center text-xs sm:text-sm text-muted-foreground">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-primary hover:underline font-bold cursor-pointer inline-flex"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {/* MAGIC LINK FORM */}
          {mode === 'magiclink' && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-sm cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-sm mt-2"
              >
                {loading ? 'Sending link...' : 'Send magic link'}
              </button>

              <div className="pt-2 text-center text-xs sm:text-sm text-muted-foreground">
                Prefer using your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin')
                    setErrorMsg(null)
                    setSuccessMsg(null)
                  }}
                  className="text-primary hover:underline font-bold cursor-pointer inline-flex"
                >
                  Sign in with password
                </button>
              </div>
            </form>
          )}

        </div>
      </section>
    </div>
  )
}
