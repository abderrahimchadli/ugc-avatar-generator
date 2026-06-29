import test from 'node:test'
import assert from 'node:assert/strict'
import {
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
    ['up_1', 'up_2']
  )

  assert.equal(primary.path, '/developer/v1alpha/marketing-studio/products')
  assert.deepEqual(primary.body, {
    title: 'Glow Serum',
    description: 'Glass bottle',
    images: ['up_1', 'up_2'],
  })
})

test('builds Marketing Studio avatar create candidates with pinned uploaded image', () => {
  const [primary] = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    ['up_avatar']
  )

  assert.equal(primary.path, '/developer/v1alpha/marketing-studio/avatars')
  assert.deepEqual(primary.body, {
    name: 'Camila',
    image: 'up_avatar',
    pinned: true,
  })
})
