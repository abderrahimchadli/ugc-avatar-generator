const AUTH_PROXY = '/api/hf'           // fetch calls — goes through proxy, bypasses CORS
const FNF_PROXY = '/api/fnf'
const AUTH_DIRECT = 'https://mcp.higgsfield.ai' // browser redirect — must be real URL

// Higgsfield rate-limits its OAuth endpoints by IP. Because every user's traffic
// egresses through our shared Vercel edge IPs, concurrent connects collectively trip
// a 429. These statuses are transient — retry with backoff instead of failing hard.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])
const sleep = ms => new Promise(r => setTimeout(r, ms))
const HF_WORKSPACE_KEY = 'hf_workspace_id'
const WORKSPACE_ID_KEYS = [
  'workspace_id',
  'workspaceId',
  'workspace_uuid',
  'workspaceUuid',
  'active_workspace_id',
  'activeWorkspaceId',
  'current_workspace_id',
  'currentWorkspaceId',
  'fnf_workspace_id',
  'fnfWorkspaceId',
]
const IDENTITY_ID_KEYS = ['sub', 'user_id', 'userId', 'account_id', 'accountId', 'id', 'uuid']
const OAUTH_WORKSPACE_PATHS = ['/oauth2/userinfo', '/oauth2/userinfo/']
const FNF_WORKSPACE_PATHS = [
  '/developer/v1alpha/workspaces',
  '/developer/v1alpha/workspaces/current',
  '/developer/v1alpha/workspace',
  '/developer/v1alpha/me',
  '/developer/v1alpha/user',
  '/developer/v1alpha/profile',
  '/developer/v2alpha/workspaces',
  '/developer/v2alpha/me',
]

// Exponential backoff with jitter: ~0.5s, 1s, 2s, 4s (+ up to 0.4s jitter)
function backoffMs(attempt) {
  return 500 * Math.pow(2, attempt) + Math.floor(Math.random() * 400)
}

// fetch() that retries transient failures (rate limits, 5xx, network errors).
// Honors a Retry-After header when present. Each attempt gets its own timeout so a
// hung request doesn't stall the whole flow. The body must be a string or
// URLSearchParams (both re-readable across attempts) — never a stream.
async function fetchWithRetry(url, options, { attempts = 4, perAttemptTimeoutMs = 20000 } = {}) {
  let lastRes = null
  for (let i = 0; i < attempts; i++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), perAttemptTimeoutMs)
    let res
    try {
      res = await fetch(url, { ...options, signal: controller.signal })
    } catch (e) {
      clearTimeout(timer)
      if (i === attempts - 1) throw e   // network error / timeout — let caller decide
      await sleep(backoffMs(i))
      continue
    }
    clearTimeout(timer)
    if (!RETRYABLE_STATUS.has(res.status) || i === attempts - 1) return res
    lastRes = res
    const ra = Number(res.headers.get('retry-after'))
    const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 8000) : backoffMs(i)
    await sleep(wait)
  }
  return lastRes
}

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

function safeStorageGet(key) {
  try { return localStorage.getItem(key) || '' } catch { return '' }
}

function safeStorageSet(key, value) {
  try { if (value) localStorage.setItem(key, value) } catch {}
}

function safeStorageRemove(key) {
  try { localStorage.removeItem(key) } catch {}
}

function base64UrlDecode(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  if (typeof atob === 'function') return atob(padded)
  if (typeof Buffer !== 'undefined') return Buffer.from(padded, 'base64').toString('utf8')
  return ''
}

function decodeJwtPayload(token) {
  const part = String(token || '').split('.')[1]
  if (!part) return null
  try { return JSON.parse(base64UrlDecode(part)) } catch { return null }
}

function firstWorkspaceId(value, seen = new WeakSet()) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstWorkspaceId(item, seen)
      if (found) return found
    }
    return ''
  }

  for (const key of WORKSPACE_ID_KEYS) {
    const direct = firstWorkspaceId(value[key], seen)
    if (direct) return direct
  }

  for (const key of ['workspace', 'active_workspace', 'current_workspace', 'fnf_workspace']) {
    const nested = value[key]
    if (typeof nested === 'string') return nested.trim()
    if (nested?.id) return String(nested.id).trim()
    const found = firstWorkspaceId(nested, seen)
    if (found) return found
  }

  for (const key of ['workspaces', 'workspace_ids', 'workspaceIds']) {
    const list = value[key]
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const found = typeof item === 'string' ? item.trim() : firstWorkspaceId(item, seen)
      if (found) return found
    }
  }

  return ''
}

