import { createContext, useContext, useMemo, useState } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabaseClient'
import { useAuth } from './auth'

const StoreCtx = createContext(null)
const PKG_KEY = 'ugc_packages_v1'
const SESSION_KEY = 'ugc_generation_sessions_v1'

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
  const [packages, setPackagesState] = useState(() => readJson(PKG_KEY, []))
  const [sessions, setSessionsState] = useState(() => readJson(SESSION_KEY, []))

  function setPackages(next) {
    setPackagesState(next)
    writeJson(PKG_KEY, next)
  }

  function setSessions(next) {
    setSessionsState(next)
    writeJson(SESSION_KEY, next)
  }

  function createPackage(type, name, notes = '') {
    const pack = {
      id: uid(type === 'avatar' ? 'av' : 'prd'),
      ownerId: profile?.id || 'demo-super-user',
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
      ownerId: pack?.ownerId || profile?.id || 'demo-super-user',
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
