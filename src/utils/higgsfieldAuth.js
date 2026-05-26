const AUTH_PROXY = '/api/hf'           // fetch calls — goes through proxy, bypasses CORS
const AUTH_DIRECT = 'https://mcp.higgsfield.ai' // browser redirect — must be real URL

async function sha256Base64Url(str) {
  const data = new TextEncoder().encode(str)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function randomString(n = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(n)))
    .map(b => chars[b % chars.length]).join('')
}

async function ensureClientId() {
  const stored = localStorage.getItem('hf_client_id')
  if (stored) return stored
  const res = await fetch(`${AUTH_PROXY}/oauth2/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'AI Influencer Studio',
      redirect_uris: [`${window.location.origin}/auth/callback`],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      code_challenge_method: 'S256',
    }),
  })
  if (!res.ok) throw new Error('Failed to register OAuth client')
  const d = await res.json()
  localStorage.setItem('hf_client_id', d.client_id)
  return d.client_id
}

async function buildAuthUrl() {
  const verifier = randomString(64)
  const challenge = await sha256Base64Url(verifier)
  const state = randomString(16)
  const clientId = await ensureClientId()
  localStorage.setItem('hf_verifier', verifier)
  localStorage.setItem('hf_state', state)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    scope: 'openid email offline_access',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })
  return `${AUTH_DIRECT}/oauth2/authorize?${params}`
}

export async function startHiggsfieldOAuth() {
  window.location.href = await buildAuthUrl()
}

// Opens ONE popup. First-time users: popup starts on higgsfield.ai (sets referral cookie),
// then auto-navigates to OAuth in the same popup window. No extra tabs ever.
export async function startHiggsfieldOAuthPopup() {
  const authUrl = await buildAuthUrl()
  const w = 520, h = 660
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2)

  const referralDone = localStorage.getItem('hf_referral_fired')
  const startUrl = referralDone ? authUrl : 'https://higgsfield.ai/?fpr=dankieft&fp_sid=tool'
  const popup = window.open(startUrl, 'hf_oauth', `width=${w},height=${h},left=${left},top=${top}`)
  if (!popup) throw new Error('Popup blocked — please allow popups for this site and try again')

  if (!referralDone) {
    localStorage.setItem('hf_referral_fired', '1')
    // Give the referral page ~2.5 s to load and set its cookie, then send to OAuth
    setTimeout(() => { try { popup.location.href = authUrl } catch (_) {} }, 2500)
  }

  return new Promise((resolve, reject) => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'hf_auth_success') { cleanup(); resolve() }
      else if (e.data?.type === 'hf_auth_error') { cleanup(); reject(new Error(e.data.error)) }
    }
    const poll = setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('cancelled')) } }, 600)
    function cleanup() { clearInterval(poll); window.removeEventListener('message', onMessage) }
    window.addEventListener('message', onMessage)
  })
}

function saveTokens(tokens) {
  localStorage.setItem('hf_access_token', tokens.access_token)
  if (tokens.expires_in) {
    localStorage.setItem('hf_token_expires_at', String(Date.now() + tokens.expires_in * 1000))
  }
  if (tokens.refresh_token) localStorage.setItem('hf_refresh_token', tokens.refresh_token)
}

function needsRefresh() {
  if (!localStorage.getItem('hf_access_token')) return true
  const expiresAt = Number(localStorage.getItem('hf_token_expires_at'))
  if (!expiresAt) return false
  return Date.now() > expiresAt - 120_000 // refresh 2 min before expiry
}

export async function handleOAuthCallback(code, state) {
  if (state !== localStorage.getItem('hf_state')) throw new Error('State mismatch — please try again')
  const verifier = localStorage.getItem('hf_verifier')
  const clientId = localStorage.getItem('hf_client_id')

  const res = await fetch(`${AUTH_PROXY}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${window.location.origin}/auth/callback`,
      client_id: clientId,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error_description || 'Token exchange failed')
  }
  const tokens = await res.json()
  saveTokens(tokens)
  localStorage.removeItem('hf_verifier')
  localStorage.removeItem('hf_state')
  return tokens
}

export function getHFToken() { return localStorage.getItem('hf_access_token') }
export function isHFConnected() { return !!getHFToken() }
export function disconnectHF() {
  ['hf_access_token', 'hf_refresh_token', 'hf_token_expires_at', 'hf_verifier', 'hf_state']
    .forEach(k => localStorage.removeItem(k))
}

export async function refreshHFToken() {
  const refreshToken = localStorage.getItem('hf_refresh_token')
  const clientId = localStorage.getItem('hf_client_id')
  if (!refreshToken || !clientId) throw new Error('No refresh token — please reconnect in Settings')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let res
  try {
    res = await fetch(`${AUTH_PROXY}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    disconnectHF()
    throw new Error('Session expired — please reconnect in Settings')
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    disconnectHF()
    throw new Error('Session expired — please reconnect in Settings')
  }
  const tokens = await res.json()
  saveTokens(tokens)
  return tokens.access_token
}

// Called on app focus — silently gets a fresh token if the current one is expired or close to expiring.
export async function silentRefreshHFToken() {
  if (!needsRefresh()) return
  if (!localStorage.getItem('hf_refresh_token')) return
  try { await refreshHFToken() } catch (_) { /* surfaces on next API call */ }
}

// Fire the referral link once per device so affiliate tracking is captured.
// Must be called from a user-interaction handler (click) to avoid popup blockers.
export function fireReferralOnce() {
  if (localStorage.getItem('hf_referral_fired')) return
  window.open('https://higgsfield.ai/?fpr=dankieft&fp_sid=tool', '_blank', 'noopener,noreferrer')
  localStorage.setItem('hf_referral_fired', '1')
}
