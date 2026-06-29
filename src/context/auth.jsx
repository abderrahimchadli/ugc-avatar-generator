import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import {
  DEMO_PROFILE_KEY,
  createDemoAccount,
  readActiveDemoProfile,
  readDemoAccounts,
  saveDemoAccounts,
  signInDemoAccount,
  toProfile,
  updateDemoAccountStatus,
} from '../utils/demoAccounts'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [demoAccounts, setDemoAccounts] = useState(() => hasSupabaseConfig ? [] : readDemoAccounts())
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(() => hasSupabaseConfig ? null : readActiveDemoProfile(readDemoAccounts()))
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
      const result = signInDemoAccount({ login: email, password, accounts: demoAccounts })
      if (result.error) return result
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(result.profile))
      setProfile(result.profile)
      return { error: null }
    }
    return supabase.auth.signInWithPassword({ email, password })
  }

  async function signUp(email, password, displayName = '') {
    if (!hasSupabaseConfig) {
      const result = createDemoAccount({ email, password, displayName, accounts: demoAccounts })
      if (result.error) return result
      saveDemoAccounts(result.accounts)
      setDemoAccounts(result.accounts)
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(result.profile))
      setProfile(result.profile)
      return { error: null }
    }
    return supabase.auth.signUp({ email, password })
  }

  async function signOut() {
    if (!hasSupabaseConfig) {
      localStorage.removeItem(DEMO_PROFILE_KEY)
      setProfile(null)
      return
    }
    await supabase.auth.signOut()
  }

  function updateDemoUser(id, status) {
    if (hasSupabaseConfig) return
    const next = updateDemoAccountStatus(demoAccounts, id, status)
    saveDemoAccounts(next)
    setDemoAccounts(next)
    if (profile?.id === id) {
      const account = next.find(item => item.id === id)
      const nextProfile = toProfile(account)
      setProfile(nextProfile)
      if (nextProfile) localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(nextProfile))
    }
  }

  const value = useMemo(() => ({
    session,
    profile,
    loading,
    hasSupabaseConfig,
    demoAccounts: demoAccounts.map(toProfile),
    isApproved: profile?.status === 'approved' || profile?.role === 'super_user',
    isSuperUser: profile?.role === 'super_user',
    signIn,
    signUp,
    signOut,
    updateDemoUser,
  }), [session, profile, loading, demoAccounts])

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