function firstIdentityId(value, seen = new WeakSet()) {
  if (!value) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstIdentityId(item, seen)
      if (found) return found
    }
    return ''
  }

  for (const key of IDENTITY_ID_KEYS) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (candidate && typeof candidate === 'object') {
      const found = firstIdentityId(candidate, seen)
      if (found) return found
    }
  }

  for (const key of ['user', 'account', 'profile', 'identity']) {
    const found = firstIdentityId(value[key], seen)
    if (found) return found
  }
  return ''
}

function workspaceIdFromTokens(tokens) {
  const payload = decodeJwtPayload(tokens?.access_token)
  return firstWorkspaceId(tokens)
    || firstWorkspaceId(payload)
    || firstIdentityId(tokens)
    || firstIdentityId(payload)
}

async function ensureClientId() {
  const stored = localStorage.getItem('hf_client_id')
  if (stored) return stored
  const res = await fetchWithRetry(`${AUTH_PROXY}/oauth2/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      client_name: 'AI Influencer Studio',
      redirect_uris: [`${window.location.origin}/auth/callback`],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      code_challenge_method: 'S256',
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    if (res.status === 429)
      throw new Error('Higgsfield is busy right now — wait a few seconds and click Connect again.')
    throw new Error(`Failed to register OAuth client (${res.status})${detail ? ': ' + detail.slice(0, 200) : ''}`)
  }
  const d = await res.json()
  if (!d.client_id) throw new Error('Registration returned no client_id')
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
  const w = 520, h = 660
  const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
  const top = Math.round(window.screenY + (window.outerHeight - h) / 2)

  const referralDone = localStorage.getItem('hf_referral_fired')

  // CRITICAL: open the popup synchronously, inside the click gesture, BEFORE any
  // await. buildAuthUrl() makes network calls; if we await it first, the browser
  // no longer treats window.open as user-initiated and blocks the popup.
  // First-time users land on the referral page (sets cookie); returning users get
  // a blank popup we immediately redirect once the auth URL is ready.
  const startUrl = referralDone ? 'about:blank' : 'https://higgsfield.ai/?fpr=dankieft&fp_sid=tool'
  const popup = window.open(startUrl, 'hf_oauth', `width=${w},height=${h},left=${left},top=${top}`)
  if (!popup) throw new Error('Popup blocked — please allow popups for this site and try again')

  // Now do the async work — the popup is already open and won't be blocked.
  let authUrl
  try {
    authUrl = await buildAuthUrl()
  } catch (e) {
    try { popup.close() } catch (_) {}
    throw e
  }

  if (referralDone) {
    // Returning user: send the blank popup straight to OAuth.
    try { popup.location.href = authUrl } catch (_) {}
  } else {
    // First-timer: give the referral page ~2.5 s to set its cookie, then go to OAuth.
    setTimeout(() => { try { popup.location.href = authUrl } catch (_) {} }, 2500)
  }

  return new Promise((resolve, reject) => {
    function onMessage(e) {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'hf_auth_success') {
        // Only mark referral as fired after OAuth actually succeeds
        if (!referralDone) localStorage.setItem('hf_referral_fired', '1')
        cleanup(); resolve()
      }
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
  safeStorageSet(HF_WORKSPACE_KEY, workspaceIdFromTokens(tokens))
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

  // The auth code is single-use but is only consumed on a SUCCESSFUL exchange, so a
  // transient 429/5xx leaves it valid — fetchWithRetry can safely retry the same code.
  const res = await fetchWithRetry(`${AUTH_PROXY}/oauth2/token`, {
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
    const reason = res.status === 429
      ? 'Higgsfield is rate-limiting connections right now — wait a moment and click Connect again.'
      : (e.error_description || e.error || `Token exchange failed (${res.status})`)
    // Stale PKCE/auth code — clear so the next Connect click starts a fresh flow
    localStorage.removeItem('hf_verifier')
    localStorage.removeItem('hf_state')
    // A rejected client means our cached registration is no longer valid upstream — drop it so we re-register
    if (e.error === 'invalid_client' || res.status === 401) {
      localStorage.removeItem('hf_client_id')
    }
    throw new Error(reason)
  }
  const tokens = await res.json()
  saveTokens(tokens)
  localStorage.removeItem('hf_verifier')
  localStorage.removeItem('hf_state')
  return tokens
}

export function getHFToken() { return localStorage.getItem('hf_access_token') }

export function setHFWorkspaceId(value) {
  const cleaned = String(value || '').trim()
  if (cleaned) safeStorageSet(HF_WORKSPACE_KEY, cleaned)
  else safeStorageRemove(HF_WORKSPACE_KEY)
  return cleaned
}

export function clearHFWorkspaceId() {
  safeStorageRemove(HF_WORKSPACE_KEY)
}

export function getHFWorkspaceId() {
  const stored = safeStorageGet(HF_WORKSPACE_KEY)
  if (stored) return stored
  const payload = decodeJwtPayload(getHFToken())
  const fromToken = firstWorkspaceId(payload) || firstIdentityId(payload)
  safeStorageSet(HF_WORKSPACE_KEY, fromToken)
  return fromToken
}

async function fetchWorkspaceCandidate(url, token) {
  try {
    const res = await fetchWithRetry(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    }, { attempts: 2, perAttemptTimeoutMs: 10000 })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  }
}

function workspaceIdFromDiscoveryData(data) {
  return firstWorkspaceId(data) || firstIdentityId(data)
}

async function discoverHFWorkspaceId(token) {
  for (const path of OAUTH_WORKSPACE_PATHS) {
    const data = await fetchWorkspaceCandidate(`${AUTH_PROXY}${path}`, token)
    const found = workspaceIdFromDiscoveryData(data)
    if (found) return found
  }

  for (const path of FNF_WORKSPACE_PATHS) {
    const data = await fetchWorkspaceCandidate(`${FNF_PROXY}${path}`, token)
    const found = workspaceIdFromDiscoveryData(data)
    if (found) return found
  }

  return ''
}

export async function ensureHFWorkspaceId({ refresh = false } = {}) {
  const existing = getHFWorkspaceId()
  if (existing && !refresh) return existing

  const token = getHFToken()
  if (!token) return ''

  const payload = decodeJwtPayload(token)
  const discovered = await discoverHFWorkspaceId(token)
    || firstWorkspaceId(payload)
    || firstIdentityId(payload)
  safeStorageSet(HF_WORKSPACE_KEY, discovered)
  return discovered
}
export function isHFConnected() { return !!getHFToken() }
export function disconnectHF() {
  ['hf_access_token', 'hf_refresh_token', 'hf_token_expires_at', 'hf_verifier', 'hf_state', HF_WORKSPACE_KEY]
    .forEach(k => localStorage.removeItem(k))
}

export async function refreshHFToken() {
  const refreshToken = localStorage.getItem('hf_refresh_token')
  const clientId = localStorage.getItem('hf_client_id')
  if (!refreshToken || !clientId) throw new Error('No refresh token — please reconnect in Settings')

  let res
  try {
    res = await fetchWithRetry(`${AUTH_PROXY}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }),
    }, { attempts: 4, perAttemptTimeoutMs: 15000 })
  } catch (e) {
    // Network errors (timeout, connection failure) don't mean the session is invalid —
    // don't disconnect. The error will surface on the next actual API call.
    throw new Error('Network error during token refresh — please check your connection')
  }
  if (!res.ok) {
    // CRITICAL: only a genuine auth rejection (400/401) means the session is truly dead.
    // A 429 (rate limit) or 5xx is transient — disconnecting here would wipe the refresh
    // token and lock the user out permanently for what is just a temporary blip.
    if (res.status === 400 || res.status === 401) {
      disconnectHF()
      throw new Error('Session expired — please reconnect in Settings')
    }
    throw new Error('Higgsfield is busy — token refresh failed temporarily. Please try again in a moment.')
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

export const __testing = {
  decodeJwtPayload,
  firstIdentityId,
  firstWorkspaceId,
  workspaceIdFromTokens,
}
