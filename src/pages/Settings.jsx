import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { startHiggsfieldOAuthPopup, disconnectHF, isHFConnected, fireReferralOnce } from '../utils/higgsfieldAuth'
import { useTheme } from '../context/theme'

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border-subtle)', overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</div>
      </div>
      <div style={{ padding: '20px 24px' }}>{children}</div>
    </div>
  )
}

export default function Settings() {
  const location = useLocation()
  const { theme, toggle } = useTheme()
  const [anthropicKey, setAnthropicKey] = useState(() => localStorage.getItem('anthropic_key') || '')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hfConnected, setHfConnected] = useState(isHFConnected)
  const [hfLoading, setHfLoading] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('connected') === '1') {
      setHfConnected(true)
    }
  }, [location.search])

  function saveAnthropicKey() {
    localStorage.setItem('anthropic_key', anthropicKey.trim())
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

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

  function disconnectHighgsfield() {
    if (!confirm('Disconnect your Higgsfield account?')) return
    disconnectHF()
    setHfConnected(false)
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 28 }}>Settings</h1>

        <Section title="Appearance">
          <div style={{ display: 'flex', gap: 10 }}>
            {(['light', 'dark']).map(val => {
              const on = theme === val
              return (
                <button key={val} onClick={() => { if (!on) toggle() }} style={{
                  flex: 1, padding: '14px 12px', borderRadius: 12, cursor: on ? 'default' : 'pointer',
                  border: `1.5px solid ${on ? '#8B5CF6' : 'var(--border)'}`,
                  background: on ? 'rgba(139,92,246,0.09)' : 'var(--bg)',
                  color: on ? '#8B5CF6' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  fontWeight: 600, fontSize: 14, fontFamily: 'inherit',
                  transition: 'all 0.15s',
                  boxShadow: on ? '0 0 0 1px #8B5CF655' : 'none',
                }}>
                  {val === 'light' ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="5"/>
                      <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                  {val.charAt(0).toUpperCase() + val.slice(1)}
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="Claude AI">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Claude generates optimized Higgsfield prompts from your influencer profile. Get your API key from{' '}
            <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>console.anthropic.com</a>.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                style={{ width: '100%', padding: '10px 40px 10px 14px', borderRadius: 8, border: '1.5px solid var(--border)', background: 'var(--bg)', fontSize: 14, color: 'var(--text-primary)' }}
              />
              <button onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-tertiary)', background: 'none', padding: '2px 4px' }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button
              onClick={saveAnthropicKey}
              disabled={!anthropicKey.trim()}
              style={{ padding: '10px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: saved ? '#34C759' : 'var(--text-primary)', color: '#fff', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
            >
              {saved ? '✓ Saved' : 'Save Key'}
            </button>
          </div>
          {anthropicKey && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
              <span style={{ fontSize: 12, color: '#34C759', fontWeight: 500 }}>Claude connected</span>
            </div>
          )}
        </Section>

        <Section title="Higgsfield">
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
            Connect your Higgsfield account to generate influencer images directly in the app. Images use your own Higgsfield credits.
          </p>
          {hfConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34C759' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#34C759' }}>Higgsfield connected</span>
              </div>
              <button onClick={disconnectHighgsfield} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, color: '#FF3B30', background: '#FFF5F5', border: '1px solid #FFD2D2', fontWeight: 500 }}>
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={connectHiggsfield}
              disabled={hfLoading}
              style={{ padding: '10px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, background: '#1D1D1F', color: '#fff', display: 'flex', alignItems: 'center', gap: 8, opacity: hfLoading ? 0.6 : 1 }}
            >
              {hfLoading ? (
                <>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                  Connecting…
                </>
              ) : (
                'Connect Higgsfield'
              )}
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </button>
          )}
        </Section>
      </div>
    </div>
  )
}
