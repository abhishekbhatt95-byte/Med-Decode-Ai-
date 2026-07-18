import React, { useState } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/AuthContext'
import { checkAuthRateLimit, recordAuthAttempt } from '../utils/rateLimiter'
import { ShieldCheck, Mail, Lock, User } from 'lucide-react'
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] py-10 px-4 text-left">
      
      {/* Centered Circular Badge */}
      <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl mb-4 shadow-sm border border-primary/20">
        <ShieldCheck className="w-7 h-7" />
      </div>

      {/* Headings */}
      {/* Headings */}
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-2xl md:text-3xl font-black text-foreground font-serif">
          {mode === 'signin' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'आपका स्वागत है' : 'Welcome Back')}
          {mode === 'signup' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'अपना खाता बनाएँ' : 'Create Your Account')}
          {mode === 'magiclink' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'लिंक के माध्यम से साइन इन करें' : 'Sign In via Link')}
          {mode === 'forgot' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'पासवर्ड रीसेट करें' : 'Reset Password')}
        </h1>
        <p className="text-muted-foreground text-xs max-w-sm mx-auto leading-relaxed">
          {mode === 'signin' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'सुरक्षित रूप से मेडिकल रिकॉर्ड अनुवाद सैंडबॉक्स।' : 'Securely translation-sandbox medical records.')}
          {mode === 'signup' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'स्थायी डेटा बैकअप और क्रॉस-डिवाइस सिंक प्राप्त करें।' : 'Get permanent data backup and cross-device sync.')}
          {mode === 'magiclink' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'अपना ईमेल दर्ज करें। हम आपको एक त्वरित लॉगिन टोकन भेजेंगे।' : "Enter your email. We'll send you an instant login token.")}
          {mode === 'forgot' && (t('landing.workflowTitle').includes('प्रक्रिया') ? 'हम आपको एक नया पासवर्ड कॉन्फ़िगर करने के लिए एक ईमेल लिंक भेजेंगे।' : "We'll send you an email link to configure a new password.")}
        </p>
      </div>

      <div className="w-full max-w-md bg-card border border-border rounded-3xl shadow-sm p-6 md:p-8 space-y-6">
        
        {isAnonymous && (
          <div className="bg-primary/5 text-primary border border-primary/20 rounded-2xl p-4 text-xs font-semibold text-center leading-relaxed">
            {t('landing.workflowTitle').includes('प्रक्रिया') 
              ? '💡 आप वर्तमान में एक अतिथि के रूप में ब्राउज़ कर रहे हैं। अपने इतिहास को स्थायी रूप से सहेजने के लिए नीचे पंजीकरण करें।' 
              : '💡 You are currently browsing as a guest. Register below to save your history permanently.'}
          </div>
        )}

        {/* Tab Headers */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-border mb-6">
            <button
              onClick={() => {
                setMode('signin')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 cursor-pointer transition-all ${
                mode === 'signin' || mode === 'magiclink'
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('landing.workflowTitle').includes('प्रक्रिया') ? 'साइन इन करें' : 'Sign In'}
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 pb-3 text-sm font-bold border-b-2 cursor-pointer transition-all ${
                mode === 'signup'
                  ? 'border-primary text-primary font-black'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पंजीकरण करें' : 'Register'}
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <button
            onClick={() => setMode('signin')}
            className="text-primary hover:opacity-80 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all mb-4"
          >
            {t('landing.workflowTitle').includes('प्रक्रिया') ? '← साइन इन पर वापस जाएँ' : '← Back to Sign In'}
          </button>
        )}

        {errorMsg && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-2xl p-4 text-xs font-semibold text-center leading-relaxed">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-2xl p-4 text-xs font-semibold text-center leading-relaxed">
            ✅ {successMsg}
          </div>
        )}

        {/* Google OAuth Button */}
        {(mode === 'signin' || mode === 'signup') && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-background hover:bg-muted/30 border border-border text-foreground font-bold py-3 px-4 rounded-full text-sm transition-all cursor-pointer disabled:opacity-50 active:scale-[0.99] shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
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
              <span>{t('landing.workflowTitle').includes('प्रक्रिया') ? 'गूगल के साथ जारी रखें' : 'Continue with Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative px-3 bg-card text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'या ईमेल क्रेडेंशियल' : 'or email credentials'}
              </span>
            </div>
          </div>
        )}

        {/* signin form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'ईमेल पता' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पासवर्ड' : 'Password'}
                </label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-[10px] text-primary hover:opacity-80 font-bold cursor-pointer"
                >
                  {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पासवर्ड भूल गए?' : 'Forgot Password?'}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('landing.workflowTitle').includes('प्रक्रिया') ? 'पासवर्ड दर्ज करें' : 'Enter password'}
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-xs cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-sm"
            >
              {loading 
                ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'साइन इन किया जा रहा है...' : 'Signing In...') 
                : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'ईमेल के साथ साइन इन करें' : 'Sign In with Email')}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('magiclink')}
                className="text-xs text-primary hover:opacity-85 font-bold cursor-pointer"
              >
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'मैजिक लिंक का उपयोग करें (कोई पासवर्ड नहीं)' : 'Use Magic Link (No Password)'}
              </button>
            </div>
          </form>
        )}

        {/* magiclink form */}
        {mode === 'magiclink' && (
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'ईमेल पता' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-xs cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-sm"
            >
              {loading 
                ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'लिंक भेजा जा रहा है...' : 'Sending link...') 
                : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'मैजिक लिंक भेजें' : 'Send Magic Link')}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-xs text-primary hover:opacity-85 font-bold cursor-pointer"
              >
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'इसके बजाय पासवर्ड के साथ साइन इन करें' : 'Sign In with Password instead'}
              </button>
            </div>
          </form>
        )}

        {/* signup form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पूरा नाम' : 'Full Name'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'ईमेल पता' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'पासवर्ड' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('landing.workflowTitle').includes('प्रक्रिया') ? 'न्यूनतम 6 अक्षर' : 'Minimum 6 characters'}
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-xs cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-sm"
            >
              {loading 
                ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'खाता बनाया जा रहा है...' : 'Creating Account...') 
                : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'खाता पंजीकृत करें' : 'Register Account')}
            </button>
          </form>
        )}

        {/* forgot password form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground font-mono">
                {t('landing.workflowTitle').includes('प्रक्रिया') ? 'ईमेल पता' : 'Email Address'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-border rounded-xl pl-11 pr-4 py-3 bg-background focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-full hover:opacity-95 transition-all text-xs cursor-pointer disabled:opacity-50 active:scale-[0.98] shadow-sm"
            >
              {loading 
                ? (t('landing.workflowTitle').includes('प्रक्रिया') ? 'लिंक भेजा जा रहा है...' : 'Sending link...') 
                : (t('landing.workflowTitle').includes('प्रक्रिया') ? 'रीसेट लिंक भेजें' : 'Send Reset Link')}
            </button>
          </form>
        )}

      </div>

    </div>
  )
}
