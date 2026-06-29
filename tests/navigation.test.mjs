import test from 'node:test'
import assert from 'node:assert/strict'
import { loginPathForReturn, safeReturnTo } from '../src/utils/navigation.js'

test('preserves protected extension import URL through login', () => {
  const loginPath = loginPathForReturn('/extension-import', '?importId=imp_123')
  assert.equal(loginPath, '/login?returnTo=%2Fextension-import%3FimportId%3Dimp_123')
  assert.equal(safeReturnTo('/extension-import?importId=imp_123'), '/extension-import?importId=imp_123')
})

test('rejects unsafe return URLs', () => {
  assert.equal(safeReturnTo('https://example.com'), '/')
  assert.equal(safeReturnTo('//example.com'), '/')
  assert.equal(safeReturnTo('/ok'), '/ok')
})
