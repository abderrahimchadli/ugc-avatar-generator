import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import { useAuth } from './auth'
import {
  PACKAGE_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  accountStorageKey,
  migrateLegacyPackages,
} from '../utils/accountStorage'

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
  const packageKey = accountStorageKey(PACKAGE_STORAGE_KEY, profile)
  const sessionKey = accountStorageKey(SESSION_STORAGE_KEY, profile)

  useEffect(() => {
    if (!profile) {
      setPackagesState([])
      setSessionsState([])
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
    return pack
  }

  function updatePackage(id, patch) {
    setPackages(packages.map(p => p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p))
  }

  function deletePackage(id) {
    setPackages(packages.filter(p => p.id !== id))
  }

  function addPackageItem(packageId, item) {
    const nextItem = {
      id: item.id || uid('img'),
      label: item.label || 'Imported image',
      type: item.type || 'image',
      mode: item.mode || 'imported',
      source: item.source || 'manual',
      url: item.url || item.dataUrl || '',
      prompt: item.prompt || '',
      sizeBytes: item.sizeBytes || estimateBytes(item.url || item.dataUrl || ''),
      higgsfield: item.higgsfield || null,
      createdAt: Date.now(),
    }
    setPackages(packages.map(p => p.id === packageId
      ? { ...p, items: [nextItem, ...(p.items || [])], updatedAt: Date.now() }
      : p
    ))
    return nextItem
  }

  function removePackageItem(packageId, itemId) {
    setPackages(packages.map(p => p.id === packageId
      ? { ...p, items: (p.items || []).filter(i => i.id !== itemId), updatedAt: Date.now() }
      : p
    ))
  }

  function createGenerationSession({ packageId, mode, prompt, source, flowModel, imageModel }) {
    const pack = packages.find(p => p.id === packageId)
    const session = {
      id: uid('gen'),
      packageId,
      packageName: pack?.name || '',
      packageType: pack?.type || 'avatar',
      ownerId: pack?.ownerId || profile?.id || 'signed-out',
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
    const { error } = await supabase.from('packages').upsert({
      id: pack.id,
      owner_id: pack.ownerId,
      type: pack.type,
      name: pack.name,
      metadata: pack,
      updated_at: new Date().toISOString(),
    })
    return { error }
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
