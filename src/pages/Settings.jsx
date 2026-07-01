import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  diagnoseHFWorkspace,
  disconnectHF,
  ensureHFWorkspaceId,
  getHFWorkspaceId,
  isHFConnected,
  setHFWorkspaceId,
  startHiggsfieldOAuth,
} from '../utils/higgsfieldAuth'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { listHiggsfieldTools } from '../utils/higgsfieldGenerate'
import { formatBytes } from '../utils/promptPresets'

function shortId(value) {
  const text = String(value || '')
  return text ? `${text.slice(0, 10)}${text.length > 10 ? '...' : ''}` : ''
}

function diagnosticMessage(result) {
  if (!result?.connected) {
    return 'The app is not connected to Higgsfield. A normal Higgsfield website login in Chrome is separate from this app connection.'
  }
  if (result.detectedWorkspaceId) {
    return `Workspace detected: ${shortId(result.detectedWorkspaceId)}.`
  }
  if (result.savedWorkspaceId) {
    return 'Using a saved manual workspace ID, but Higgsfield did not confirm it through the checked endpoints.'
  }
  return 'No workspace ID was exposed by the old FNF endpoints. That is OK if your account uses Higgsfield MCP; Library will use the MCP Marketing Studio route instead of a workspace header.'
}

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
  const [workspaceDiagnostics, setWorkspaceDiagnostics] = useState(null)
  const [mcpDiagnostics, setMcpDiagnostics] = useState(null)

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
    setMcpDiagnostics(null)
  }

  function saveWorkspace(event) {
    event.preventDefault()
    const saved = setHFWorkspaceId(workspaceInput)
    setWorkspaceIdValue(saved)
    setWorkspaceInput(saved)
    if (!saved) {
      setWorkspaceMessage('Higgsfield workspace cleared.')
    } else if (!hfConnected) {
      setWorkspaceMessage('Higgsfield workspace saved. Connect Higgsfield before creating assets.')
    } else {
      setWorkspaceMessage('Higgsfield workspace saved.')
    }
    setWorkspaceDiagnostics(null)
    setMcpDiagnostics(null)
  }

  async function runWorkspaceDiagnostics() {
    if (!hfConnected) {
      setWorkspaceMessage('Connect Higgsfield first, then Auto-detect can read the workspace from your Higgsfield account.')
      const result = await diagnoseHFWorkspace()
      setWorkspaceDiagnostics(result)
      return result
    }
    setWorkspaceLoading(true)
    setWorkspaceMessage('Checking Higgsfield workspace endpoints...')
    try {
      const result = await diagnoseHFWorkspace()
      setWorkspaceDiagnostics(result)
      if (result.detectedWorkspaceId) {
        setWorkspaceIdValue(result.detectedWorkspaceId)
        setWorkspaceInput(result.detectedWorkspaceId)
      } else if (!workspaceInput && result.resolvedWorkspaceId) {
        setWorkspaceIdValue(result.resolvedWorkspaceId)
        setWorkspaceInput(result.resolvedWorkspaceId)
      }
      setWorkspaceMessage(diagnosticMessage(result))
      return result
    } catch (e) {
      setWorkspaceMessage(`Could not run Higgsfield workspace diagnostics: ${e.message}`)
      return null
    } finally {
      setWorkspaceLoading(false)
    }
  }

  async function detectWorkspace() {
    await runWorkspaceDiagnostics()
  }

  async function runMcpDiagnostics() {
    if (!hfConnected) {
      setMcpDiagnostics({ ok: false, message: 'Connect Higgsfield first to inspect MCP tools.', tools: [] })
      return
    }
    setWorkspaceLoading(true)
    setMcpDiagnostics({ ok: true, message: 'Checking Higgsfield MCP tools...', tools: [] })
    try {
      const tools = await listHiggsfieldTools()
      const useful = tools
        .map(tool => ({
          name: tool.name,
          description: String(tool.description || '').slice(0, 160),
        }))
        .filter(tool => /marketing|studio|media|generate|job/i.test(`${tool.name} ${tool.description}`))
      const hasMarketingStudio = useful.some(tool => tool.name === 'show_marketing_studio')
      const hasMediaUpload = useful.some(tool => tool.name === 'media_upload')
      setMcpDiagnostics({
        ok: hasMarketingStudio && hasMediaUpload,
        message: hasMarketingStudio && hasMediaUpload
          ? 'MCP is ready for media upload and Marketing Studio asset creation. No workspace ID is needed for this route.'
          : 'MCP is connected, but required Marketing Studio tools were not found for this account.',
        tools: useful,
      })
    } catch (error) {
      setMcpDiagnostics({ ok: false, message: error.message || 'Could not inspect Higgsfield MCP tools.', tools: [] })
    } finally {
      setWorkspaceLoading(false)
    }
  }

  const shortWorkspaceId = shortId(workspaceId)

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
            <strong>Higgsfield route</strong>
            <span>{workspaceId ? `Advanced workspace override saved: ${shortWorkspaceId}` : 'MCP asset creation does not require a workspace ID. Use MCP tools to verify the connected account supports Marketing Studio.'}</span>
            {workspaceMessage ? <span className="settings-note">{workspaceMessage}</span> : null}
          </div>
          <form className="workspace-form" onSubmit={saveWorkspace}>
            <input
              value={workspaceInput}
              onChange={event => setWorkspaceInput(event.target.value)}
              placeholder="Optional workspace ID"
              aria-label="Higgsfield workspace ID"
            />
            <button className="secondary-btn" type="button" onClick={detectWorkspace} disabled={workspaceLoading}>
              {workspaceLoading ? 'Checking...' : 'FNF check'}
            </button>
            <button className="secondary-btn" type="button" onClick={runWorkspaceDiagnostics} disabled={workspaceLoading}>
              Diagnostics
            </button>
            <button className="secondary-btn" type="button" onClick={runMcpDiagnostics} disabled={workspaceLoading}>
              MCP tools
            </button>
            <button className="primary-btn" type="submit">Save</button>
          </form>
        </div>
        {workspaceDiagnostics && (
          <div className="diagnostic-box" aria-label="Higgsfield workspace diagnostics">
            <strong>Higgsfield diagnostic</strong>
            <span>{diagnosticMessage(workspaceDiagnostics)}</span>
            <div className="diagnostic-grid">
              <span>Connection: {workspaceDiagnostics.connected ? 'connected' : 'not connected'}</span>
              <span>Saved workspace: {workspaceDiagnostics.savedWorkspaceId ? shortId(workspaceDiagnostics.savedWorkspaceId) : 'none'}</span>
              <span>Detected workspace: {workspaceDiagnostics.detectedWorkspaceId ? shortId(workspaceDiagnostics.detectedWorkspaceId) : 'none'}</span>
            </div>
            {workspaceDiagnostics.checks?.length ? (
              <ul>
                {workspaceDiagnostics.checks.map(check => (
                  <li key={`${check.path}-${check.status}`}>
                    <strong>{check.path}</strong>
                    <span>{check.ok ? 'OK' : `Failed ${check.status}`} · {check.summary}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        {mcpDiagnostics && (
          <div className="diagnostic-box" aria-label="Higgsfield MCP diagnostics">
            <strong>Higgsfield MCP route</strong>
            <span>{mcpDiagnostics.message}</span>
            {mcpDiagnostics.tools?.length ? (
              <ul>
                {mcpDiagnostics.tools.map(tool => (
                  <li key={tool.name}>
                    <strong>{tool.name}</strong>
                    <span>{tool.description || 'Available MCP tool.'}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}
        <div className="settings-row">
          <div><strong>Remove images</strong><span>Use Library image remove buttons. When server storage is configured, the matching server item is deleted too.</span></div>
          <a className="secondary-btn" href="/library">Open library</a>
        </div>
      </section>
    </main>
  )
}
