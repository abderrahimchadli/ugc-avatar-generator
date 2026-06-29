export function packageImageCount(pack) {
  return (pack?.items || []).length
}

export function packageUsedBytes(pack) {
  return (pack?.items || []).reduce((sum, item) => sum + (item.sizeBytes || 0), 0)
}

export function packageUpdatedAt(pack) {
  const itemUpdatedAt = Math.max(0, ...(pack?.items || []).map(item => item.createdAt || 0))
  return Math.max(pack?.updatedAt || 0, itemUpdatedAt)
}

export function sortPackagesForLibrary(packages, { type = 'all', query = '', sort = 'updated' } = {}) {
  const needle = query.trim().toLowerCase()
  return [...(packages || [])]
    .filter(pack => type === 'all' || pack.type === type)
    .filter(pack => {
      if (!needle) return true
      return [pack.name, pack.type, pack.notes, pack.identityLock, pack.styleLock]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
    .sort((a, b) => {
      if (sort === 'name') return String(a.name || '').localeCompare(String(b.name || ''))
      if (sort === 'images') return packageImageCount(b) - packageImageCount(a) || packageUpdatedAt(b) - packageUpdatedAt(a)
      return packageUpdatedAt(b) - packageUpdatedAt(a)
    })
}

export function getRecentLibraryItems(packages, limit = 10) {
  return (packages || [])
    .flatMap(pack => (pack.items || []).map(item => ({
      ...item,
      packageId: pack.id,
      packageName: pack.name,
      packageType: pack.type,
    })))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, limit)
}
