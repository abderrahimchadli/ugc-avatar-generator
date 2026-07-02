import { LOCATIONS } from './photoStudioPrompt.js'

export const WEEKLY_JOBS_STORAGE_KEY = 'ugc_weekly_jobs_v1'

export const WEEKLY_JOB_LOCATION_DETAILS = {
  'coffee-shop': 'Casual table or counter scene for testimonial, product reveal, or daily routine ads.',
  'city-street': 'Outdoor walking scene for social proof, lifestyle hooks, and street-style product use.',
  beach: 'Bright outdoor lifestyle scene for wellness, travel, beauty, and relaxed product stories.',
  rooftop: 'Premium city backdrop for launch, status, fashion, and founder-style UGC.',
  bedroom: 'Personal room setup for try-on, morning routine, unboxing, or personal recommendation ads.',
  bathroom: 'Mirror or vanity setup for beauty, skincare, hair, and before-after style ads.',
  mall: 'Shopping environment for retail, fashion, accessories, and impulse-buy concepts.',
  gym: 'Fitness or active scene for supplements, sportswear, health, and routine-based ads.',
  park: 'Natural outdoor scene for family, wellness, pets, food, and everyday lifestyle ads.',
  restaurant: 'Dining context for food, drinks, hospitality, fashion, and social lifestyle ads.',
  hotel: 'Travel or premium room setting for lifestyle, beauty, luggage, and aspirational UGC.',
  studio: 'Controlled clean setup for reference capture, product demo, or direct response ad reads.',
}

export const WEEKLY_VIDEO_FORMATS = [
  { id: 'ugc-ad', label: 'UGC ad', description: 'Hook, proof, product use, and CTA in one short vertical ad.' },
  { id: 'product-demo', label: 'Product demo', description: 'Show the product clearly with hands, scale, and use case.' },
  { id: 'testimonial', label: 'Testimonial', description: 'Avatar speaks naturally about the problem, result, and reason to trust.' },
  { id: 'unboxing', label: 'Unboxing', description: 'Package reveal, first impression, product closeups, and honest reaction.' },
]

export function getWeeklyLocations() {
  return LOCATIONS.map(location => ({
    ...location,
    description: WEEKLY_JOB_LOCATION_DETAILS[location.id] || 'Reusable UGC location reference.',
  }))
}

export function startOfISOWeek(input = new Date()) {
  const date = parseDate(input)
  const day = date.getDay() || 7
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - day + 1)
  return toISODate(date)
}

