import test from 'node:test'
import assert from 'node:assert/strict'
import { validateExtensionImport } from '../src/utils/importGuards.js'

const profile = { id: 'demo-abderrahim', displayName: 'Abderrahim', email: 'abderrahim@ugc.local' }
const packages = [{ id: 'av_1', ownerId: 'demo-abderrahim', name: 'Jack', type: 'avatar', items: [] }]

test('accepts extension imports for the active account and package', () => {
  const result = validateExtensionImport({
    profile,
    packages,
    payload: { packageId: 'av_1', dataUrl: 'data:image/png;base64,abc', ownerId: 'demo-abderrahim' },
  })
  assert.equal(result.ok, true)
  assert.equal(result.pack.name, 'Jack')
})

test('blocks extension imports from another account', () => {
  const result = validateExtensionImport({
    profile,
    packages,
    payload: { packageId: 'av_1', dataUrl: 'data:image/png;base64,abc', ownerId: 'demo-kaoutar', ownerName: 'Kaoutar' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'owner_mismatch')
  assert.match(result.message, /Kaoutar/)
})

test('reports missing packages instead of silently losing saved images', () => {
  const result = validateExtensionImport({
    profile,
    packages,
    payload: { packageId: 'missing', packageName: 'Lost pack', dataUrl: 'data:image/png;base64,abc', ownerId: 'demo-abderrahim' },
  })
  assert.equal(result.ok, false)
  assert.equal(result.code, 'package_missing')
  assert.match(result.message, /Lost pack/)
})
