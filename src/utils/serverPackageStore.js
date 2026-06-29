import { hasSupabaseConfig, supabase } from '../lib/supabaseClient.js'

function toTime(value, fallback = Date.now()) {
  const time = value ? new Date(value).getTime() : NaN
  return Number.isFinite(time) ? time : fallback
}

export function packageRowFromPackage(pack) {
  const { items: _items, ...metadata } = pack
  return {
    id: pack.id,
    owner_id: pack.ownerId,
    type: pack.type,
    name: pack.name,
    metadata,
    updated_at: new Date(pack.updatedAt || Date.now()).toISOString(),
  }
}

export function itemRowFromPackageItem(packageId, ownerId, item) {
  const { url: _url, prompt: _prompt, ...metadata } = item
  return {
    id: item.id,
    package_id: packageId,
    owner_id: ownerId,
    source: item.source || 'manual',
    mode: item.mode || 'imported',
    url: item.url || item.dataUrl || '',
    prompt: item.prompt || '',
    size_bytes: item.sizeBytes || 0,
    metadata,
    created_at: new Date(item.createdAt || Date.now()).toISOString(),
  }
}

export function composePackagesFromRows(packageRows = [], itemRows = []) {
  const itemsByPackage = new Map()
  for (const row of itemRows || []) {
    const item = {
      ...(row.metadata || {}),
      id: row.id,
      packageId: row.package_id,
      ownerId: row.owner_id,
      source: row.source || row.metadata?.source || 'manual',
      mode: row.mode || row.metadata?.mode || 'imported',
      url: row.url || row.metadata?.url || '',
      prompt: row.prompt || row.metadata?.prompt || '',
      sizeBytes: row.size_bytes || row.metadata?.sizeBytes || 0,
      createdAt: toTime(row.created_at),
    }
    const list = itemsByPackage.get(row.package_id) || []
    list.push(item)
    itemsByPackage.set(row.package_id, list)
  }

  return (packageRows || []).map(row => {
    const metadata = row.metadata || {}
    const items = (itemsByPackage.get(row.id) || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    return {
      ...metadata,
      id: row.id,
      ownerId: row.owner_id,
      type: row.type,
      name: row.name,
      items,
      createdAt: metadata.createdAt || toTime(row.created_at),
      updatedAt: metadata.updatedAt || toTime(row.updated_at),
    }
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
}

export async function loadServerPackages(profile) {
  if (!hasSupabaseConfig || !profile?.id) return { skipped: true, packages: [] }
  const { data: packageRows, error: packageError } = await supabase
    .from('packages')
    .select('*')
    .eq('owner_id', profile.id)
    .order('updated_at', { ascending: false })
  if (packageError) return { error: packageError, packages: [] }

  const { data: itemRows, error: itemError } = await supabase
    .from('package_items')
    .select('*')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false })
  if (itemError) return { error: itemError, packages: composePackagesFromRows(packageRows, []) }

  return { packages: composePackagesFromRows(packageRows, itemRows), error: null }
}

export async function saveServerPackage(pack) {
  if (!hasSupabaseConfig || !pack?.ownerId) return { skipped: true }
  return supabase.from('packages').upsert(packageRowFromPackage(pack))
}

export async function saveServerPackageItem(packageId, ownerId, item) {
  if (!hasSupabaseConfig || !ownerId || !item?.id) return { skipped: true }
  return supabase.from('package_items').upsert(itemRowFromPackageItem(packageId, ownerId, item))
}

export async function saveServerPackageWithItems(pack) {
  const packageResult = await saveServerPackage(pack)
  if (packageResult?.error) return packageResult
  const rows = (pack.items || []).map(item => itemRowFromPackageItem(pack.id, pack.ownerId, item))
  if (!rows.length || !hasSupabaseConfig) return packageResult
  return supabase.from('package_items').upsert(rows)
}

export async function deleteServerPackage(id) {
  if (!hasSupabaseConfig || !id) return { skipped: true }
  return supabase.from('packages').delete().eq('id', id)
}

export async function deleteServerPackageItem(id) {
  if (!hasSupabaseConfig || !id) return { skipped: true }
  return supabase.from('package_items').delete().eq('id', id)
}
