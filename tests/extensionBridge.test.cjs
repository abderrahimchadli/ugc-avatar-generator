const test = require('node:test')
const assert = require('node:assert/strict')

require('../extension/bridgeCore.js')
const core = globalThis.UGCBridgeCore

test('popup opens the live Vercel app by default, not localhost', () => {
  assert.equal(core.DEFAULT_APP_URL, 'https://ugc-avatar-generator-three.vercel.app')
  assert.equal(core.getPrimaryAppUrl(null), core.DEFAULT_APP_URL)
  assert.equal(core.getSessionAppUrl(null), core.DEFAULT_APP_URL)
})

test('import flow never opens a stale localhost session in production', () => {
  assert.equal(core.getSessionAppUrl({ appUrl: 'http://localhost:5173/prompt-builder' }), 'http://localhost:5173')
  assert.equal(core.getImportAppUrl({ appUrl: 'http://localhost:5173/prompt-builder' }), core.DEFAULT_APP_URL)
  assert.equal(core.getImportAppUrl({ appUrl: 'https://ugc-avatar-generator-three.vercel.app/prompt-builder' }), core.DEFAULT_APP_URL)
})

test('production popup hides local and default session app links', () => {
  assert.equal(core.canOpenSessionApp(null), false)
  assert.equal(core.canOpenSessionApp({ appUrl: 'http://localhost:5173/prompt-builder' }), false)
  assert.equal(core.canOpenSessionApp({ appUrl: 'https://ugc-avatar-generator-three.vercel.app/prompt-builder' }), false)
  assert.equal(core.canOpenSessionApp({ appUrl: 'https://studio.example.com/prompt-builder' }), true)
})

test('defaults Google Flow sessions to Nano Banana Pro labels', () => {
  const labels = core.getPreferredFlowModelLabels({ flowModel: 'nano_banana_pro' })
  assert.equal(labels[0], 'Nano Banana Pro')
  assert.equal(core.textMatchesAnyLabel('Current model: Nano Banana Pro', labels), true)
  assert.equal(core.textMatchesAnyLabel('Nano Banana', labels), true)
  assert.equal(core.textMatchesAnyLabel('Pro', labels), false)
  assert.equal(core.textMatchesAnyLabel('Current model: Veo 3', labels), false)
})

test('writes prompt through the native textarea setter and input events', () => {
  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type
      Object.assign(this, options)
    }
  }
  class FakeTextArea {
    constructor() {
      this.tagName = 'TEXTAREA'
      this.events = []
      this.ownerDocument = {
        defaultView: {
          Event: FakeEvent,
          InputEvent: FakeEvent,
          HTMLTextAreaElement: FakeTextArea,
        },
      }
    }
    get value() {
      return this._value || ''
    }
    set value(value) {
      this._value = value
      this.usedNativeSetter = true
    }
    dispatchEvent(event) {
      this.events.push(event.type)
      return true
    }
    focus() {
      this.focused = true
    }
    setSelectionRange(start, end) {
      this.selection = [start, end]
    }
  }

  const target = new FakeTextArea()
  const result = core.writePromptToTarget(target, 'Flow prompt text')
  assert.equal(result.ok, true)
  assert.equal(target.value, 'Flow prompt text')
  assert.equal(target.usedNativeSetter, true)
  assert.deepEqual(target.events, ['input', 'beforeinput', 'input', 'change'])
  assert.deepEqual(target.selection, [16, 16])
})

test('writes prompt into contenteditable targets with insertText fallback', () => {
  class FakeEvent {
    constructor(type, options = {}) {
      this.type = type
      Object.assign(this, options)
    }
  }
  const target = {
    tagName: 'DIV',
    textContent: '',
    innerText: '',
    events: [],
    ownerDocument: {
      defaultView: { Event: FakeEvent, InputEvent: FakeEvent },
      getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
      createRange: () => ({ selectNodeContents() {} }),
      execCommand: (command, _ui, text) => {
        if (command === 'insertText') {
          target.textContent = text
          target.innerText = text
        }
        return true
      },
    },
    dispatchEvent(event) {
      this.events.push(event.type)
      return true
    },
    focus() {
      this.focused = true
    },
  }

  const result = core.writePromptToTarget(target, 'Editable Flow prompt')
  assert.equal(result.ok, true)
  assert.equal(target.textContent, 'Editable Flow prompt')
  assert.deepEqual(target.events, ['beforeinput', 'beforeinput', 'input', 'change'])
})

test('submits a prompt through the nearest form when no generate button is found', () => {
  const form = {
    submitted: false,
    requestSubmit() {
      this.submitted = true
    },
  }
  class FakeKeyboardEvent {
    constructor(type, options = {}) {
      this.type = type
      Object.assign(this, options)
    }
  }
  const target = {
    events: [],
    ownerDocument: { defaultView: { KeyboardEvent: FakeKeyboardEvent, Event: FakeKeyboardEvent } },
    closest: selector => (selector === 'form' ? form : null),
    dispatchEvent(event) {
      this.events.push(event.type)
      return true
    },
  }
  assert.equal(core.submitPromptFromTarget(target), true)
  assert.equal(form.submitted, true)
  assert.deepEqual(target.events, ['keydown', 'keypress', 'keyup'])
})

test('normalizes valid app URLs and rejects invalid protocols', () => {
  assert.equal(core.normalizeAppUrl('https://ugc-avatar-generator-three.vercel.app/extension?x=1'), core.DEFAULT_APP_URL)
  assert.equal(core.normalizeAppUrl('javascript:alert(1)'), core.DEFAULT_APP_URL)
})

test('detects supported app and tool hosts', () => {
  assert.equal(core.isAppHost('ugc-avatar-generator-three.vercel.app'), true)
  assert.equal(core.isAppHost('localhost:5173'), true)
  assert.equal(core.isAppHost('random-preview.vercel.app'), false)
  assert.equal(core.isFlowHost('labs.google'), true)
  assert.equal(core.isChatGptHost('chatgpt.com'), true)
  assert.equal(core.isToolHost('chatgpt.com'), true)
  assert.equal(core.isToolHost('example.com'), false)
})

test('maps generated image source from host', () => {
  assert.equal(core.sourceForHost('labs.google'), 'google-flow')
  assert.equal(core.sourceForHost('chatgpt.com'), 'chatgpt-image')
  assert.equal(core.sourceForHost('example.com'), 'unknown')
})

test('filters likely generated images and ignores UI assets', () => {
  assert.equal(core.isLikelyGeneratedImage({ width: 512, height: 512, alt: 'generated image', src: 'https://x/y.png' }), true)
  assert.equal(core.isLikelyGeneratedImage({ width: 120, height: 512, alt: 'generated image', src: 'https://x/y.png' }), false)
  assert.equal(core.isLikelyGeneratedImage({ width: 512, height: 512, alt: 'logo', src: 'https://x/y.png' }), false)
  assert.equal(core.isLikelyGeneratedImage({ width: 512, height: 512, alt: 'image', src: 'https://x/logo.png' }), false)
  assert.equal(core.isLikelyGeneratedImage({ width: 512, height: 512, alt: 'image', src: 'https://x/y.png', visible: false }), false)
})

test('formats empty and active session status for popup UI', () => {
  assert.deepEqual(core.formatSession(null), {
    title: 'No active package',
    body: 'Open Avatar Studio, choose a package, then launch Flow or ChatGPT from Prompt Builder.',
  })
  assert.deepEqual(core.formatSession({ packageName: 'Camila', mode: 'pose_sheet' }), {
    title: 'Saving to Camila',
    body: 'Mode: pose_sheet',
  })
})
