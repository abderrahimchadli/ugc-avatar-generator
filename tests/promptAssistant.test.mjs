import test from 'node:test'
import assert from 'node:assert/strict'
import { extractCodexText } from '../src/utils/charSheetPrompt.js'
import {
  DEFAULT_CODEX_MODEL,
  assistantStatusText,
  resolvePromptAssistant,
  savePromptAssistantSettings,
} from '../src/utils/promptAssistant.js'

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  }
}

test('auto prompt assistant uses Claude first when both keys exist', () => {
  const storage = fakeStorage({
    prompt_assistant_provider: 'auto',
    claude_api_key: 'claude-key',
    codex_api_key: 'codex-key',
  })

  const assistant = resolvePromptAssistant(storage)
  assert.equal(assistant.provider, 'claude')
  assert.equal(assistant.label, 'Claude')
  assert.equal(assistantStatusText(storage), 'Claude selected automatically')
})

test('auto prompt assistant falls back to Codex when Claude is missing', () => {
  const storage = fakeStorage({
    prompt_assistant_provider: 'auto',
    codex_api_key: 'codex-key',
  })

  const assistant = resolvePromptAssistant(storage)
  assert.equal(assistant.provider, 'codex')
  assert.equal(assistant.label, 'Codex')
  assert.equal(assistant.model, DEFAULT_CODEX_MODEL)
})

test('explicit provider choice can select Codex when both keys exist', () => {
  const storage = fakeStorage({
    prompt_assistant_provider: 'codex',
    claude_api_key: 'claude-key',
    codex_api_key: 'codex-key',
    codex_model: 'gpt-5.2',
  })

  const assistant = resolvePromptAssistant(storage)
  assert.equal(assistant.provider, 'codex')
  assert.equal(assistant.model, 'gpt-5.2')
  assert.equal(assistantStatusText(storage), 'Codex selected')
})

test('saving prompt assistant settings trims and removes empty keys', () => {
  const storage = fakeStorage({ claude_api_key: 'old' })
  const settings = savePromptAssistantSettings({
    preferred: 'claude',
    claudeKey: ' new-claude ',
    codexKey: '',
    codexModel: '',
  }, storage)

  assert.equal(settings.preferred, 'claude')
  assert.equal(storage.values.get('claude_api_key'), 'new-claude')
  assert.equal(storage.values.has('codex_api_key'), false)
  assert.equal(storage.values.get('codex_model'), DEFAULT_CODEX_MODEL)
})

test('extracts text from OpenAI Responses API output shapes', () => {
  assert.equal(extractCodexText({ output_text: ' direct ' }), 'direct')
  assert.equal(extractCodexText({
    output: [{
      content: [{ type: 'output_text', text: 'nested' }],
    }],
  }), 'nested')
  assert.equal(extractCodexText({ output: [] }), '')
})
