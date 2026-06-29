export function safeReturnTo(value, fallback = '/') {
  const path = String(value || '').trim()
  if (!path || !path.startsWith('/') || path.startsWith('//')) return fallback
  if (/[\r\n]/.test(path)) return fallback
  return path
}

export function loginPathForReturn(pathname = '/', search = '') {
  const returnTo = safeReturnTo(`${pathname || '/'}${search || ''}`)
  return `/login?returnTo=${encodeURIComponent(returnTo)}`
}
