import test from 'node:test'
import assert from 'node:assert/strict'
import {
  __testing,
  buildMarketingAssetRequestCandidates,
  createPackageMarketingAsset,
  selectPackageImagesForMarketingAsset,
} from '../src/utils/higgsfieldMarketingAssets.js'

function installLocalStorage(seed = {}) {
  const values = new Map(Object.entries(seed))
  globalThis.localStorage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  }
  return values
}

test('selects one preferred portrait image for avatar assets', () => {
  const pack = {
    type: 'avatar',
    items: [
      { id: 'style', mode: 'style_sheet', url: 'data:image/png;base64,style' },
      { id: 'hero', mode: 'main_portrait', url: 'data:image/png;base64,hero' },
      { id: 'empty', mode: 'detail' },
    ],
  }

  assert.deepEqual(selectPackageImagesForMarketingAsset(pack).map(item => item.id), ['hero'])
})

test('selects up to eight images for product assets', () => {
  const pack = {
    type: 'product',
    items: Array.from({ length: 10 }, (_, index) => ({
      id: `img_${index}`,
      url: `data:image/png;base64,${index}`,
    })),
  }

  assert.equal(selectPackageImagesForMarketingAsset(pack).length, 8)
  assert.deepEqual(selectPackageImagesForMarketingAsset(pack).map(item => item.id), [
    'img_0',
    'img_1',
    'img_2',
    'img_3',
    'img_4',
    'img_5',
    'img_6',
    'img_7',
  ])
})

test('builds Marketing Studio product create candidates with uploaded image ids', () => {
  const [primary] = buildMarketingAssetRequestCandidates(
    { type: 'product', name: 'Glow Serum', notes: 'Glass bottle' },
    [{ id: 'up_1', publicUrl: 'https://cdn.example.com/up_1.png' }, { id: 'up_2' }]
  )

  assert.equal(primary.path, '/developer/v1alpha/marketing-studio/products')
  assert.deepEqual(primary.body, {
    title: 'Glow Serum',
    description: 'Glass bottle',
    image: ['up_1', 'up_2'],
  })
})

test('builds Marketing Studio avatar create candidates with upload id and public URL', () => {
  const [primary] = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    [{ id: 'up_avatar', publicUrl: 'https://cdn.example.com/avatar.png' }]
  )

  assert.equal(primary.path, '/developer/v1alpha/marketing-studio/avatars')
  assert.deepEqual(primary.body, {
    name: 'Camila',
    image: 'up_avatar',
    image_url: 'https://cdn.example.com/avatar.png',
  })
})

test('keeps avatar upload id fallback when no public URL is available', () => {
  const candidates = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    ['up_avatar']
  )

  assert.deepEqual(candidates[0].body, {
    name: 'Camila',
    image: 'up_avatar',
  })
})

test('formats structured Higgsfield validation errors without object placeholders', () => {
  const message = __testing.readableApiError(422, {
    detail: [{ loc: ['body', 'image_url'], msg: 'Field required', type: 'missing' }],
  })

  assert.equal(message, 'Higgsfield asset API error 422: body.image_url: Field required')
  assert.equal(message.includes('[object Object]'), false)
})

test('extracts public media URLs while ignoring signed upload URLs', () => {
  const publicUrl = __testing.findPublicMediaUrl({
    upload_url: 'https://bucket.s3.amazonaws.com/upload?X-Amz-Signature=abc',
    media: { url: 'https://d8j0ntlcm91z4.cloudfront.net/user/file.webp' },
  })

  assert.equal(publicUrl, 'https://d8j0ntlcm91z4.cloudfront.net/user/file.webp')
})

test('stops avatar asset creation when Higgsfield upload returns no public image URL', async () => {
  installLocalStorage({
    hf_access_token: 'token_1',
    hf_workspace_id: 'workspace_1',
  })
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url)
    calls.push(href)
    if (href.startsWith('data:')) {
      return {
        ok: true,
        blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
      }
    }
    if (href.startsWith('https://upload.example.com')) {
      return { ok: true, status: 200 }
    }
    if (href.includes('/confirm')) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'media_1', status: 'complete' }),
      }
    }
    assert.equal(options.headers['X-Fnf-Workspace-Id'], 'workspace_1')
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        id: 'media_1',
        upload_url: 'https://upload.example.com/file?X-Amz-Signature=abc',
      }),
    }
  }

  await assert.rejects(
    () => createPackageMarketingAsset({
      type: 'avatar',
      name: 'No Public Url',
      items: [{ id: 'hero', mode: 'main_portrait', url: 'data:image/png;base64,abcd' }],
    }),
    /did not return the public image URL/
  )
  assert.equal(calls.some(url => url.includes('/marketing-studio/avatars')), false)
})
