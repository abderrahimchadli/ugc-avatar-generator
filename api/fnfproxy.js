import { rateLimit, clientIp } from '../lib/rateLimit.js'

export const config = { runtime: 'edge' }

const ALLOWED_PATH_PREFIXES = [
  '/developer/v1alpha/',
  '/developer/v2alpha/',
]

function isAllowedPath(path) {
  return ALLOWED_PATH_PREFIXES.some(p => path.startsWith(p))
}

export default async function handler(req) {
  const url = new URL(req.url)
  let path = '/' + (url.searchParams.get('__fnfpath') || '').replace(/^\/+/, '')
  url.searchParams.delete('__fnfpath')
  const qs = url.searchParams.toString()
  const search = qs ? `?${qs}` : ''

  if (!isAllowedPath(path)) {
    return new Response('Not found', { status: 404 })
  }

  const target = `https://fnf-api-gw.higgsfield.ai/fnf${path}${search}`
  const origin = req.headers.get('origin') || '*'
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type, accept, x-idempotency-key, x-fnf-workspace-id',
    'Access-Control-Allow-Credentials': 'true',
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const rl = rateLimit(clientIp(req.headers))
  if (!rl.ok) {
    return new Response('Too many requests - slow down a moment and try again.', {
      status: 429,
      headers: { ...corsHeaders, 'Retry-After': String(rl.retryAfter) },
    })
  }

  const forward = new Headers()
  for (const [k, v] of req.headers.entries()) {
    if (k === 'host') continue
    forward.set(k, v)
  }

  const upstream = await fetch(target, {
    method: req.method,
    headers: forward,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
  })

  const respHeaders = new Headers(corsHeaders)
  for (const [k, v] of upstream.headers.entries()) {
    if (['content-encoding', 'transfer-encoding', 'connection'].includes(k)) continue
    respHeaders.set(k, v)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}
