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

test('selects up to four avatar images with preferred portrait first', () => {
  const pack = {
    type: 'avatar',
    items: [
      { id: 'style', mode: 'style_sheet', url: 'data:image/png;base64,style' },
      { id: 'hero', mode: 'main_portrait', url: 'data:image/png;base64,hero' },
      { id: 'face', label: 'Face closeup', url: 'data:image/png;base64,face' },
      { id: 'pose', mode: 'pose_sheet', url: 'data:image/png;base64,pose' },
      { id: 'extra', mode: 'detail', url: 'data:image/png;base64,extra' },
      { id: 'empty', mode: 'detail' },
    ],
  }

  assert.deepEqual(selectPackageImagesForMarketingAsset(pack).map(item => item.id), ['hero', 'face', 'style', 'pose'])
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

  assert.equal(primary.tool, 'show_marketing_studio')
  assert.deepEqual(primary.args, {
    action: 'create',
    type: 'product',
    title: 'Glow Serum',
    description: 'Glass bottle',
    medias: ['up_1', 'up_2'],
  })
})

test('builds Marketing Studio avatar create candidates with avatars array', () => {
  const [primary] = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    [{ id: 'up_avatar', publicUrl: 'https://cdn.example.com/avatar.png' }]
  )

  assert.equal(primary.tool, 'show_marketing_studio')
  assert.deepEqual(primary.args, {
    action: 'create',
    type: 'avatar',
    name: 'Camila',
    avatars: [{ id: 'up_avatar', type: 'custom', image_url: 'https://cdn.example.com/avatar.png' }],
  })
})

test('keeps avatar upload id fallback after custom object candidates', () => {
  const candidates = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    [{ id: 'up_avatar', publicUrl: 'https://cdn.example.com/avatar.png' }]
  )

  assert.deepEqual(candidates[2].args, {
    action: 'create',
    type: 'avatar',
    name: 'Camila',
    image: 'up_avatar',
    image_url: 'https://cdn.example.com/avatar.png',
  })
  assert.deepEqual(candidates[4].args, {
    action: 'create',
    type: 'avatar',
    name: 'Camila',
    avatars: ['up_avatar'],
  })
})

test('keeps avatar upload id fallback when no public URL is available', () => {
  const candidates = buildMarketingAssetRequestCandidates(
    { type: 'avatar', name: 'Camila' },
    ['up_avatar']
  )

  assert.deepEqual(candidates[0].args, {
    action: 'create',
    type: 'avatar',
    name: 'Camila',
    avatars: ['up_avatar'],
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

test('creates avatar assets through MCP without requiring a workspace id', async () => {
  installLocalStorage({
    hf_access_token: 'token_1',
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
    if (href === '/api/hf/mcp') {
      const body = JSON.parse(options.body)
      if (body.method === 'initialize') {
        return {
          ok: true,
          status: 200,
          headers: { get: name => name.toLowerCase() === 'mcp-session-id' ? 'session_1' : 'application/json' },
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'media_upload') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ text: JSON.stringify({ media_id: 'media_1', upload_url: 'https://upload.example.com/file?X-Amz-Signature=abc' }) }] },
          }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'media_confirm') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ text: JSON.stringify({ id: 'media_1', url: 'https://cdn.example.com/media_1.png' }) }] },
          }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'show_marketing_studio') {
        assert.equal(body.params.arguments.action, 'create')
        assert.equal(body.params.arguments.type, 'avatar')
        assert.deepEqual(body.params.arguments.avatars, [{
          id: 'media_1',
          type: 'custom',
          image_url: 'https://cdn.example.com/media_1.png',
        }])
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ text: JSON.stringify({ id: 'avatar_1', name: 'No Workspace Needed' }) }] },
          }),
        }
      }
    }
    return {
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => 'unexpected request',
    }
  }

  const asset = await createPackageMarketingAsset({
    type: 'avatar',
    name: 'No Workspace Needed',
    items: [{ id: 'hero', mode: 'main_portrait', url: 'data:image/png;base64,abcd' }],
  })

  assert.equal(asset.id, 'avatar_1')
  assert.equal(asset.media.uploadIds[0], 'media_1')
  assert.equal(calls.some(url => url.includes('/api/fnf')), false)
})

test('preserves uploaded media evidence when Marketing Studio creation fails', async () => {
  installLocalStorage({
    hf_access_token: 'token_1',
  })
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url)
    if (href.startsWith('data:')) {
      return {
        ok: true,
        blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
      }
    }
    if (href.startsWith('https://upload.example.com')) {
      return { ok: true, status: 200 }
    }
    if (href === '/api/hf/mcp') {
      const body = JSON.parse(options.body)
      if (body.method === 'initialize') {
        return {
          ok: true,
          status: 200,
          headers: { get: name => name.toLowerCase() === 'mcp-session-id' ? 'session_1' : 'application/json' },
          text: async () => JSON.stringify({ jsonrpc: '2.0', id: body.id, result: {} }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'media_upload') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ text: JSON.stringify({ media_id: 'media_1', upload_url: 'https://upload.example.com/file?X-Amz-Signature=abc' }) }] },
          }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'media_confirm') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { content: [{ text: JSON.stringify({ id: 'media_1', url: 'https://cdn.example.com/media_1.png' }) }] },
          }),
        }
      }
      if (body.method === 'tools/call' && body.params.name === 'show_marketing_studio') {
        return {
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({
            jsonrpc: '2.0',
            id: body.id,
            result: { isError: true, content: [{ text: 'Marketing Studio create failed' }] },
          }),
        }
      }
    }
    return {
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      text: async () => 'unexpected request',
    }
  }

  await assert.rejects(
    createPackageMarketingAsset({
      type: 'avatar',
      name: 'Failed Asset',
      items: [{ id: 'hero', mode: 'main_portrait', url: 'data:image/png;base64,abcd' }],
    }),
    error => {
      assert.equal(error.higgsfieldMedia.uploadIds[0], 'media_1')
      assert.equal(error.higgsfieldMedia.items[0].publicUrl, 'https://cdn.example.com/media_1.png')
      return true
    }
  )
})

test('extracts nested Higgsfield asset ids', () => {
  assert.equal(__testing.extractAssetId({ data: { product: { id: 'product_1' } } }), 'product_1')
  assert.equal(__testing.extractAssetId('created 11111111-2222-3333-4444-555555555555'), '11111111-2222-3333-4444-555555555555')
})
