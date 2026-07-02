export const PROMPT_ASSISTANT_PROVIDER_KEY = 'prompt_assistant_provider'
export const CLAUDE_API_KEY = 'claude_api_key'
export const CODEX_API_KEY = 'codex_api_key'
export const CODEX_MODEL_KEY = 'codex_model'
export const DEFAULT_CODEX_MODEL = 'gpt-4.1'

export const PROMPT_ASSISTANT_PROVIDERS = [
  { id: 'auto', label: 'Auto', description: 'Use Claude when connected, otherwise use Codex.' },
  { id: 'claude', label: 'Claude', description: 'Use an Anthropic Claude API key for prompt analysis.' },
  { id: 'codex', label: 'Codex', description: 'Use an OpenAI API key through the Responses API.' },
]

export function getPromptAssistantSettings(storage = localStorage) {
  const preferred = storage.getItem(PROMPT_ASSISTANT_PROVIDER_KEY) || 'auto'
  const claudeKey = storage.getItem(CLAUDE_API_KEY) || ''
  const codexKey = storage.getItem(CODEX_API_KEY) || ''
  const codexModel = storage.getItem(CODEX_MODEL_KEY) || DEFAULT_CODEX_MODEL
  return {
    preferred: PROMPT_ASSISTANT_PROVIDERS.some(item => item.id === preferred) ? preferred : 'auto',
    claudeKey,
    codexKey,
    codexModel,
    hasClaude: Boolean(claudeKey),
    hasCodex: Boolean(codexKey),
  }
}

export function resolvePromptAssistant(storage = localStorage) {
  const settings = getPromptAssistantSettings(storage)
  const choices = settings.preferred === 'auto'
    ? ['claude', 'codex']
    : [settings.preferred, settings.preferred === 'claude' ? 'codex' : 'claude']

  for (const provider of choices) {
    if (provider === 'claude' && settings.claudeKey) {
      return { provider: 'claude', label: 'Claude', apiKey: settings.claudeKey, settings }
    }
    if (provider === 'codex' && settings.codexKey) {
      return { provider: 'codex', label: 'Codex', apiKey: settings.codexKey, model: settings.codexModel, settings }
    }
  }

  return { provider: 'none', label: 'Prompt assistant', apiKey: '', settings }
}

export function hasPromptAssistant(storage = localStorage) {
  return resolvePromptAssistant(storage).provider !== 'none'
}

export function savePromptAssistantSettings({ preferred, claudeKey, codexKey, codexModel }, storage = localStorage) {
  if (preferred) storage.setItem(PROMPT_ASSISTANT_PROVIDER_KEY, preferred)
  writeOrRemove(storage, CLAUDE_API_KEY, claudeKey)
  writeOrRemove(storage, CODEX_API_KEY, codexKey)
  writeOrRemove(storage, CODEX_MODEL_KEY, codexModel || DEFAULT_CODEX_MODEL)
  return getPromptAssistantSettings(storage)
}

export function assistantStatusText(storage = localStorage) {
  const active = resolvePromptAssistant(storage)
  if (active.provider === 'none') return 'Not connected'
  const both = active.settings.hasClaude && active.settings.hasCodex
  if (both && active.settings.preferred === 'auto') return `${active.label} selected automatically`
  if (both) return `${active.label} selected`
  return `${active.label} connected`
}

function writeOrRemove(storage, key, value) {
  const clean = String(value || '').trim()
  if (clean) storage.setItem(key, clean)
  else storage.removeItem(key)
}
