import { getHFToken, getHFWorkspaceId, refreshHFToken } from './higgsfieldAuth.js'

const FNF_PROXY = '/api/fnf'
const MAX_PRODUCT_IMAGES = 8

export const HIGGSFIELD_ASSET_NOTE = 'Created as a Higgsfield Marketing Studio asset for reuse in Higgsfield ad and video workflows.'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function safeName(value, fallback = 'package') {
  const cleaned = String(value || fallback)
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return cleaned || fallback
}

function contentTypeToExt(contentType) {
  if (/png/i.test(contentType)) return 'png'
  if (/webp/i.test(contentType)) return 'webp'
  if (/gif/i.test(contentType)) return 'gif'
  return 'jpg'
}

function parseResponseText(text) {
  if (!text) return null
  try { return JSON.parse(text) } catch { return text }
}

function formatApiErrorValue(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(formatApiErrorValue).filter(Boolean).join('; ')
  if (typeof value !== 'object') return String(value)

  const loc = Array.isArray(value.loc)
    ? value.loc.join('.')
    : value.field || value.path || value.param || value.parameter || ''
  const msg = value.msg || value.message || value.reason || value.error_description
    || (typeof value.error === 'string' ? value.error : '')
  if (msg) return loc ? `${loc}: ${msg}` : String(msg)

  return Object.entries(value)
    .map(([key, nested]) => {
      const formatted = formatApiErrorValue(nested)
      return formatted ? `${key}: ${formatted}` : ''
    })
    .filter(Boolean)
    .join('; ')
}

function readableApiError(status, data, fallback = '') {
  const text = typeof data === 'string'
    ? data
    : data?.error_description
      || (typeof data?.error === 'string' ? data.error : data?.error?.message)
      || data?.message
      || formatApiErrorValue(data?.detail)
      || formatApiErrorValue(data?.errors)
      || formatApiErrorValue(data)
      || fallback
  const suffix = text ? `: ${String(text).slice(0, 240)}` : ''
  return `Higgsfield asset API error ${status}${suffix}`
}

function makeApiError(status, data, fallback = '') {
  const error = new Error(readableApiError(status, data, fallback))
  error.status = status
  error.data = data
  return error
}

async function fnfRequest(path, { method = 'GET', body = null, headers = {} } = {}, isRetry = false) {
  const token = getHFToken()
  const workspaceId = getHFWorkspaceId()
  if (!workspaceId) {
    throw new Error('Higgsfield workspace is missing. Reconnect Higgsfield in Settings, then try creating the asset again.')
  }
  const requestHeaders = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Fnf-Workspace-Id': workspaceId,
    ...headers,
  }
  let requestBody = body
  if (body && !(body instanceof Blob) && typeof body !== 'string') {
    requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json'
    requestBody = JSON.stringify(body)
  }

  const res = await fetch(`${FNF_PROXY}${path}`, {
    method,
    headers: requestHeaders,
    body: requestBody,
  })

  if (res.status === 401 && !isRetry) {
    await refreshHFToken()
    return fnfRequest(path, { method, body, headers }, true)
  }

  const text = await res.text().catch(() => '')
  const data = parseResponseText(text)
  if (!res.ok) throw makeApiError(res.status, data, text)
  return data
}

async function postFirstSuccessful(candidates) {
  let lastError = null
  for (const candidate of candidates) {
    try {
      return await fnfRequest(candidate.path, {
        method: candidate.method || 'POST',
        body: candidate.body,
      })
    } catch (error) {
      lastError = error
      if (![400, 404, 415, 422].includes(error.status)) throw error
    }
  }
  throw lastError || new Error('Higgsfield asset request failed.')
}

