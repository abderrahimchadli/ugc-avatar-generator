import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'

export default function Home() {
  const { profile, isApproved, hasSupabaseConfig } = useAuth()
  const { storageStats } = usePackages()

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Avatar and product reference studio</p>
          <h1>Build named packages, generate in Flow or ChatGPT, then create Higgsfield assets.</h1>
          <p className="hero-copy">
            Create reusable avatar and product packs with locked prompts, style sheets,
            extension-assisted imports, and user-controlled Higgsfield Marketing Studio assets.
          </p>
          <div className="hero-actions">
            <Link className="primary-btn" to={isApproved ? '/prompt-builder' : '/login'}>Start package</Link>
            <Link className="secondary-btn" to="/library">Open library</Link>
          </div>
        </div>
        <div className="status-grid">
          <div><span>Active account</span><strong>{profile?.displayName || profile?.email || 'Not signed in'}</strong></div>
          <div><span>Status</span><strong>{isApproved ? 'Approved' : 'Pending'}</strong></div>
          <div><span>Storage</span><strong>{formatBytes(storageStats.usedBytes)}</strong></div>
          <div><span>Supabase</span><strong>{hasSupabaseConfig ? 'Configured' : 'Demo mode'}</strong></div>
        </div>
      </section>
    </main>
  )
}
