import React, { useState } from 'react'
import { supabase } from '../utils/supabase'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../context/AuthContext'
import { checkAuthRateLimit, recordAuthAttempt } from '../utils/rateLimiter'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'magiclink'

export const AuthPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // Auth state variables
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  
  // UI states
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Redirect if user is already signed in
  React.useEffect(() => {
    if (user) {
      navigate({ to: '/dashboard' })
    }
  }, [user, navigate])

  // Helper to sanitize inputs (remove HTML tags)
  const sanitize = (val: string) => {
    return val.replace(/<[^>]*>/g, '').trim()
  }

  // Helper to check rate limit and record attempt
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

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12 px-4">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-xl p-8 md:p-10">
        
        {/* Toggle Mode Headers */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-border mb-8">
            <button
              onClick={() => {
                setMode('signin')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 pb-4 text-lg font-bold border-b-2 cursor-pointer transition-all ${
                mode === 'signin' || mode === 'magiclink'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setErrorMsg(null)
                setSuccessMsg(null)
              }}
              className={`flex-1 pb-4 text-lg font-bold border-b-2 cursor-pointer transition-all ${
                mode === 'signup'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {mode === 'forgot' && (
          <div className="mb-6">
            <button
              onClick={() => setMode('signin')}
              className="text-primary hover:underline font-semibold text-sm cursor-pointer"
            >
              ← Back to Sign In
            </button>
            <h2 className="text-2xl font-bold mt-4">Reset Password</h2>
            <p className="text-muted-foreground text-sm mt-1">We'll send you an email link to configure a new password.</p>
          </div>
        )}

        {/* Message banners */}
        {errorMsg && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-xl p-4 mb-6 text-sm font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 rounded-xl p-4 mb-6 text-sm font-semibold">
            ✅ {successMsg}
          </div>
        )}

        {/* FORM INJECTS */}

        {/* Sign In Form */}
        {mode === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-foreground">Password</label>
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-xs text-primary hover:underline font-medium cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all text-base cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In with Email'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('magiclink')}
                className="text-sm text-primary hover:underline font-semibold cursor-pointer"
              >
                Use Magic Link (No Password)
              </button>
            </div>
          </form>
        )}

        {/* Magic Link Form */}
        {mode === 'magiclink' && (
          <form onSubmit={handleMagicLink} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all text-base cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send Magic Link'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setMode('signin')}
                className="text-sm text-primary hover:underline font-semibold cursor-pointer"
              >
                Sign In with Password instead
              </button>
            </div>
          </form>
        )}

        {/* Sign Up Form */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all text-base cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Register Account'}
            </button>
          </form>
        )}

        {/* Forgot Password Form */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-foreground mb-2">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-border rounded-xl px-4 py-3 bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 text-base"
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-semibold py-3.5 rounded-xl hover:opacity-90 transition-all text-base cursor-pointer disabled:opacity-50"
            >
              {loading ? 'Sending link...' : 'Send Reset Link'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
