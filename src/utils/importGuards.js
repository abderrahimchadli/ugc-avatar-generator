export function profileLabel(profile) {
  return profile?.displayName || profile?.email || profile?.id || 'this account'
}

export function validateExtensionImport({ payload, profile, packages }) {
  if (!payload) {
    return { ok: false, code: 'missing_payload', message: 'The extension did not send an image payload.' }
  }
  if (!payload.packageId || !payload.dataUrl) {
    return { ok: false, code: 'incomplete_payload', message: 'The extension import is missing the package or image data.' }
  }
  if (!profile?.id) {
    return { ok: false, code: 'signed_out', message: 'Sign in to the same account that opened the generation session, then retry the import.' }
  }

  const ownerId = payload.ownerId || payload.accountId || ''
  if (ownerId && ownerId !== profile.id) {
    const owner = payload.ownerName || payload.ownerEmail || ownerId
    return {
      ok: false,
      code: 'owner_mismatch',
      expectedOwnerId: ownerId,
      message: `This image belongs to ${owner}. You are signed in as ${profileLabel(profile)}.`,
    }
  }

  const pack = (packages || []).find(item => item.id === payload.packageId)
  if (!pack) {
    return {
      ok: false,
      code: 'package_missing',
      message: `The package "${payload.packageName || payload.packageId}" was not found in ${profileLabel(profile)}.`,
    }
  }

  if (pack.ownerId && pack.ownerId !== profile.id) {
    return {
      ok: false,
      code: 'package_owner_mismatch',
      expectedOwnerId: pack.ownerId,
      message: `The package "${pack.name}" belongs to a different account.`,
    }
  }

  return { ok: true, pack }
}
