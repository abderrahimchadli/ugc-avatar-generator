import { useEffect, useState } from 'react'
import { useAuth } from '../context/auth'

export default function AdminUsers() {
  const { session, isSuperUser, hasSupabaseConfig } = useAuth()
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isSuperUser || !hasSupabaseConfig) return
    load()
  }, [isSuperUser, hasSupabaseConfig])

  async function load() {
    const token = session?.access_token
    const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    setUsers(data.users || [])
    if (data.error) setMessage(data.error)
  }

  async function update(id, status) {
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
      {!hasSupabaseConfig && <p className="notice">Demo mode: configure Supabase env vars to approve real users.</p>}
      {message && <p className="notice">{message}</p>}
      <section className="panel">
        {users.map(user => (
          <div className="user-row" key={user.id}>
            <div><strong>{user.email}</strong><span>{user.role} · {user.status}</span></div>
            <div className="row-actions">
              <button className="primary-btn compact" onClick={() => update(user.id, 'approved')}>Approve</button>
              <button className="danger-btn compact" onClick={() => update(user.id, 'blocked')}>Block</button>
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

