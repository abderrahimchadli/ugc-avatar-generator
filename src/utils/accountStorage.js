export const PACKAGE_STORAGE_KEY = 'ugc_packages_v1'
export const SESSION_STORAGE_KEY = 'ugc_generation_sessions_v1'

export function accountStorageKey(baseKey, profile) {
  return profile?.id ? `${baseKey}:${profile.id}` : `${baseKey}:signed-out`
}

export function migrateLegacyPackages(packages, profile) {
  if (profile?.id !== 'demo-abderrahim' || !Array.isArray(packages)) return []
  return packages.map(pack => ({
    ...pack,
    ownerId: profile.id,
  }))
}
