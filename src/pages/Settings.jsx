import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  disconnectHF,
  isHFConnected,
  startHiggsfieldOAuthPopup,
} from '../utils/higgsfieldAuth'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { listHiggsfieldTools } from '../utils/higgsfieldGenerate'
import { formatBytes } from '../utils/promptPresets'
import {
  DEFAULT_CODEX_MODEL,
  PROMPT_ASSISTANT_PROVIDERS,
  assistantStatusText,
  getPromptAssistantSettings,
  savePromptAssistantSettings,
} from '../utils/promptAssistant'

export default function Settings() {
  const location = useLocation()
  const { profile, isApproved, isSuperUser } = useAuth()
  const { storageStats, serverStatus, hasServerStorage } = usePackages()
  const [hfConnected, setHfConnected] = useState(isHFConnected)
  const [hfLoading, setHfLoading] = useState(false)
  const [apiLoading, setApiLoading] = useState(false)
  const [apiDiagnostics, setApiDiagnostics] = useState(null)
  const [assistantSettings, setAssistantSettings] = useState(() => getPromptAssistantSettings())
  const [assistantDraft, setAssistantDraft] = useState(() => {
    const settings = getPromptAssistantSettings()
    return {
      preferred: settings.preferred,
      claudeKey: settings.claudeKey,
      codexKey: settings.codexKey,
      codexModel: settings.codexModel,
    }
  })
  const [assistantNotice, setAssistantNotice] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('connected') === '1') {
      setHfConnected(true)
    }
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

  function disconnectHiggsfield() {
    disconnectHF()
    setHfConnected(false)
    setApiDiagnostics(null)
  }

  async function runApiDiagnostics() {
    if (!hfConnected) {
      setApiDiagnostics({ ok: false, message: 'Connect Higgsfield first to inspect API tools.', tools: [] })
      return
    }
    setApiLoading(true)
    setApiDiagnostics({ ok: true, message: 'Checking Higgsfield API tools...', tools: [] })
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
      const hasMediaConfirm = useful.some(tool => tool.name === 'media_confirm')
      const hasMediaList = useful.some(tool => tool.name === 'show_medias')
      const hasUploadFlow = hasMediaUpload && hasMediaConfirm
      setApiDiagnostics({
        ok: hasUploadFlow && hasMarketingStudio,
        message: hasUploadFlow && hasMarketingStudio
          ? `API can upload confirmed media and attempt Marketing Studio asset creation. ${hasMediaList ? 'Media listing is also available for diagnostics.' : 'Media listing is not exposed on this account.'}`
          : 'Higgsfield API connected, but this account is missing one or more tools needed for the Library asset flow.',
        tools: useful,
      })
    } catch (error) {
      setApiDiagnostics({ ok: false, message: error.message || 'Could not inspect Higgsfield API tools.', tools: [] })
    } finally {
      setApiLoading(false)
    }
  }

  function updateAssistantDraft(field, value) {
    setAssistantDraft(current => ({ ...current, [field]: value }))
  }

  function saveAssistant(event) {
    event.preventDefault()
    const next = savePromptAssistantSettings(assistantDraft)
    setAssistantSettings(next)
    setAssistantNotice('Prompt assistant saved.')
    window.setTimeout(() => setAssistantNotice(''), 2500)
  }

  function clearAssistant() {
    const nextDraft = { preferred: 'auto', claudeKey: '', codexKey: '', codexModel: DEFAULT_CODEX_MODEL }
    savePromptAssistantSettings(nextDraft)
    setAssistantDraft(nextDraft)
    setAssistantSettings(getPromptAssistantSettings())
    setAssistantNotice('Prompt assistant disconnected.')
    window.setTimeout(() => setAssistantNotice(''), 2500)
  }

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
        <div className="settings-row workspace-row">
          <div>
            <strong>Prompt assistant</strong>
            <span>{assistantStatusText()} · Auto uses Claude first, then Codex if Claude is not connected.</span>
          </div>
          <form className="prompt-assistant-form" onSubmit={saveAssistant}>
            <label>
              Preferred
              <select value={assistantDraft.preferred} onChange={event => updateAssistantDraft('preferred', event.target.value)}>
                {PROMPT_ASSISTANT_PROVIDERS.map(provider => (
                  <option key={provider.id} value={provider.id}>{provider.label}</option>
                ))}
              </select>
            </label>
            <label>
              Claude API key
              <input
                type="password"
                value={assistantDraft.claudeKey}
                onChange={event => updateAssistantDraft('claudeKey', event.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
              />
            </label>
            <label>
              Codex / OpenAI API key
              <input
                type="password"
                value={assistantDraft.codexKey}
                onChange={event => updateAssistantDraft('codexKey', event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </label>
            <label>
              Codex model
              <input
                value={assistantDraft.codexModel}
                onChange={event => updateAssistantDraft('codexModel', event.target.value)}
                placeholder={DEFAULT_CODEX_MODEL}
              />
            </label>
            <div className="prompt-assistant-actions">
              <button className="primary-btn" type="submit">Save assistant</button>
              <button className="secondary-btn" type="button" onClick={clearAssistant}>Disconnect</button>
            </div>
          </form>
        </div>
        <div className="diagnostic-box">
          <strong>Assistant routing</strong>
          <span>{assistantNotice || `${assistantSettings.hasClaude ? 'Claude connected' : 'Claude not connected'} · ${assistantSettings.hasCodex ? 'Codex connected' : 'Codex not connected'} · Preferred: ${assistantSettings.preferred}`}</span>
        </div>
        <div className="settings-row">
          <div><strong>Higgsfield</strong><span>{hfConnected ? 'Connected for Marketing Studio assets' : 'Not connected'}</span></div>
          {hfConnected ? (
            <button className="danger-btn" onClick={disconnectHiggsfield}>Disconnect</button>
          ) : (
            <button className="primary-btn" onClick={connectHiggsfield} disabled={hfLoading}>{hfLoading ? 'Connecting…' : 'Connect Higgsfield'}</button>
          )}
        </div>
        <div className="settings-row">
          <div>
            <strong>Higgsfield API</strong>
            <span>{hfConnected ? 'The app uses Higgsfield MCP API tools for uploads and Marketing Studio assets. No workspace ID is required.' : 'Connect Higgsfield to use the API asset flow.'}</span>
          </div>
          <button className="secondary-btn" type="button" onClick={runApiDiagnostics} disabled={apiLoading || !hfConnected}>
            {apiLoading ? 'Checking...' : 'Check API tools'}
          </button>
        </div>
        {apiDiagnostics && (
          <div className="diagnostic-box" aria-label="Higgsfield API diagnostics">
            <strong>Higgsfield API tools</strong>
            <span>{apiDiagnostics.message}</span>
            {apiDiagnostics.tools?.length ? (
              <ul>
                {apiDiagnostics.tools.map(tool => (
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