function extractUploadSlot(data) {
  const slot = Array.isArray(data)
    ? data[0]
    : data?.upload || data?.media || data?.slot || data?.data || data
  const id = slot?.id || slot?.media_id || slot?.mediaId || data?.id
  const uploadUrl = slot?.upload_url || slot?.uploadUrl || slot?.signed_url || slot?.signedUrl
    || slot?.put_url || slot?.putUrl || slot?.presigned_url || slot?.presignedUrl
    || data?.upload_url || data?.uploadUrl || slot?.url
  if (!id || !uploadUrl) {
    throw new Error('Higgsfield did not return a usable upload slot.')
  }
  return {
    id,
    uploadUrl,
    publicUrl: findPublicMediaUrl(slot) || findPublicMediaUrl(data),
  }
}

function looksLikePublicMediaUrl(value) {
  if (!/^https?:\/\//i.test(String(value || ''))) return false
  try {
    const url = new URL(value)
    const raw = String(value)
    if (/[?&](x-amz-|signature|expires|credential|policy)/i.test(raw)) return false
    if (/amazonaws\.com|googleapis\.com|blob\.core\.windows\.net/i.test(url.hostname) && url.search) return false
    return true
  } catch {
    return false
  }
}

function findPublicMediaUrl(value, seen = new WeakSet()) {
  if (!value) return ''
  if (typeof value === 'string') return looksLikePublicMediaUrl(value) ? value : ''
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  const preferredKeys = [
    'public_url',
    'publicUrl',
    'cloudfront_url',
    'cloudfrontUrl',
    'cdn_url',
    'cdnUrl',
    'asset_url',
    'assetUrl',
    'download_url',
    'downloadUrl',
    'image_url',
    'imageUrl',
    'url',
  ]
  for (const key of preferredKeys) {
    const found = findPublicMediaUrl(value[key], seen)
    if (found) return found
  }
  for (const nested of Object.values(value)) {
    const found = findPublicMediaUrl(nested, seen)
    if (found) return found
  }
  return ''
}

function mediaStatus(data) {
  return String(data?.status || data?.media?.status || data?.data?.status || '').toLowerCase()
}

async function createFnfUpload({ filename, contentType, length, type = 'image' }) {
  const query = new URLSearchParams({ type })
  const fullQuery = new URLSearchParams({
    type,
    filename,
    content_type: contentType,
    length: String(length),
  })

  const data = await postFirstSuccessful([
    {
      path: `/developer/v2alpha/media?${query}`,
      body: { filename, content_type: contentType, length },
    },
    {
      path: '/developer/v2alpha/media',
      body: { type, filename, content_type: contentType, length },
    },
    {
      path: `/developer/v2alpha/media?${fullQuery}`,
      body: null,
    },
  ])
  return extractUploadSlot(data)
}

async function confirmFnfUpload(id, type = 'image') {
  let lastData = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const query = new URLSearchParams({ type })
    const data = await postFirstSuccessful([
      { path: `/developer/v2alpha/media/${encodeURIComponent(id)}/confirm?${query}`, body: null },
      { path: `/developer/v2alpha/media/${encodeURIComponent(id)}/confirm`, body: { type } },
    ])
    lastData = data
    const status = mediaStatus(data)
    if (!status || /completed|complete|ready|usable|succeeded|success/.test(status)) return data
    await sleep(500 + attempt * 250)
  }
  const status = mediaStatus(lastData) || 'unknown'
  throw new Error(`Uploaded media ${id} is not usable yet (status ${status}).`)
}

export async function uploadMarketingImage(dataUrl, { packageName = 'package', index = 1 } = {}) {
  const res = await fetch(dataUrl)
  if (!res.ok) throw new Error(`Could not read package image (${res.status}).`)
  const blob = await res.blob()
  const contentType = blob.type || 'image/jpeg'
  const filename = `${safeName(packageName)}_${index}.${contentTypeToExt(contentType)}`
  const slot = await createFnfUpload({
    filename,
    contentType,
    length: blob.size,
    type: 'image',
  })
  const putRes = await fetch(slot.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  })
  if (!putRes.ok) throw new Error(`Higgsfield image upload failed: ${putRes.status}`)
  const confirmation = await confirmFnfUpload(slot.id, 'image')
  const publicUrl = findPublicMediaUrl(confirmation) || slot.publicUrl
  return {
    id: slot.id,
    uploadUrl: slot.uploadUrl,
    publicUrl,
    contentType,
    sizeBytes: blob.size,
    confirmation,
  }
}

