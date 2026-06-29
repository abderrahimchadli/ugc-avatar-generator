import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

export default function Login() {
  const { profile, signIn, signUp, isApproved, hasSupabaseConfig } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (profile && isApproved) return <Navigate to="/" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)
    if (result?.error) setError(result.error.message)
    else navigate(mode === 'signup' ? '/waiting-approval' : '/')
  }

  return (
    <main className="page-shell narrow">
      <form className="panel form-panel" onSubmit={submit}>
        <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Request access'}</p>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        {!hasSupabaseConfig && <p className="notice">Demo mode: any email signs in locally. Add Supabase env vars on Vercel for real approval.</p>}
        <label>Email<input value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required /></label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-btn" type="submit">{mode === 'signin' ? 'Sign in' : 'Sign up'}</button>
        <button className="text-btn" type="button" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Need an account?' : 'Already have an account?'}
        </button>
      </form>
    </main>
  )
}

