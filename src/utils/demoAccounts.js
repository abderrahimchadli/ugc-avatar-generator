export const DEMO_PROFILE_KEY = 'ugc_demo_profile'
export const DEMO_ACCOUNTS_KEY = 'ugc_demo_accounts_v2'

export const SEEDED_DEMO_ACCOUNTS = [
  {
    id: 'demo-abderrahim',
    displayName: 'Abderrahim',
    email: 'abderrahim@ugc.local',
    password: 'Abderrahim#UGC26',
    role: 'super_user',
    status: 'approved',
    demo: true,
  },
  {
    id: 'demo-kaoutar',
    displayName: 'Kaoutar',
    email: 'kaoutar@ugc.local',
    password: 'Kaoutar#UGC26',
    role: 'user',
    status: 'approved',
    demo: true,
  },
  {
    id: 'demo-ilyas',
    displayName: 'Ilyas',
    email: 'ilyas@ugc.local',
    password: 'Ilyas#UGC26',
    role: 'user',
    status: 'approved',
    demo: true,
  },
]

export function normalizeLogin(value) {
  return String(value || '').trim().toLowerCase()
}

export function toProfile(account) {
  if (!account) return null
  return {
    id: account.id,
    displayName: account.displayName,
    email: account.email,
    role: account.role,
    status: account.status,
    demo: true,
  }
}

export function mergeSeededAccounts(saved = []) {
  const byId = new Map()
  for (const account of SEEDED_DEMO_ACCOUNTS) byId.set(account.id, account)
  for (const account of Array.isArray(saved) ? saved : []) {
    if (account?.id) byId.set(account.id, { ...byId.get(account.id), ...account, demo: true })
  }
  return [...byId.values()]
}

export function readDemoAccounts(storage = globalThis.localStorage) {
  try {
    return mergeSeededAccounts(JSON.parse(storage.getItem(DEMO_ACCOUNTS_KEY) || '[]'))
  } catch {
    return mergeSeededAccounts([])
  }
}

export function saveDemoAccounts(accounts, storage = globalThis.localStorage) {
  storage.setItem(DEMO_ACCOUNTS_KEY, JSON.stringify(accounts))
}

export function findDemoAccount(accounts, login) {
  const needle = normalizeLogin(login)
  return accounts.find(account => (
    normalizeLogin(account.email) === needle ||
    normalizeLogin(account.displayName) === needle
  )) || null
}

export function readActiveDemoProfile(accounts, storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(DEMO_PROFILE_KEY) || 'null')
    if (!saved?.id) return null
    const account = accounts.find(item => item.id === saved.id)
    return account ? toProfile(account) : null
  } catch {
    return null
  }
}

export function signInDemoAccount({ login, password, accounts }) {
  const account = findDemoAccount(accounts, login)
  if (!account || account.password !== password) {
    return { error: { message: 'Account or password is not correct.' } }
  }
  if (account.status === 'blocked') {
    return { error: { message: 'This account is blocked.' } }
  }
  return { profile: toProfile(account) }
}

export function createDemoAccount({ email, password, displayName, accounts }) {
  const normalizedEmail = normalizeLogin(email)
  if (!normalizedEmail.includes('@')) return { error: { message: 'Use an email address.' } }
  if (String(password || '').length < 8) return { error: { message: 'Password must be at least 8 characters.' } }
  if (findDemoAccount(accounts, normalizedEmail)) return { error: { message: 'This account already exists.' } }

  const name = String(displayName || normalizedEmail.split('@')[0]).trim()
  const account = {
    id: `demo-${normalizedEmail.replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`,
    displayName: name,
    email: normalizedEmail,
    password,
    role: 'user',
    status: 'pending',
    demo: true,
  }
  return { account, accounts: [account, ...accounts], profile: toProfile(account) }
}

export function updateDemoAccountStatus(accounts, id, status) {
  return accounts.map(account => account.id === id ? { ...account, status } : account)
}
