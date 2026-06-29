import test from 'node:test'
import assert from 'node:assert/strict'
import {
  composePackagesFromRows,
  itemRowFromPackageItem,
  mergePackageLists,
  packageRowFromPackage,
} from '../src/utils/serverPackageStore.js'

test('serializes package and item rows for server storage', () => {
  const pack = { id: 'av_1', ownerId: 'user-1', type: 'avatar', name: 'Jack', items: [], createdAt: 1, updatedAt: 2 }
  const item = { id: 'img_1', mode: 'main_portrait', source: 'google-flow', url: 'data:image/png;base64,abc', prompt: 'prompt', sizeBytes: 12, createdAt: 3 }

  assert.deepEqual(packageRowFromPackage(pack).metadata.items, undefined)
  assert.equal(packageRowFromPackage(pack).owner_id, 'user-1')
  assert.equal(itemRowFromPackageItem(pack.id, pack.ownerId, item).package_id, 'av_1')
  assert.equal(itemRowFromPackageItem(pack.id, pack.ownerId, item).url, item.url)
})

test('composes server package and item rows into account packages', () => {
  const packages = composePackagesFromRows(
    [{ id: 'av_1', owner_id: 'user-1', type: 'avatar', name: 'Jack', metadata: { styleLock: 'real' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z' }],
    [{ id: 'img_1', package_id: 'av_1', owner_id: 'user-1', source: 'google-flow', mode: 'main_portrait', url: 'u', prompt: 'p', size_bytes: 12, metadata: {}, created_at: '2026-01-03T00:00:00Z' }]
  )
  assert.equal(packages.length, 1)
  assert.equal(packages[0].ownerId, 'user-1')
  assert.equal(packages[0].items[0].id, 'img_1')
  assert.equal(packages[0].items[0].sizeBytes, 12)
})

test('keeps local account packages when server returns an empty list after login', () => {
  const localPackages = [
    { id: 'av_local', ownerId: 'user-1', type: 'avatar', name: 'Local Avatar', updatedAt: 10, items: [] },
  ]
  const merged = mergePackageLists([], localPackages)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].id, 'av_local')
  assert.equal(merged[0].name, 'Local Avatar')
})

test('merges server and local copies without losing imported items', () => {
  const serverPackages = [
    { id: 'av_1', ownerId: 'user-1', type: 'avatar', name: 'Jack', updatedAt: 20, items: [{ id: 'server_img', createdAt: 20 }] },
  ]
  const localPackages = [
    { id: 'av_1', ownerId: 'user-1', type: 'avatar', name: 'Jack old', updatedAt: 10, items: [{ id: 'local_img', createdAt: 30 }] },
  ]
  const merged = mergePackageLists(serverPackages, localPackages)
  assert.equal(merged.length, 1)
  assert.equal(merged[0].name, 'Jack')
  assert.deepEqual(merged[0].items.map(item => item.id), ['local_img', 'server_img'])
})
