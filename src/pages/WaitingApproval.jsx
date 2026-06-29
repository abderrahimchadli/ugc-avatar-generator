import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'

export default function WaitingApproval() {
  const { profile, signOut } = useAuth()
  return (
    <main className="page-shell narrow">
      <section className="panel">
        <p className="eyebrow">Waiting approval</p>
        <h1>Your account is pending</h1>
        <p className="muted">A super user must approve {profile?.email || 'this account'} before generation packages are available.</p>
        <div className="row-actions">
          <Link className="secondary-btn" to="/settings">Settings</Link>
          <button className="danger-btn" onClick={signOut}>Sign out</button>
        </div>
      </section>
    </main>
  )
}

