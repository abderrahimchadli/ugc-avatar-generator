import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, formatBytes } from '../src/utils/promptPresets.js'
import { CHATGPT_IMAGES_URL, getToolUrl } from '../src/utils/toolTargets.js'

test('builds avatar prompt with package name, mode, and identity lock', () => {
  const prompt = buildPrompt({
    pack: { type: 'avatar', name: 'Camila', identityLock: 'Preserve Camila face.', styleLock: 'UGC phone style.' },
    mode: 'main_portrait',
    style: 'realistic',
  })
  assert.match(prompt, /Package name: Camila/)
  assert.match(prompt, /Mode: main_portrait/)
  assert.match(prompt, /Preserve Camila face/)
  assert.match(prompt, /UGC phone style/)
})

test('builds product prompt and optional avatar product relation', () => {
  const prompt = buildPrompt({
    pack: { type: 'product', name: 'Glow Serum', notes: 'Glass bottle.' },
    productPack: { name: 'Camila', identityLock: 'Avatar identity.' },
    mode: 'lifestyle_shot',
    style: 'product',
    extra: 'Bathroom shelf.',
  })
  assert.match(prompt, /Package name: Glow Serum/)
  assert.match(prompt, /Product reference: Camila/)
  assert.match(prompt, /Bathroom shelf/)
})

test('formats byte counts for storage UI', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(512), '512 B')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(2 * 1024 * 1024), '2.0 MB')
})

test('opens ChatGPT image generation at the Images page', () => {
  assert.equal(CHATGPT_IMAGES_URL, 'https://chatgpt.com/images')
  assert.equal(getToolUrl('chatgpt-image'), 'https://chatgpt.com/images')
  assert.equal(getToolUrl('google-flow'), 'https://labs.google/fx/tools/flow')
})
