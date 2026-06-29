import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/auth'

const DEMO_PASSWORDS = {
  'demo-abderrahim': 'Abderrahim#UGC26',
  'demo-kaoutar': 'Kaoutar#UGC26',
  'demo-ilyas': 'Ilyas#UGC26',
}

export default function Login() {
  const { profile, signIn, signUp, isApproved, hasSupabaseConfig, demoAccounts } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  if (profile && isApproved) return <Navigate to="/" replace />
  if (profile && !isApproved) return <Navigate to="/waiting-approval" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password, displayName)
    if (result?.error) setError(result.error.message)
    else navigate(mode === 'signup' ? '/waiting-approval' : '/')
  }

  function fillDemoAccount(account) {
    setMode('signin')
    setEmail(account.email)
    setPassword(DEMO_PASSWORDS[account.id] || '')
    setError('')
  }

  return (
    <main className="page-shell narrow">
      <form className="panel form-panel" onSubmit={submit}>
        <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'Request access'}</p>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create account'}</h1>
        {!hasSupabaseConfig && <p className="notice">Demo mode uses named local accounts. Packages and imported images are saved separately for each signed-in account in this browser.</p>}
        {!hasSupabaseConfig && mode === 'signin' && (
          <div className="account-picks">
            {demoAccounts.filter(account => account.status === 'approved' && DEMO_PASSWORDS[account.id]).map(account => (
              <button className="secondary-btn compact" type="button" key={account.id} onClick={() => fillDemoAccount(account)}>
                {account.displayName}
              </button>
            ))}
          </div>
        )}
        {mode === 'signup' && <label>Name<input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Team member name" required /></label>}
        <label>{hasSupabaseConfig ? 'Email' : 'Email or name'}<input value={email} onChange={e => setEmail(e.target.value)} placeholder={hasSupabaseConfig ? 'you@example.com' : 'abderrahim@ugc.local'} required /></label>
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
