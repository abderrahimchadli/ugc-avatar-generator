const APP_HOST_RE = /^(localhost:5173|.*\.vercel\.app)$/
const FLOW_HOST_RE = /labs\.google$/
const CHATGPT_HOST_RE = /chatgpt\.com$/
const seen = new WeakSet()
let activeSession = null

init()

function init() {
  chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSION' }, res => {
    activeSession = res?.session || null
    if (isToolPage()) mountToolPanel()
    scanImages()
  })

  window.addEventListener('message', event => {
    if (event.source !== window) return
    if (event.data?.type === 'UGC_STUDIO_SESSION') {
      activeSession = { ...event.data.session, appUrl: window.location.origin, tabBoundAt: Date.now() }
      chrome.runtime.sendMessage({ type: 'SAVE_ACTIVE_SESSION', session: activeSession })
    }
    if (event.data?.type === 'UGC_STUDIO_REQUEST_IMPORT') {
      chrome.runtime.sendMessage({ type: 'GET_IMPORT', importId: event.data.importId }, res => {
        if (res?.payload) window.postMessage({ type: 'UGC_STUDIO_IMPORT_IMAGE', payload: res.payload }, window.location.origin)
      })
    }
  })

  if (isToolPage()) {
    const observer = new MutationObserver(() => scanImages())
    observer.observe(document.documentElement, { childList: true, subtree: true })
    setInterval(scanImages, 2500)
  }
}

function isAppPage() {
  return APP_HOST_RE.test(location.host)
}

function isToolPage() {
  return FLOW_HOST_RE.test(location.host) || CHATGPT_HOST_RE.test(location.host)
}

function mountToolPanel() {
  if (document.getElementById('ugc-bridge-panel')) return
  const panel = document.createElement('div')
  panel.id = 'ugc-bridge-panel'
  panel.innerHTML = `
    <div class="ugc-title">UGC Bridge</div>
    <div class="ugc-session">${activeSession ? `Saving to ${escapeHtml(activeSession.packageName)}` : 'No active package session'}</div>
    <button id="ugc-fill-prompt">Paste prompt</button>
    <button id="ugc-click-generate">Click generate</button>
    <button id="ugc-scan-images">Scan images</button>
  `
  document.body.appendChild(panel)
  panel.querySelector('#ugc-fill-prompt').addEventListener('click', fillPrompt)
  panel.querySelector('#ugc-click-generate').addEventListener('click', clickGenerate)
  panel.querySelector('#ugc-scan-images').addEventListener('click', scanImages)
}

function fillPrompt() {
  if (!activeSession?.prompt) return alert('Open a package prompt from the Avatar Studio app first.')
  const target = findPromptTarget()
  if (!target) {
    navigator.clipboard?.writeText(activeSession.prompt)
    return alert('Prompt copied. Paste it into the prompt box manually.')
  }
  target.focus()
  if ('value' in target) {
    target.value = activeSession.prompt
    target.dispatchEvent(new Event('input', { bubbles: true }))
  } else {
    target.textContent = activeSession.prompt
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: activeSession.prompt }))
  }
}

function findPromptTarget() {
  const selectors = [
    'textarea',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.ProseMirror',
  ]
  for (const selector of selectors) {
    const all = [...document.querySelectorAll(selector)].filter(el => isVisible(el))
    if (all.length) return all.sort((a, b) => area(b) - area(a))[0]
  }
  return null
}

function clickGenerate() {
  const buttons = [...document.querySelectorAll('button,[role="button"]')].filter(isVisible)
  const target = buttons.find(btn => /generate|create|submit|send|arrow_forward|start/i.test(btn.textContent || btn.ariaLabel || ''))
  if (target) target.click()
  else alert('Could not find a generate button. Click it manually, then use Save to App on the result.')
}

function scanImages() {
  if (!isToolPage()) return
  const imgs = [...document.querySelectorAll('img')].filter(img => {
    if (seen.has(img) || !isVisible(img)) return false
    const box = img.getBoundingClientRect()
    return box.width >= 220 && box.height >= 220 && !/avatar|logo|icon/i.test(img.alt || '')
  })
  imgs.forEach(addSaveButton)
}

function addSaveButton(img) {
  seen.add(img)
  const wrap = document.createElement('button')
  wrap.className = 'ugc-save-image'
  wrap.textContent = activeSession ? `Save to ${activeSession.packageName}` : 'Save to App'
  wrap.addEventListener('click', event => {
    event.preventDefault()
    event.stopPropagation()
    saveImage(img)
  })
  const parent = img.parentElement || document.body
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative'
  parent.appendChild(wrap)
}

async function saveImage(img) {
  if (!activeSession?.packageId) return alert('Open a prompt session from the Avatar Studio app first.')
  const src = img.currentSrc || img.src
  if (!src) return alert('Could not read image URL.')
  let dataUrl
  try {
    dataUrl = await imageToDataUrl(src)
  } catch {
    const res = await chrome.runtime.sendMessage({ type: 'FETCH_IMAGE_AS_DATA_URL', url: src })
    if (res?.error) return alert(res.error)
    dataUrl = res.dataUrl
  }
  chrome.runtime.sendMessage({
    type: 'STORE_IMPORT',
    payload: {
      appUrl: activeSession.appUrl,
      packageId: activeSession.packageId,
      packageName: activeSession.packageName,
      mode: activeSession.mode,
      prompt: activeSession.prompt,
      source: location.host.includes('chatgpt') ? 'chatgpt-image' : 'google-flow',
      dataUrl,
      label: `Imported from ${location.host}`,
    },
  })
}

async function imageToDataUrl(src) {
  const res = await fetch(src)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function isVisible(el) {
  const box = el.getBoundingClientRect()
  return box.width > 1 && box.height > 1 && box.bottom >= 0 && box.right >= 0
}

function area(el) {
  const box = el.getBoundingClientRect()
  return box.width * box.height
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]))
}