export function selectPackageImagesForMarketingAsset(pack) {
  const items = (pack?.items || []).filter(item => item?.url)
  if (pack?.type === 'avatar') {
    const preferred = items.find(item => /main|portrait|hero|face/i.test(`${item.mode || ''} ${item.label || ''}`))
      || items[0]
    return preferred ? [preferred] : []
  }
  return items.slice(0, MAX_PRODUCT_IMAGES)
}

function normalizeUploads(uploadsOrIds) {
  return (uploadsOrIds || [])
    .map(upload => typeof upload === 'string' ? { id: upload } : upload)
    .filter(upload => upload?.id)
}

export function buildMarketingAssetRequestCandidates(pack, uploadsOrIds) {
  const uploads = normalizeUploads(uploadsOrIds)
  const uploadIds = uploads.map(upload => upload.id)
  const name = String(pack?.name || '').trim() || 'Untitled package'
  const description = String(pack?.notes || pack?.identityLock || pack?.styleLock || '').trim()
  if (pack?.type === 'product') {
    return [
      { path: '/developer/v1alpha/marketing-studio/products', body: { title: name, description, image: uploadIds } },
      { path: '/developer/v1alpha/marketing-studio/products', body: { title: name, description, images: uploadIds } },
      { path: '/developer/v1alpha/marketing-studio/products', body: { title: name, description, image_ids: uploadIds } },
    ]
  }
  const image = uploads[0]
  const imageId = image?.id
  const imageUrl = image?.publicUrl || image?.url || ''
  const withImageUrl = imageUrl ? [
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, image: imageId, image_url: imageUrl } },
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, image_id: imageId, image_url: imageUrl } },
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, image: imageId, imageUrl } },
  ] : []
  return [
    ...withImageUrl,
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, image: imageId } },
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, image_id: imageId } },
    { path: '/developer/v1alpha/marketing-studio/avatars', body: { name, images: [imageId] } },
  ]
}

function normalizeCreatedAsset(pack, data, uploads, selectedItems) {
  const root = data?.data || data?.avatar || data?.product || data
  const id = root?.id || data?.id || data?.uuid || data?.product_id || data?.avatar_id
  if (!id) throw new Error('Higgsfield created the asset but did not return an asset id.')
  return {
    id,
    type: pack.type === 'product' ? 'marketing_product' : 'marketing_avatar',
    label: pack.type === 'product' ? 'Marketing Studio product' : 'Marketing Studio avatar',
    visibleInHiggsfield: true,
    createdAt: Date.now(),
    uploadIds: uploads.map(upload => upload.id),
    itemIds: selectedItems.map(item => item.id),
    note: HIGGSFIELD_ASSET_NOTE,
    raw: root,
  }
}

export async function createPackageMarketingAsset(pack, onProgress) {
  const selectedItems = selectPackageImagesForMarketingAsset(pack)
  if (!selectedItems.length) throw new Error('Add at least one image before creating a Higgsfield asset.')

  const uploads = []
  for (let i = 0; i < selectedItems.length; i += 1) {
    onProgress?.({ phase: 'upload', index: i + 1, total: selectedItems.length, item: selectedItems[i] })
    uploads.push(await uploadMarketingImage(selectedItems[i].url, {
      packageName: pack.name,
      index: i + 1,
    }))
  }

  onProgress?.({ phase: 'asset', index: uploads.length, total: uploads.length })
  const data = await postFirstSuccessful(buildMarketingAssetRequestCandidates(pack, uploads))
  return normalizeCreatedAsset(pack, data, uploads, selectedItems)
}

export const __testing = {
  readableApiError,
  findPublicMediaUrl,
}
