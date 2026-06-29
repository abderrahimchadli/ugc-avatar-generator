import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { disconnectHF, isHFConnected, startHiggsfieldOAuthPopup } from '../utils/higgsfieldAuth'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'

export default function Settings() {
  const location = useLocation()
  const { profile, hasSupabaseConfig, isApproved, isSuperUser } = useAuth()
  const { storageStats } = usePackages()
  const [hfConnected, setHfConnected] = useState(isHFConnected)
  const [hfLoading, setHfLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('connected') === '1') setHfConnected(true)
  }, [location.search])

  async function connectHiggsfield() {
    setHfLoading(true)
    try {
      await startHiggsfieldOAuthPopup()
      setHfConnected(true)
    } catch (e) {
      if (e.message !== 'cancelled') alert('Failed to connect Higgsfield: ' + e.message)
    } finally {
      setHfLoading(false)
    }
  }

  return (
    <main className="page-shell narrow">
      <section className="panel stack">
        <p className="eyebrow">Settings</p>
        <h1>Connections and storage</h1>
        <div className="settings-row">
          <div><strong>User</strong><span>{profile?.email || 'Not signed in'} · {isApproved ? 'approved' : 'pending'} {isSuperUser ? '· super user' : ''}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Supabase</strong><span>{hasSupabaseConfig ? 'Configured for real auth and metadata' : 'Demo mode: local-only auth and packages'}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Chrome extension</strong><span>Install from the `extension/` folder and pin it in Chrome.</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Storage estimate</strong><span>{storageStats.packages} packages · {storageStats.images} images · {formatBytes(storageStats.usedBytes)}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Higgsfield</strong><span>{hfConnected ? 'Connected for package upload' : 'Not connected'}</span></div>
          {hfConnected ? (
            <button className="danger-btn" onClick={() => { disconnectHF(); setHfConnected(false) }}>Disconnect</button>
          ) : (
            <button className="primary-btn" onClick={connectHiggsfield} disabled={hfLoading}>{hfLoading ? 'Connecting…' : 'Connect Higgsfield'}</button>
          )}
        </div>
        <div className="settings-row">
          <div><strong>Remove from server</strong><span>No server image bucket is connected yet. The MVP removes local/package records only.</span></div>
          <button className="secondary-btn" disabled>Not available</button>
        </div>
      </section>
    </main>
  )
}

