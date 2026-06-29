import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig } from '../lib/supabaseClient'
import { useAuth } from './auth'
import {
  PACKAGE_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  accountStorageKey,
  migrateLegacyPackages,
} from '../utils/accountStorage'
import {
  deleteServerPackage,
  deleteServerPackageItem,
  loadServerPackages,
  saveServerPackage,
  saveServerPackageItem,
  saveServerPackageWithItems,
} from '../utils/serverPackageStore'

const StoreCtx = createContext(null)

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) { console.warn('Storage write failed', e) }
}

export function PackageProvider({ children }) {
  const { profile } = useAuth()
  const [packages, setPackagesState] = useState([])
  const [sessions, setSessionsState] = useState([])
  const [serverStatus, setServerStatus] = useState(() => ({
    mode: hasSupabaseConfig ? 'server' : 'local',
    sync: hasSupabaseConfig ? 'idle' : 'local-only',
    message: hasSupabaseConfig ? 'Server storage is ready.' : 'Demo mode saves data in this browser only.',
  }))
  const packageKey = accountStorageKey(PACKAGE_STORAGE_KEY, profile)
  const sessionKey = accountStorageKey(SESSION_STORAGE_KEY, profile)

  useEffect(() => {
    let cancelled = false

    async function loadAccountPackages() {
      if (!profile) {
        setPackagesState([])
        setSessionsState([])
        return
      }

      if (hasSupabaseConfig) {
        setServerStatus({ mode: 'server', sync: 'loading', message: 'Loading server library...' })
        const result = await loadServerPackages(profile)
        if (cancelled) return
        if (!result.error) {
          setPackagesState(result.packages || [])
          writeJson(packageKey, result.packages || [])
          setSessionsState(readJson(sessionKey, []))
          setServerStatus({ mode: 'server', sync: 'synced', message: 'Server library synced.' })
          return
        }
        const fallback = readJson(packageKey, [])
        setPackagesState(fallback)
        setSessionsState(readJson(sessionKey, []))
        setServerStatus({ mode: 'server', sync: 'error', message: result.error.message || 'Could not load server library. Showing local cache.' })
        return
      }

      const scopedPackages = readJson(packageKey, null)
      if (Array.isArray(scopedPackages)) {
        setPackagesState(scopedPackages)
      } else {
        const migrated = migrateLegacyPackages(readJson(PACKAGE_STORAGE_KEY, []), profile)
        setPackagesState(migrated)
        writeJson(packageKey, migrated)
      }
      setSessionsState(readJson(sessionKey, []))
      setServerStatus({ mode: 'local', sync: 'local-only', message: 'Demo mode saves data in this browser only.' })
    }

    loadAccountPackages()
    return () => {
      cancelled = true
    }
  }, [profile?.id, packageKey, sessionKey])

  function setPackages(next) {
    setPackagesState(next)
    writeJson(packageKey, next)
  }

  function setSessions(next) {
    setSessionsState(next)
    writeJson(sessionKey, next)
  }

  function createPackage(type, name, notes = '') {
    const pack = {
      id: uid(type === 'avatar' ? 'av' : 'prd'),
      ownerId: profile?.id || 'signed-out',
      type,
      name: name.trim(),
      notes,
      identityLock: '',
      styleLock: '',
      items: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setPackages([pack, ...packages])
    persistServer(() => saveServerPackage(pack))
    return pack
  }

  function updatePackage(id, patch) {
    let updated = null
    const next = packages.map(p => {
      if (p.id !== id) return p
      updated = { ...p, ...patch, updatedAt: Date.now() }
      return updated
    })
    setPackages(next)
    if (updated) persistServer(() => saveServerPackageWithItems(updated))
  }

  function deletePackage(id) {
    setPackages(packages.filter(p => p.id !== id))
    persistServer(() => deleteServerPackage(id))
  }

  function addPackageItem(packageId, item) {
    const pack = packages.find(p => p.id === packageId)
    if (!pack) return { error: new Error('Package was not found for the active account.') }
    if (item.importId) {
      const existing = (pack.items || []).find(existingItem => existingItem.importId === item.importId)
      if (existing) return { item: existing, package: pack, duplicate: true }
    }
    const nextItem = {
      id: item.id || uid('img'),
      importId: item.importId || null,
      label: item.label || 'Imported image',
      type: item.type || 'image',
      mode: item.mode || 'imported',
      source: item.source || 'manual',
      ownerId: pack.ownerId || profile?.id || 'signed-out',
      url: item.url || item.dataUrl || '',
      prompt: item.prompt || '',
      sizeBytes: item.sizeBytes || estimateBytes(item.url || item.dataUrl || ''),
      higgsfield: item.higgsfield || null,
      createdAt: Date.now(),
    }
    const nextPack = { ...pack, items: [nextItem, ...(pack.items || [])], updatedAt: Date.now() }
    setPackages(packages.map(p => p.id === packageId
      ? nextPack
      : p
    ))
    persistServer(async () => {
      await saveServerPackage(nextPack)
      return saveServerPackageItem(nextPack.id, nextPack.ownerId, nextItem)
    })
    return { item: nextItem, package: nextPack }
  }

  function removePackageItem(packageId, itemId) {
    setPackages(packages.map(p => p.id === packageId
      ? { ...p, items: (p.items || []).filter(i => i.id !== itemId), updatedAt: Date.now() }
      : p
    ))
    persistServer(() => deleteServerPackageItem(itemId))
  }

  function createGenerationSession({ packageId, mode, prompt, source, flowModel, imageModel }) {
    const pack = packages.find(p => p.id === packageId)
    const session = {
      id: uid('gen'),
      packageId,
      packageName: pack?.name || '',
      packageType: pack?.type || 'avatar',
      ownerId: pack?.ownerId || profile?.id || 'signed-out',
      ownerEmail: profile?.email || '',
      ownerName: profile?.displayName || profile?.email || '',
      mode,
      prompt,
      promptHash: hashText(prompt),
      source,
      flowModel: flowModel || null,
      imageModel: imageModel || null,
      startedAt: Date.now(),
      status: 'active',
    }
    setSessions([session, ...sessions].slice(0, 50))
    return session
  }

  async function syncPackageToSupabase(pack) {
    if (!hasSupabaseConfig || !profile) return { skipped: true }
    return saveServerPackageWithItems(pack)
  }

  function persistServer(operation) {
    if (!hasSupabaseConfig || !profile) return
    setServerStatus({ mode: 'server', sync: 'saving', message: 'Saving to server...' })
    operation().then(result => {
      if (result?.error) {
        setServerStatus({ mode: 'server', sync: 'error', message: result.error.message || 'Server save failed.' })
      } else {
        setServerStatus({ mode: 'server', sync: 'synced', message: 'Saved to server.' })
      }
    }).catch(error => {
      setServerStatus({ mode: 'server', sync: 'error', message: error.message || 'Server save failed.' })
    })
  }

  const storageStats = useMemo(() => {
    const items = packages.flatMap(p => p.items || [])
    const usedBytes = items.reduce((sum, item) => sum + (item.sizeBytes || 0), 0)
    return { packages: packages.length, images: items.length, usedBytes }
  }, [packages])

  const value = {
    packages,
    sessions,
    storageStats,
    serverStatus,
    hasServerStorage: hasSupabaseConfig,
    createPackage,
    updatePackage,
    deletePackage,
    addPackageItem,
    removePackageItem,
    createGenerationSession,
    syncPackageToSupabase,
  }

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

function estimateBytes(data) {
  if (!data) return 0
  if (data.startsWith('data:')) return Math.round((data.length * 3) / 4)
  return 0
}

function hashText(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0
  return Math.abs(hash).toString(16)
}

export function usePackages() {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('usePackages must be used inside PackageProvider')
  return ctx
}
