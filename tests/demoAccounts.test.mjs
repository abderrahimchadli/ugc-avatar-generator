import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SEEDED_DEMO_ACCOUNTS,
  createDemoAccount,
  findDemoAccount,
  mergeSeededAccounts,
  signInDemoAccount,
  toProfile,
  updateDemoAccountStatus,
} from '../src/utils/demoAccounts.js'
import {
  PACKAGE_STORAGE_KEY,
  accountStorageKey,
  migrateLegacyPackages,
} from '../src/utils/accountStorage.js'

test('seeds the requested demo accounts with approved roles', () => {
  assert.deepEqual(SEEDED_DEMO_ACCOUNTS.map(account => account.displayName), ['Abderrahim', 'Kaoutar', 'Ilyas'])
  assert.equal(SEEDED_DEMO_ACCOUNTS[0].role, 'super_user')
  assert.equal(SEEDED_DEMO_ACCOUNTS.every(account => account.status === 'approved'), true)
})

test('signs in with demo email or display name and rejects wrong passwords', () => {
  const accounts = mergeSeededAccounts()
  assert.equal(findDemoAccount(accounts, 'Abderrahim').email, 'abderrahim@ugc.local')
  assert.equal(signInDemoAccount({ login: 'kaoutar@ugc.local', password: 'wrong', accounts }).error.message, 'Account or password is not correct.')
  const result = signInDemoAccount({ login: 'kaoutar@ugc.local', password: 'Kaoutar#UGC26', accounts })
  assert.equal(result.profile.id, 'demo-kaoutar')
  assert.equal(result.profile.status, 'approved')
})

test('creates pending demo accounts for super user approval', () => {
  const accounts = mergeSeededAccounts()
  const result = createDemoAccount({
    email: 'new@example.local',
    password: 'NewUser#123',
    displayName: 'New User',
    accounts,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.account.status, 'pending')
  assert.equal(result.accounts.length, accounts.length + 1)
})

test('updates demo account approval status', () => {
  const accounts = mergeSeededAccounts()
  const next = updateDemoAccountStatus(accounts, 'demo-ilyas', 'blocked')
  assert.equal(toProfile(next.find(account => account.id === 'demo-ilyas')).status, 'blocked')
})

test('scopes package storage keys by account id and migrates legacy data to Abderrahim', () => {
  const abderrahim = { id: 'demo-abderrahim' }
  const kaoutar = { id: 'demo-kaoutar' }
  assert.equal(accountStorageKey(PACKAGE_STORAGE_KEY, abderrahim), 'ugc_packages_v1:demo-abderrahim')
  assert.equal(accountStorageKey(PACKAGE_STORAGE_KEY, kaoutar), 'ugc_packages_v1:demo-kaoutar')
  assert.deepEqual(migrateLegacyPackages([{ id: 'old', ownerId: 'demo-super-user' }], abderrahim), [{ id: 'old', ownerId: 'demo-abderrahim' }])
  assert.deepEqual(migrateLegacyPackages([{ id: 'old', ownerId: 'demo-super-user' }], kaoutar), [])
})