export function addDaysISO(isoDate, days) {
  const date = parseDate(isoDate)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export function formatWeekRange(weekStart) {
  return `${weekStart} to ${addDaysISO(weekStart, 6)}`
}

export function createWeeklyJob(input = {}) {
  const now = input.now || Date.now()
  const weekStart = startOfISOWeek(input.weekStart || now)
  return {
    id: input.id || uid('week'),
    title: cleanText(input.title) || `UGC job - ${formatWeekRange(weekStart)}`,
    weekStart,
    avatarPackageId: input.avatarPackageId || '',
    productPackageId: input.productPackageId || '',
    locationId: input.locationId || 'studio',
    videoFormat: input.videoFormat || 'ugc-ad',
    videoBrief: cleanText(input.videoBrief),
    notes: cleanText(input.notes),
    status: input.status || 'draft',
    createdAt: now,
    updatedAt: now,
  }
}

export function updateWeeklyJob(job, patch = {}) {
  return {
    ...job,
    ...patch,
    title: patch.title !== undefined ? cleanText(patch.title) : job.title,
    videoBrief: patch.videoBrief !== undefined ? cleanText(patch.videoBrief) : job.videoBrief,
    notes: patch.notes !== undefined ? cleanText(patch.notes) : job.notes,
    updatedAt: patch.updatedAt || Date.now(),
  }
}

export function getWeeklyJobReferences(job, packages = []) {
  const avatarPackage = packages.find(pack => pack.id === job.avatarPackageId && pack.type === 'avatar') || null
  const productPackage = packages.find(pack => pack.id === job.productPackageId && pack.type === 'product') || null
  const location = getWeeklyLocations().find(item => item.id === job.locationId) || null
  const videoFormat = WEEKLY_VIDEO_FORMATS.find(item => item.id === job.videoFormat) || WEEKLY_VIDEO_FORMATS[0]
  return {
    avatarPackage,
    productPackage,
    location,
    videoFormat,
    avatarImages: imagesFromPackage(avatarPackage),
    productImages: imagesFromPackage(productPackage),
    locationImages: imagesFromLocation(job),
  }
}

export function getWeeklyJobVideoReferences(job, packages = [], options = {}) {
  const avatarLimit = options.avatarLimit ?? 2
  const productLimit = options.productLimit ?? 2
  const locationLimit = options.locationLimit ?? 1
  const refs = getWeeklyJobReferences(job, packages)
  const selected = [
    ...refs.avatarImages.slice(0, avatarLimit).map((item, index) => videoReferenceFromItem(item, refs.avatarPackage, 'avatar', index)),
    ...refs.productImages.slice(0, productLimit).map((item, index) => videoReferenceFromItem(item, refs.productPackage, 'product', index)),
    ...refs.locationImages.slice(0, locationLimit).map((item, index) => videoReferenceFromItem(item, null, 'location', index)),
  ].filter(item => item.url)

  return selected.map((item, index) => ({
    ...item,
    refTag: `@image_${index + 1}`,
  }))
}

export function getWeeklyJobChecklist(job, packages = []) {
  const refs = getWeeklyJobReferences(job, packages)
  return [
    { id: 'avatar-package', label: 'Avatar package selected', done: Boolean(refs.avatarPackage) },
    { id: 'avatar-images', label: 'Avatar has reference images', done: refs.avatarImages.length > 0 },
    { id: 'product-package', label: 'Product package selected', done: Boolean(refs.productPackage) },
    { id: 'product-images', label: 'Product has reference images', done: refs.productImages.length > 0 },
    { id: 'location', label: 'Location selected', done: Boolean(refs.location) },
    { id: 'video-brief', label: 'Video brief written', done: Boolean(job.videoBrief?.trim()) },
  ]
}

export function isWeeklyJobReady(job, packages = []) {
  return getWeeklyJobChecklist(job, packages).every(item => item.done)
}

export function buildWeeklyJobVideoPrompt(job, packages = []) {
  const refs = getWeeklyJobReferences(job, packages)
  const avatarName = refs.avatarPackage?.name || 'selected avatar'
  const productName = refs.productPackage?.name || 'selected product'
  const locationLabel = refs.location?.label || 'selected UGC location'
  const formatLabel = refs.videoFormat?.label || 'UGC ad'
  const avatarLock = refs.avatarPackage?.identityLock || `${avatarName} must keep the same face, body proportions, hair, and recognizable identity across the whole video.`
  const productLock = refs.productPackage?.identityLock || refs.productPackage?.notes || `${productName} must stay visually consistent, readable, and correctly scaled.`

  return [
    `Weekly UGC job: ${job.title}`,
    `Week: ${formatWeekRange(job.weekStart)}`,
    `Format: ${formatLabel}`,
    '',
    `Avatar reference: ${avatarName}`,
    `Avatar lock: ${avatarLock}`,
    `Product reference: ${productName}`,
    `Product lock: ${productLock}`,
    `Location: ${locationLabel}. ${refs.location?.description || ''}`,
    '',
    `Video brief: ${job.videoBrief || 'Create a short vertical UGC ad using the avatar, product, and location references.'}`,
    '',
    'Shot plan: start with a strong first-frame hook, show the product clearly in the avatar hands or environment, include one close product detail, one natural reaction, and end with a direct call to action.',
    'Style: realistic social video, handheld phone feel, believable lighting, no random people, no logos unless provided, no watermark, clean face and product continuity.',
  ].filter(Boolean).join('\n')
}

export function buildWeeklyJobSeedancePrompt(job, packages = []) {
  const refs = getWeeklyJobReferences(job, packages)
  const videoRefs = getWeeklyJobVideoReferences(job, packages)
  const avatarName = refs.avatarPackage?.name || 'selected avatar'
  const productName = refs.productPackage?.name || 'selected product'
  const formatLabel = refs.videoFormat?.label || 'UGC ad'
  const locationLabel = refs.location?.label || 'selected UGC location'
  const avatarTags = videoRefs.filter(ref => ref.role === 'avatar').map(ref => ref.refTag).join(', ')
  const productTags = videoRefs.filter(ref => ref.role === 'product').map(ref => ref.refTag).join(', ')
  const locationTags = videoRefs.filter(ref => ref.role === 'location').map(ref => ref.refTag).join(', ')
  const referenceLines = videoRefs.map(ref => (
    `${ref.refTag} = ${referenceRoleLabel(ref.role)} reference from "${ref.packageName}". Use only for that role.`
  ))

  return [
    `Seedance 2.0 vertical UGC ad for "${job.title}".`,
    `Format: ${formatLabel}. Aspect ratio: 9:16. Duration target: 8 seconds.`,
    '',
    referenceLines.length ? 'References:' : '',
    ...referenceLines,
    '',
    `Avatar: ${avatarTags || avatarName}. Keep ${avatarName}'s face, hair, body proportions, skin tone, and recognizable identity stable in every frame.`,
    `Product: ${productTags || productName}. Keep ${productName}'s shape, color, scale, label position, and materials stable in every frame.`,
    `Location: ${locationTags || locationLabel}. ${refs.location?.description || ''}`,
    '',
    `Brief: ${job.videoBrief || 'Create a short vertical UGC ad using the avatar, product, and location references.'}`,
    'Action: open on a clear hook, show the avatar naturally using or holding the product, include one close product detail, one authentic reaction, and finish with a direct CTA.',
    'Camera: handheld phone video, eye-level, realistic lighting, natural micro-movement, clean continuity between shots.',
    'Delivery: believable UGC performance, one clear action per shot, no music, no captions, no text overlays, no watermark, no random extra people.',
    'Ending: hold a clean final pose with the product visible for the last beat.',
  ].filter(Boolean).join('\n')
}

export function groupWeeklyJobsByWeek(jobs = []) {
  const sorted = sortWeeklyJobs(jobs)
  return sorted.reduce((groups, job) => {
    const key = job.weekStart || startOfISOWeek(job.createdAt || Date.now())
    const existing = groups.find(group => group.weekStart === key)
    if (existing) {
      existing.jobs.push(job)
    } else {
      groups.push({ weekStart: key, label: formatWeekRange(key), jobs: [job] })
    }
    return groups
  }, [])
}

export function sortWeeklyJobs(jobs = []) {
  return [...jobs].sort((a, b) => {
    if ((a.weekStart || '') !== (b.weekStart || '')) return (b.weekStart || '').localeCompare(a.weekStart || '')
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })
}

export function mergeWeeklyJobLists(serverJobs = [], localJobs = []) {
  const byId = new Map()
  for (const job of localJobs || []) {
    if (job?.id) byId.set(job.id, job)
  }
  for (const job of serverJobs || []) {
    if (!job?.id) continue
    const existing = byId.get(job.id)
    if (!existing || (job.updatedAt || 0) >= (existing.updatedAt || 0)) byId.set(job.id, job)
  }
  return sortWeeklyJobs([...byId.values()])
}

export function storageKeyForWeeklyJobs(profile) {
  return profile?.id ? `${WEEKLY_JOBS_STORAGE_KEY}:${profile.id}` : `${WEEKLY_JOBS_STORAGE_KEY}:signed-out`
}

function imagesFromPackage(pack) {
  if (!pack) return []
  return (pack.items || []).filter(item => item.url || item.dataUrl)
}

function imagesFromLocation(job) {
  const items = Array.isArray(job.locationImages)
    ? job.locationImages
    : job.locationReference
      ? [job.locationReference]
      : []
  return items.filter(item => item.url || item.dataUrl)
}

function videoReferenceFromItem(item, pack, role, index) {
  return {
    id: item.id || `${role}_${index}`,
    url: item.url || item.dataUrl || '',
    label: item.label || `${pack?.name || role} reference ${index + 1}`,
    role,
    packageId: pack?.id || '',
    packageName: pack?.name || item.packageName || item.label || role,
  }
}

function referenceRoleLabel(role) {
  if (role === 'avatar') return 'avatar identity'
  if (role === 'product') return 'product'
  if (role === 'location') return 'environment/location'
  return role
}

function cleanText(value) {
  return String(value || '').trim()
}

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseDate(input) {
  if (input instanceof Date) return new Date(input.getTime())
  if (typeof input === 'number') return new Date(input)
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T12:00:00`)
  return new Date(input || Date.now())
}

function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
