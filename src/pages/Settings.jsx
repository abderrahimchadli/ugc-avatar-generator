import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  disconnectHF,
  ensureHFWorkspaceId,
  getHFWorkspaceId,
  isHFConnected,
  setHFWorkspaceId,
  startHiggsfieldOAuth,
} from '../utils/higgsfieldAuth'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'

export default function Settings() {
  const location = useLocation()
  const { profile, isApproved, isSuperUser } = useAuth()
  const { storageStats, serverStatus, hasServerStorage } = usePackages()
  const [hfConnected, setHfConnected] = useState(isHFConnected)
  const [hfLoading, setHfLoading] = useState(false)
  const [workspaceId, setWorkspaceIdValue] = useState(() => getHFWorkspaceId())
  const [workspaceInput, setWorkspaceInput] = useState(() => getHFWorkspaceId())
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceMessage, setWorkspaceMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('connected') === '1') {
      setHfConnected(true)
      ensureHFWorkspaceId().then(id => {
        setWorkspaceIdValue(id)
        setWorkspaceInput(id)
        if (id) setWorkspaceMessage('Higgsfield workspace detected.')
      }).catch(() => {})
    }
  }, [location.search])

  async function connectHiggsfield() {
    setHfLoading(true)
    try {
      localStorage.setItem('hf_return_url', '/settings?connected=1')
      await startHiggsfieldOAuth()
    } catch (e) {
      alert('Failed to connect Higgsfield: ' + e.message)
      setHfLoading(false)
    } finally {
      if (window.location.pathname === '/settings') setHfLoading(false)
    }
  }

  function disconnectHiggsfield() {
    disconnectHF()
    setHfConnected(false)
    setWorkspaceIdValue('')
    setWorkspaceInput('')
    setWorkspaceMessage('')
  }

  function saveWorkspace(event) {
    event.preventDefault()
    const saved = setHFWorkspaceId(workspaceInput)
    setWorkspaceIdValue(saved)
    setWorkspaceInput(saved)
    setWorkspaceMessage(saved ? 'Higgsfield workspace saved.' : 'Higgsfield workspace cleared.')
  }

  async function detectWorkspace() {
    if (!hfConnected) {
      setWorkspaceMessage('Connect Higgsfield first.')
      return
    }
    setWorkspaceLoading(true)
    setWorkspaceMessage('Looking for Higgsfield workspace...')
    try {
      const detected = await ensureHFWorkspaceId({ refresh: true })
      setWorkspaceIdValue(detected)
      setWorkspaceInput(detected)
      setWorkspaceMessage(detected ? 'Higgsfield workspace detected.' : 'Could not auto-detect the workspace. Paste the workspace ID manually.')
    } catch (e) {
      setWorkspaceMessage(`Could not auto-detect the workspace: ${e.message}`)
    } finally {
      setWorkspaceLoading(false)
    }
  }

  const shortWorkspaceId = workspaceId ? `${workspaceId.slice(0, 10)}${workspaceId.length > 10 ? '...' : ''}` : ''

  return (
    <main className="page-shell narrow">
      <section className="panel stack">
        <p className="eyebrow">Settings</p>
        <h1>Connections and storage</h1>
        <div className="settings-row">
          <div><strong>Active account</strong><span>{profile?.displayName || profile?.email || 'Not signed in'} · {profile?.email || 'no email'} · {isApproved ? 'approved' : 'pending'} {isSuperUser ? '· super user' : ''}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Server storage</strong><span>{hasServerStorage ? `Supabase is configured · ${serverStatus.message}` : 'Vercel demo is local-only until Supabase or Vercel Blob is connected.'}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Chrome extension</strong><span>Install from the `extension/` folder and verify it from the Extension page.</span></div>
          <a className="secondary-btn" href="/extension">Install</a>
        </div>
        <div className="settings-row">
          <div><strong>Storage estimate</strong><span>{storageStats.packages} packages · {storageStats.images} images · {formatBytes(storageStats.usedBytes)}</span></div>
        </div>
        <div className="settings-row">
          <div><strong>Higgsfield</strong><span>{hfConnected ? 'Connected for Marketing Studio assets' : 'Not connected'}</span></div>
          {hfConnected ? (
            <button className="danger-btn" onClick={disconnectHiggsfield}>Disconnect</button>
          ) : (
            <button className="primary-btn" onClick={connectHiggsfield} disabled={hfLoading}>{hfLoading ? 'Connecting…' : 'Connect Higgsfield'}</button>
          )}
        </div>
        <div className="settings-row workspace-row">
          <div>
            <strong>Higgsfield workspace</strong>
            <span>{workspaceId ? `Saved ${shortWorkspaceId} for asset creation` : 'Required for Marketing Studio asset creation. Auto-detect it or paste the workspace ID here.'}</span>
            {workspaceMessage ? <span className="settings-note">{workspaceMessage}</span> : null}
          </div>
          <form className="workspace-form" onSubmit={saveWorkspace}>
            <input
              value={workspaceInput}
              onChange={event => setWorkspaceInput(event.target.value)}
              placeholder="Workspace ID"
              aria-label="Higgsfield workspace ID"
              disabled={!hfConnected}
            />
            <button className="secondary-btn" type="button" onClick={detectWorkspace} disabled={!hfConnected || workspaceLoading}>
              {workspaceLoading ? 'Checking...' : 'Auto-detect'}
            </button>
            <button className="primary-btn" type="submit" disabled={!hfConnected}>Save</button>
          </form>
        </div>
        <div className="settings-row">
          <div><strong>Remove images</strong><span>Use Library image remove buttons. When server storage is configured, the matching server item is deleted too.</span></div>
          <a className="secondary-btn" href="/library">Open library</a>
        </div>
      </section>
    </main>
  )
}
