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
          <p className="eyebrow">Two-part creator workspace</p>
          <h1>Plan weekly UGC ads from avatars, products, locations, and saved references.</h1>
          <p className="hero-copy">
            Keep the Higgsfield-powered influencer workflow available in Studio, use the package bridge
            for Google Flow or ChatGPT images, then group each week's avatar, product, location, and video brief.
          </p>
          <div className="hero-actions">
            <Link className="primary-btn" to="/weekly-jobs">Plan week job</Link>
            <Link className="secondary-btn" to={isApproved ? '/prompt-builder' : '/login'}>Start package</Link>
            <Link className="secondary-btn" to="/studio">Open studio</Link>
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
