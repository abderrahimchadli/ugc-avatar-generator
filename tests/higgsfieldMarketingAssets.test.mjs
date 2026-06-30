import test from 'node:test'
import assert from 'node:assert/strict'
import {
  __testing,
  buildMarketingAssetRequestCandidates,
  selectPackageImagesForMarketingAsset,
} from '../src/utils/higgsfieldMarketingAssets.js'

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
