import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'

const AuthCtx = createContext(null)
const DEMO_KEY = 'ugc_demo_profile'

function demoProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null')
    if (saved) return saved
  } catch {}
  return {
    id: 'demo-super-user',
    email: 'owner@example.com',
    role: 'super_user',
    status: 'approved',
    demo: true,
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(() => hasSupabaseConfig ? null : demoProfile())
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let mounted = true

    async function load() {
      setLoading(true)
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session || null)
      if (data.session?.user) await loadProfile(data.session.user)
      setLoading(false)
    }

    async function loadProfile(user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (!mounted) return
      setProfile(data || {
        id: user.id,
        email: user.email,
        role: 'user',
        status: 'pending',
      })
    }

    load()
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession || null)
      if (nextSession?.user) await loadProfile(nextSession.user)
      else setProfile(null)
      setLoading(false)
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    if (!hasSupabaseConfig) {
      const p = { ...demoProfile(), email: email || 'owner@example.com' }
      localStorage.setItem(DEMO_KEY, JSON.stringify(p))
      setProfile(p)
      return { error: null }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password) {
    if (!hasSupabaseConfig) {
      const p = { id: `demo-${Date.now()}`, email, role: 'user', status: 'pending', demo: true }
      localStorage.setItem(DEMO_KEY, JSON.stringify(p))
      setProfile(p)
      return { error: null }
    }
    return supabase.auth.signUp({ email, password })
  }

  async function signOut() {
    if (!hasSupabaseConfig) {
      localStorage.removeItem(DEMO_KEY)
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
  }

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    hasSupabaseConfig,
    isApproved: profile?.status === 'approved' || profile?.role === 'super_user',
    isSuperUser: profile?.role === 'super_user',
    signIn,
    signUp,
    signOut,
  }), [session, profile, loading])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

