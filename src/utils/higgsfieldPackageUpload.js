import { initSession, uploadRefImage } from './higgsfieldGenerate'

export const HIGGSFIELD_REFERENCE_NOTE = 'Prepared as Higgsfield reference media for generation. Higgsfield may not show this media in the website library.'

export async function uploadPackageToHiggsfield(pack, onProgress) {
  const items = (pack.items || []).filter(item => item.url && !item.higgsfield?.url)
  if (!items.length) return []

  await initSession()
  const results = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    onProgress?.({ index: i + 1, total: items.length, item })
    const url = await uploadRefImage(item.url)
    results.push({
      itemId: item.id,
      higgsfield: {
        url,
        uploadedAt: Date.now(),
        kind: 'reference_media',
        visibleInLibrary: false,
        note: HIGGSFIELD_REFERENCE_NOTE,
      },
    })
  }
  return results
}
