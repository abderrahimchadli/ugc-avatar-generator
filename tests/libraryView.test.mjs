import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getRecentLibraryItems,
  packageImageCount,
  packageUpdatedAt,
  sortPackagesForLibrary,
} from '../src/utils/libraryView.js'

const packs = [
  { id: 'a', type: 'avatar', name: 'Zara', updatedAt: 10, items: [{ id: 'i1', createdAt: 20 }] },
  { id: 'b', type: 'product', name: 'Bottle', updatedAt: 30, notes: 'glass serum', items: [] },
  { id: 'c', type: 'avatar', name: 'Adam', updatedAt: 5, items: [{ id: 'i2', createdAt: 40 }, { id: 'i3', createdAt: 15 }] },
]

test('sorts library packages by recent activity, images, name, filter, and search', () => {
  assert.deepEqual(sortPackagesForLibrary(packs).map(p => p.id), ['c', 'b', 'a'])
  assert.deepEqual(sortPackagesForLibrary(packs, { sort: 'images' }).map(p => p.id), ['c', 'a', 'b'])
  assert.deepEqual(sortPackagesForLibrary(packs, { sort: 'name' }).map(p => p.id), ['c', 'b', 'a'])
  assert.deepEqual(sortPackagesForLibrary(packs, { type: 'product' }).map(p => p.id), ['b'])
  assert.deepEqual(sortPackagesForLibrary(packs, { query: 'serum' }).map(p => p.id), ['b'])
})

test('builds recent item strip from newest package items', () => {
  const recent = getRecentLibraryItems(packs, 2)
  assert.deepEqual(recent.map(item => item.id), ['i2', 'i1'])
  assert.equal(recent[0].packageName, 'Adam')
  assert.equal(packageImageCount(packs[2]), 2)
  assert.equal(packageUpdatedAt(packs[0]), 20)
})
