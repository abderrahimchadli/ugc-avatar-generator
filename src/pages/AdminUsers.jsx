import { useEffect, useState } from 'react'
import { useAuth } from '../context/auth'

export default function AdminUsers() {
  const { session, isSuperUser, hasSupabaseConfig, demoAccounts, updateDemoUser } = useAuth()
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isSuperUser) return
    if (!hasSupabaseConfig) {
      setUsers(demoAccounts)
      return
    }
    load()
  }, [isSuperUser, hasSupabaseConfig, demoAccounts])

  async function load() {
    const token = session?.access_token
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setUsers(data.users || [])
    if (data.error) setMessage(data.error)
  }

  async function update(id, status) {
    if (!hasSupabaseConfig) {
      updateDemoUser(id, status)
      setMessage(status === 'approved' ? 'Demo account approved.' : 'Demo account blocked.')
      return
    }
    const token = session?.access_token
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, status }),
    })
    const data = await res.json()
    if (data.error) setMessage(data.error)
    await load()
  }

  if (!isSuperUser) return <main className="page-shell"><section className="panel"><h1>Super user only</h1></section></main>

  return (
    <main className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Super user</p>
          <h1>User approval</h1>
        </div>
      </div>
      {!hasSupabaseConfig && <p className="notice">Demo mode: user approval is saved locally in this browser. Connect Supabase later for server-side accounts.</p>}
      {message && <p className="notice">{message}</p>}
      <section className="panel">
        {users.map(user => (
          <div className="user-row" key={user.id}>
            <div><strong>{user.displayName || user.email}</strong><span>{user.email} · {user.role} · {user.status}</span></div>
            <div className="row-actions">
              {user.status !== 'approved' && <button className="primary-btn compact" onClick={() => update(user.id, 'approved')}>Approve</button>}
              <button className="danger-btn compact" onClick={() => update(user.id, 'blocked')}>Block</button>
            </div>
          </div>
        ))}
        {!users.length && <p className="muted">No users yet.</p>}
      </section>
    </main>
  )
}
