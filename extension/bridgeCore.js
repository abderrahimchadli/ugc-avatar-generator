(function initBridgeCore(global) {
  const DEFAULT_APP_URL = 'https://ugc-avatar-generator-three.vercel.app'
  const LOCAL_APP_URL = 'http://localhost:5173'
  const CHATGPT_IMAGES_URL = 'https://chatgpt.com/images'
  const DEFAULT_FLOW_MODEL = 'nano_banana_pro'
  const FLOW_MODEL_ALIASES = {
    nano_banana_pro: ['Nano Banana Pro', 'Nano Banana 2 Pro', 'Banana Pro', 'Nano Banana Pro 2'],
    nano_banana_2: ['Nano Banana 2', 'Nano Banana', 'Banana 2'],
  }
  const FLOW_HOST_RE = /(^|\.)labs\.google$/
  const CHATGPT_HOST_RE = /(^|\.)chatgpt\.com$/
  const APP_HOST_RE = /^(localhost:5173|ugc-avatar-generator-three\.vercel\.app)$/
  const BLOCKED_ALT_RE = /avatar|logo|icon|profile|button|sprite/i

  function normalizeAppUrl(value, fallback = DEFAULT_APP_URL) {
    try {
      const url = new URL(value || fallback)
      if (!['https:', 'http:'].includes(url.protocol)) return fallback
      return url.origin
    } catch {
      return fallback
    }
  }

  function getPrimaryAppUrl(session) {
    return normalizeAppUrl(DEFAULT_APP_URL)
  }

  function getSessionAppUrl(session) {
    if (!session?.appUrl) return DEFAULT_APP_URL
    return normalizeAppUrl(session.appUrl)
  }

  function getImportAppUrl(session) {
    const url = getSessionAppUrl(session)
    return isLocalAppUrl(url) ? DEFAULT_APP_URL : url
  }

  function canOpenSessionApp(session) {
    if (!session?.appUrl) return false
    const url = getSessionAppUrl(session)
    return url !== DEFAULT_APP_URL && !isLocalAppUrl(url)
  }

  function getPreferredFlowModel(session) {
    return session?.flowModel || session?.imageModel || DEFAULT_FLOW_MODEL
  }

  function getPreferredFlowModelLabels(session) {
    const model = getPreferredFlowModel(session)
    return FLOW_MODEL_ALIASES[model] || FLOW_MODEL_ALIASES[DEFAULT_FLOW_MODEL]
  }

  function normalizeSearchText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
  }

  function textMatchesAnyLabel(text, labels) {
    const haystack = normalizeSearchText(text)
    return labels.some(label => {
      const needle = normalizeSearchText(label)
      return needle && (haystack.includes(needle) || (haystack.length >= 5 && needle.includes(haystack)))
    })
  }

  function isLocalAppUrl(url) {
    return normalizeAppUrl(url) === LOCAL_APP_URL
  }

  function isAppHost(host) {
    return APP_HOST_RE.test(host || '')
  }

  function isFlowHost(host) {
    return FLOW_HOST_RE.test(host || '')
  }

  function isChatGptHost(host) {
    return CHATGPT_HOST_RE.test(host || '')
  }

  function isToolHost(host) {
    return isFlowHost(host) || isChatGptHost(host)
  }

  function sourceForHost(host) {
    if (isChatGptHost(host)) return 'chatgpt-image'
    if (isFlowHost(host)) return 'google-flow'
    return 'unknown'
  }

  function isLikelyGeneratedImage({ width, height, alt = '', src = '', visible = true }) {
    if (!visible) return false
    if (width < 220 || height < 220) return false
    if (BLOCKED_ALT_RE.test(alt)) return false
    if (/favicon|sprite|logo|avatar/i.test(src)) return false
    return true
  }

  function formatSession(session) {
    if (!session?.packageName) {
      return {
        title: 'No active package',
        body: 'Open Avatar Studio, choose a package, then launch Flow or ChatGPT from Prompt Builder.',
      }
    }
    return {
      title: `Saving to ${session.packageName}`,
      body: session.mode ? `Mode: ${session.mode}` : 'Ready to import generated images.',
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]))
  }

  function readTargetText(target) {
    if (!target) return ''
    if ('value' in target) return String(target.value || '')
    return String(target.innerText || target.textContent || target.getAttribute?.('aria-label') || '')
  }

  function textWasWritten(target, text) {
    const expected = String(text || '')
    const actual = readTargetText(target)
    if (!expected) return true
    return actual === expected || actual.includes(expected.slice(0, Math.min(expected.length, 60)))
  }

  function dispatchTextEvent(target, type, text, options = {}) {
    const win = target?.ownerDocument?.defaultView || global
    const EventCtor = type === 'input' || type === 'beforeinput'
      ? (win.InputEvent || win.Event)
      : win.Event
    const event = new EventCtor(type, {
      bubbles: true,
      cancelable: type === 'beforeinput',
      composed: true,
      inputType: options.inputType || 'insertText',
      data: text,
    })
    return target.dispatchEvent(event)
  }

  function dispatchPasteEvent(target, text) {
    const win = target?.ownerDocument?.defaultView || global
    if (!win.ClipboardEvent) return true
    let clipboardData = null
    try {
      clipboardData = new win.DataTransfer()
      clipboardData.setData('text/plain', String(text || ''))
    } catch {
      clipboardData = null
    }
    const event = new win.ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData,
    })
    if (clipboardData && !event.clipboardData) {
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
    }
    return target.dispatchEvent(event)
  }

  function dispatchKeyboardEvent(target, type, key, options = {}) {
    const win = target?.ownerDocument?.defaultView || global
    const event = new (win.KeyboardEvent || win.Event)(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      key,
      code: options.code || key,
      keyCode: options.keyCode || (key === 'Enter' ? 13 : 0),
      which: options.which || (key === 'Enter' ? 13 : 0),
    })
    return target.dispatchEvent(event)
  }

  function setNativeValue(target, text) {
    const win = target?.ownerDocument?.defaultView || global
    const tag = String(target?.tagName || '').toLowerCase()
    const proto = tag === 'textarea'
      ? win.HTMLTextAreaElement?.prototype
      : tag === 'input'
        ? win.HTMLInputElement?.prototype
        : Object.getPrototypeOf(target)
    const setter = Object.getOwnPropertyDescriptor(proto || {}, 'value')?.set
      || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target) || {}, 'value')?.set
    if (setter) setter.call(target, text)
    else target.value = text
  }

  function writePromptToTarget(target, text) {
    if (!target) return { ok: false, reason: 'missing-target' }
    const prompt = String(text || '')
    target.focus?.()
    target.click?.()

    if ('value' in target) {
      setNativeValue(target, '')
      target.setSelectionRange?.(0, 0)
      dispatchTextEvent(target, 'input', '', { inputType: 'deleteContentBackward' })
      dispatchPasteEvent(target, prompt)
      dispatchTextEvent(target, 'beforeinput', prompt)
      setNativeValue(target, prompt)
      target.setSelectionRange?.(prompt.length, prompt.length)
      dispatchTextEvent(target, 'input', prompt)
      dispatchTextEvent(target, 'change', prompt)
      return { ok: textWasWritten(target, prompt), strategy: 'native-value' }
    }

    const doc = target.ownerDocument || global.document
    const selection = doc?.getSelection?.()
    const range = doc?.createRange?.()
    if (selection && range) {
      range.selectNodeContents(target)
      selection.removeAllRanges()
      selection.addRange(range)
    }

    dispatchTextEvent(target, 'beforeinput', '', { inputType: 'deleteContentBackward' })
    doc?.execCommand?.('delete', false)

    let inserted = false
    if (doc?.execCommand) {
      dispatchPasteEvent(target, prompt)
      dispatchTextEvent(target, 'beforeinput', prompt)
      inserted = doc.execCommand('insertText', false, prompt)
    }

    if (!inserted && selection && range) {
      const textNode = doc.createTextNode?.(prompt)
      if (textNode) {
        range.deleteContents?.()
        range.insertNode?.(textNode)
        range.setStartAfter?.(textNode)
        range.collapse?.(true)
        selection.removeAllRanges()
        selection.addRange(range)
        inserted = true
      }
    }

    dispatchTextEvent(target, 'input', prompt)
    dispatchTextEvent(target, 'change', prompt)
    return { ok: inserted && textWasWritten(target, prompt), strategy: inserted ? 'editable-insert' : 'editable-failed' }
  }

  function submitPromptFromTarget(target) {
    if (!target) return false
    dispatchKeyboardEvent(target, 'keydown', 'Enter')
    dispatchKeyboardEvent(target, 'keypress', 'Enter')
    dispatchKeyboardEvent(target, 'keyup', 'Enter')
    const form = target.closest?.('form')
    if (form?.requestSubmit) {
      form.requestSubmit()
      return true
    }
    if (form) {
      const win = target.ownerDocument?.defaultView || global
      form.dispatchEvent(new win.Event('submit', { bubbles: true, cancelable: true }))
      return true
    }
    return false
  }

  const core = {
    DEFAULT_APP_URL,
    LOCAL_APP_URL,
    CHATGPT_IMAGES_URL,
    DEFAULT_FLOW_MODEL,
    FLOW_MODEL_ALIASES,
    normalizeAppUrl,
    getPrimaryAppUrl,
    getSessionAppUrl,
    getImportAppUrl,
    canOpenSessionApp,
    getPreferredFlowModel,
    getPreferredFlowModelLabels,
    normalizeSearchText,
    textMatchesAnyLabel,
    isLocalAppUrl,
    isAppHost,
    isFlowHost,
    isChatGptHost,
    isToolHost,
    sourceForHost,
    isLikelyGeneratedImage,
    formatSession,
    escapeHtml,
    readTargetText,
    writePromptToTarget,
    submitPromptFromTarget,
  }

  global.UGCBridgeCore = core
  if (typeof module !== 'undefined' && module.exports) module.exports = core
})(typeof globalThis !== 'undefined' ? globalThis : window)
