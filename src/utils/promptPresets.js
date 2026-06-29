export const AVATAR_MODES = [
  { id: 'main_portrait', label: 'Main portrait' },
  { id: 'full_body', label: 'Full body' },
  { id: 'face_closeups', label: 'Face closeups' },
  { id: 'pose_sheet', label: 'Pose sheet' },
  { id: 'expression_sheet', label: 'Expression sheet' },
  { id: 'realistic_style_sheet', label: 'Realistic style sheet' },
  { id: 'animation_style_sheet', label: 'Animation style sheet' },
]

export const PRODUCT_MODES = [
  { id: 'packshot', label: 'Packshot' },
  { id: 'detail_shot', label: 'Detail shot' },
  { id: 'lifestyle_shot', label: 'Lifestyle shot' },
  { id: 'product_style_sheet', label: 'Product style sheet' },
  { id: 'avatar_holding_product', label: 'Avatar holding product' },
]

const avatarModeCopy = {
  main_portrait: 'Create one hero portrait for this avatar, camera-facing but natural, with clear face geometry and realistic skin detail.',
  full_body: 'Create a full-body reference image, neutral standing pose, clean readable outfit silhouette, consistent face and body proportions.',
  face_closeups: 'Create a 4-panel face closeup sheet: front, 3/4 left, 3/4 right, and soft candid expression. Preserve identity in every panel.',
  pose_sheet: 'Create a pose sheet with 6 clean poses for future reference: standing, walking, sitting, holding object, looking back, casual selfie stance.',
  expression_sheet: 'Create an expression sheet with 8 expressions: neutral, soft smile, laugh, serious, surprised, thoughtful, confident, candid mid-speech.',
  realistic_style_sheet: 'Create a realistic UGC style sheet: phone-camera lighting, natural pores, honest asymmetry, lived-in hair, no beauty-filter polish.',
  animation_style_sheet: 'Create an animation style sheet preserving the same identity, hair silhouette, face geometry, body proportions, and outfit language.',
}

const productModeCopy = {
  packshot: 'Create a clean product packshot on a simple surface with readable shape, material, cap/label structure, and accurate proportions.',
  detail_shot: 'Create macro/detail product shots showing texture, materials, label edges, reflections, packaging seams, and scale cues.',
  lifestyle_shot: 'Create a lifestyle product image in a natural UGC setting with believable light, hand placement, and real-world context.',
  product_style_sheet: 'Create a product style sheet: front, side, detail, in-hand scale, lifestyle context, and clean reference angle.',
  avatar_holding_product: 'Create a realistic UGC still where the selected avatar naturally holds or uses the product. Preserve avatar and product identity.',
}

export function buildPrompt({ pack, mode, style = 'realistic', productPack = null, extra = '' }) {
  const isAvatar = pack?.type === 'avatar'
  const instruction = isAvatar ? avatarModeCopy[mode] : productModeCopy[mode]
  const identity = pack?.identityLock?.trim() || `${pack?.name} identity must stay consistent across every generated image.`
  const styleLock = pack?.styleLock?.trim() || 'Use high-quality, coherent reference-sheet composition with no random extra people or logos.'
  const product = productPack ? `\nProduct reference: ${productPack.name}. ${productPack.identityLock || productPack.notes || ''}` : ''

  return [
    `Package name: ${pack?.name}`,
    `Mode: ${mode}`,
    `Style: ${style}`,
    '',
    instruction,
    '',
    `Identity lock: ${identity}`,
    `Style lock: ${styleLock}`,
    product,
    extra ? `Extra user direction: ${extra}` : '',
    '',
    'Output requirements: clean image, no watermark, no text unless requested, consistent subject identity, suitable as a reusable reference for future image or video generation.',
  ].filter(Boolean).join('\n')
}

export function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`
}

