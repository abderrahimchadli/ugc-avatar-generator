import test from 'node:test'
import assert from 'node:assert/strict'
import { __testing, getHFWorkspaceId } from '../src/utils/higgsfieldAuth.js'

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

test('getHFWorkspaceId reads the token claim and caches it', () => {
  const token = jwtWithPayload({
    sub: 'user_1',
    current_workspace_id: 'workspace_cached',
  })
  const values = installLocalStorage({ hf_access_token: token })

  assert.equal(getHFWorkspaceId(), 'workspace_cached')
  assert.equal(values.get('hf_workspace_id'), 'workspace_cached')
})
