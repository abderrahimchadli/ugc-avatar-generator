import test from 'node:test'
import assert from 'node:assert/strict'
import { __testing, ensureHFWorkspaceId, getHFWorkspaceId, setHFWorkspaceId } from '../src/utils/higgsfieldAuth.js'

function jwtWithPayload(payload) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(payload)}.`
}

function installLocalStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  return values
}

test('extracts workspace id from OAuth token response fields', () => {
  assert.equal(__testing.workspaceIdFromTokens({
    access_token: jwtWithPayload({ sub: 'user_1' }),
    workspace_id: 'workspace_123',
  }), 'workspace_123')
})

test('extracts workspace id from access token claims', () => {
  const token = jwtWithPayload({
    sub: 'user_1',
    active_workspace: { id: 'workspace_from_claim' },
  })

  assert.equal(__testing.workspaceIdFromTokens({ access_token: token }), 'workspace_from_claim')
})

test('extracts workspace id from array-shaped discovery data', () => {
  assert.equal(__testing.firstWorkspaceId([
    { workspace_id: 'workspace_from_array' },
  ]), 'workspace_from_array')
})

test('manually saves and clears Higgsfield workspace id', () => {
  const values = installLocalStorage()

  assert.equal(setHFWorkspaceId(' workspace_manual '), 'workspace_manual')
  assert.equal(getHFWorkspaceId(), 'workspace_manual')
  assert.equal(values.get('hf_workspace_id'), 'workspace_manual')

  assert.equal(setHFWorkspaceId(''), '')
  assert.equal(values.has('hf_workspace_id'), false)
})

test('getHFWorkspaceId reads the token claim and caches it', () => {
  const token = jwtWithPayload({
    sub: 'user_1',
    current_workspace_id: 'workspace_cached',
  })
  const values = installLocalStorage({ hf_access_token: token })

  assert.equal(getHFWorkspaceId(), 'workspace_cached')
  assert.equal(values.get('hf_workspace_id'), 'workspace_cached')
})

test('falls back to token subject when no workspace claim exists', () => {
  const token = jwtWithPayload({
    sub: 'user_workspace_fallback',
    email: 'creator@example.com',
  })
  const values = installLocalStorage({ hf_access_token: token })

  assert.equal(getHFWorkspaceId(), 'user_workspace_fallback')
  assert.equal(values.get('hf_workspace_id'), 'user_workspace_fallback')
})

test('discovers workspace id from OAuth userinfo when local token has none', async () => {
  const values = installLocalStorage({ hf_access_token: 'opaque-token' })
  globalThis.fetch = async url => {
    assert.equal(String(url).endsWith('/oauth2/userinfo'), true)
    return {
      ok: true,
      json: async () => ({ active_workspace: { id: 'workspace_from_userinfo' } }),
    }
  }

  assert.equal(await ensureHFWorkspaceId(), 'workspace_from_userinfo')
  assert.equal(values.get('hf_workspace_id'), 'workspace_from_userinfo')
})

test('discovers workspace id from FNF workspace endpoints when OAuth userinfo has none', async () => {
  const values = installLocalStorage({ hf_access_token: 'opaque-token' })
  const calls = []
  globalThis.fetch = async url => {
    calls.push(String(url))
    if (String(url).includes('/api/fnf/developer/v1alpha/workspaces')) {
      return {
        ok: true,
        json: async () => ([{ workspace_id: 'workspace_from_fnf' }]),
      }
    }
    return {
      ok: false,
      status: 404,
      json: async () => ({}),
    }
  }

  assert.equal(await ensureHFWorkspaceId({ refresh: true }), 'workspace_from_fnf')
  assert.equal(values.get('hf_workspace_id'), 'workspace_from_fnf')
  assert.equal(calls.some(url => url.includes('/api/hf/oauth2/userinfo')), true)
  assert.equal(calls.some(url => url.includes('/api/fnf/developer/v1alpha/workspaces')), true)
})
