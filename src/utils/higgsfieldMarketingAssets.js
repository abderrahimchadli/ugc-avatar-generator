import { getHFToken } from './higgsfieldAuth.js'
import {
  callHiggsfieldTool,
  initSession,
  uploadMediaDetails,
  unwrapHiggsfieldMCP,
} from './higgsfieldGenerate.js'

const MAX_PRODUCT_IMAGES = 8
const MAX_AVATAR_IMAGES = 4

export const HIGGSFIELD_ASSET_NOTE = 'Created as a Higgsfield Marketing Studio asset for reuse in Higgsfield ad and video workflows.'
export const HIGGSFIELD_MEDIA_NOTE = 'Uploaded to Higgsfield media storage. This proves the image reached Higgsfield API storage, but it is not the same as a visible Marketing Studio asset.'

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

export async function uploadMarketingImage(dataUrl, { packageName = 'package', index = 1 } = {}) {
  if (!getHFToken()) {
    throw new Error('Connect Higgsfield in Settings first. A Higgsfield website login in Chrome does not give this app an API token.')
  }
  const details = await uploadMediaDetails(dataUrl, {
    type: 'image',
    defaultContentType: 'image/jpeg',
    getExt: contentTypeToExt,
    prefix: `${safeName(packageName)}_${index}`,
  })
  return {
    id: details.id,
    publicUrl: details.publicUrl || '',
    contentType: details.contentType || 'image/jpeg',
    sizeBytes: details.sizeBytes || 0,
    confirmation: details,
  }
}

export function selectPackageImagesForMarketingAsset(pack) {
  const items = (pack?.items || []).filter(item => item?.url)
  if (pack?.type === 'avatar') {
    return [...items]
      .sort((a, b) => {
        const aPreferred = /main|portrait|hero|face/i.test(`${a.mode || ''} ${a.label || ''}`) ? 0 : 1
        const bPreferred = /main|portrait|hero|face/i.test(`${b.mode || ''} ${b.label || ''}`) ? 0 : 1
        return aPreferred - bPreferred
      })
      .slice(0, MAX_AVATAR_IMAGES)
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
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'product', title: name, description, medias: uploadIds } },
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'product', title: name, description, images: uploadIds } },
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'product', title: name, description, image: uploadIds } },
    ]
  }
  const uploadsWithUrl = uploads.filter(upload => upload.publicUrl || upload.url)
  const avatarObjects = uploadsWithUrl.map(upload => ({
    id: upload.id,
    type: 'custom',
    image_url: upload.publicUrl || upload.url,
  }))
  const firstUploadWithUrl = uploadsWithUrl[0]
  const candidates = []
  if (avatarObjects.length) {
    candidates.push(
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', name, avatars: avatarObjects } },
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', title: name, avatars: avatarObjects } },
    )
  }
  if (firstUploadWithUrl) {
    const imageUrl = firstUploadWithUrl.publicUrl || firstUploadWithUrl.url
    candidates.push(
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', name, image: firstUploadWithUrl.id, image_url: imageUrl } },
      { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', title: name, image: firstUploadWithUrl.id, image_url: imageUrl } },
    )
  }
  candidates.push(
    { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', name, avatars: uploadIds } },
    { tool: 'show_marketing_studio', args: { action: 'create', type: 'avatar', title: name, avatars: uploadIds } },
  )
  return candidates
}

function extractAssetId(value, seen = new WeakSet()) {
  if (!value) return ''
  if (typeof value === 'string') {
    const uuid = value.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    return uuid?.[0] || ''
  }
  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractAssetId(item, seen)
      if (found) return found
    }
    return ''
  }

  for (const key of ['id', 'uuid', 'asset_id', 'assetId', 'product_id', 'productId', 'avatar_id', 'avatarId']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }

  for (const key of ['data', 'result', 'results', 'asset', 'avatar', 'product', 'item']) {
    const found = extractAssetId(value[key], seen)
    if (found) return found
  }

  for (const nested of Object.values(value)) {
    const found = extractAssetId(nested, seen)
    if (found) return found
  }
  return ''
}

function mcpErrorText(result, data) {
  if (result?.isError) {
    const text = result.content?.map(item => item.text).filter(Boolean).join('; ')
    return text || 'Higgsfield returned an MCP error.'
  }
  if (typeof data === 'string' && /error|invalid|missing|required|requires|request id/i.test(data)) return data
  if (data?.error) return typeof data.error === 'string' ? data.error : formatApiErrorValue(data.error)
  if (data?.message && /error|invalid|missing|required|requires|request id/i.test(String(data.message))) return String(data.message)
  if (data?.detail) return formatApiErrorValue(data.detail)
  return ''
}

async function callFirstMarketingStudioCandidate(candidates) {
  await initSession()
  let lastError = null
  for (const candidate of candidates) {
    try {
      const result = await callHiggsfieldTool(candidate.tool, candidate.args)
      const data = unwrapHiggsfieldMCP(result)
      const errorText = mcpErrorText(result, data)
      if (errorText) throw new Error(errorText)
      const id = extractAssetId(data)
      if (!id) throw new Error(`Higgsfield did not return a Marketing Studio asset id. Response: ${JSON.stringify(data)?.slice(0, 220)}`)
      return { data, id }
    } catch (error) {
      lastError = error
      if (!/unknown tool|invalid|missing|required|requires|not found|validation|field|did not return|create failed|request id/i.test(error.message || '')) throw error
    }
  }
  throw lastError || new Error('Higgsfield Marketing Studio asset request failed.')
}

function buildHiggsfieldMediaRecord(uploads, selectedItems) {
  return {
    label: 'Higgsfield media uploads',
    type: 'higgsfield_media',
    visibleInHiggsfieldAssets: false,
    createdAt: Date.now(),
    uploadIds: uploads.map(upload => upload.id),
    itemIds: selectedItems.map(item => item.id),
    items: uploads.map((upload, index) => ({
      id: upload.id,
      publicUrl: upload.publicUrl || '',
      contentType: upload.contentType || '',
      sizeBytes: upload.sizeBytes || 0,
      sourceItemId: selectedItems[index]?.id || '',
    })),
    note: HIGGSFIELD_MEDIA_NOTE,
  }
}

function normalizeCreatedAsset(pack, data, uploads, selectedItems) {
  const root = data?.data || data?.avatar || data?.product || data
  const id = extractAssetId(root) || extractAssetId(data)
  if (!id) throw new Error('Higgsfield created the asset but did not return an asset id.')
  const media = buildHiggsfieldMediaRecord(uploads, selectedItems)
  return {
    id,
    type: pack.type === 'product' ? 'marketing_product' : 'marketing_avatar',
    label: pack.type === 'product' ? 'Marketing Studio product' : 'Marketing Studio avatar',
    visibleInHiggsfield: true,
    createdAt: Date.now(),
    uploadIds: media.uploadIds,
    itemIds: media.itemIds,
    media,
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

  const higgsfieldMedia = buildHiggsfieldMediaRecord(uploads, selectedItems)
  onProgress?.({ phase: 'asset', index: uploads.length, total: uploads.length })
  try {
    const { data } = await callFirstMarketingStudioCandidate(buildMarketingAssetRequestCandidates(pack, uploads))
    return normalizeCreatedAsset(pack, data, uploads, selectedItems)
  } catch (error) {
    error.higgsfieldMedia = higgsfieldMedia
    throw error
  }
}

export const __testing = {
  buildHiggsfieldMediaRecord,
  extractAssetId,
  readableApiError,
  findPublicMediaUrl,
}
