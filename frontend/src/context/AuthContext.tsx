import React, { createContext, useContext, useState, useEffect } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../utils/supabase'

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'guest' | 'user' | 'admin' | 'medical_advisor' | 'support'
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAnonymous: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const isAnonymous = user?.is_anonymous ?? false

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error.message)
        setProfile(null)
      } else {
        setProfile(data as Profile)
      }
    } catch (e) {
      console.error('Exception fetching profile:', e)
      setProfile(null)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }

  useEffect(() => {
    // Get initial session; if none exists, sign in anonymously so every
    // visitor has a real auth.uid() — enabling strict, uniform RLS policies.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setSession(session)
        setUser(session.user)
        await fetchProfile(session.user.id)
        setLoading(false)
      } else {
        // No session — bootstrap an anonymous one.
        // Check data.user (not data.session) because Supabase sometimes
        // returns the user immediately but delivers the session via
        // onAuthStateChange a moment later.
        const tryAnon = async (): Promise<boolean> => {
          const { data, error } = await supabase.auth.signInAnonymously()
          if (error) {
            console.error('Anonymous sign-in failed:', error.message, error)
            return false
          }
          if (data.user) {
            setUser(data.user)
            setSession(data.session) // may be null; onAuthStateChange fills it in
            return true
          }
          return false
        }

        const ok = await tryAnon()
        if (!ok) {
          // One automatic retry after 1.5 s (handles transient network blips)
          await new Promise(r => setTimeout(r, 1500))
          await tryAnon()
        }
        setLoading(false)
      }
    })

    // Listen for auth changes (sign-in, sign-out, token refresh, linking)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        setUser(newSession?.user ?? null)

        if (newSession?.user && !newSession.user.is_anonymous) {
          await fetchProfile(newSession.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAnonymous,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
