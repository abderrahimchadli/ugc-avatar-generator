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
    if (event.data?.type === 'UGC_STUDIO_PING' && isAppPage()) {
      window.postMessage({ type: 'UGC_STUDIO_PONG' }, window.location.origin)
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
  return UGCBridgeCore.isAppHost(location.host)
}

function isToolPage() {
  return UGCBridgeCore.isToolHost(location.host)
}

function mountToolPanel() {
  if (document.getElementById('ugc-bridge-panel')) return
  const panel = document.createElement('div')
  panel.id = 'ugc-bridge-panel'
  const sessionText = UGCBridgeCore.formatSession(activeSession)
  const flowModelLabel = UGCBridgeCore.getPreferredFlowModelLabels(activeSession)[0]
  const flowControls = UGCBridgeCore.isFlowHost(location.host)
    ? `<button id="ugc-select-flow-model">Set ${UGCBridgeCore.escapeHtml(flowModelLabel)}</button>`
    : ''
  panel.innerHTML = `
    <div class="ugc-kicker">Avatar Studio</div>
    <div class="ugc-title">${UGCBridgeCore.escapeHtml(sessionText.title)}</div>
    <div class="ugc-session">${UGCBridgeCore.escapeHtml(sessionText.body)}</div>
    ${flowControls}
    <button id="ugc-fill-prompt">Paste prompt</button>
    <button id="ugc-click-generate">Click generate</button>
    <button id="ugc-scan-images">Scan images</button>
    <div class="ugc-status" id="ugc-bridge-status"></div>
  `
  document.body.appendChild(panel)
  panel.querySelector('#ugc-select-flow-model')?.addEventListener('click', selectPreferredFlowModel)
  panel.querySelector('#ugc-fill-prompt').addEventListener('click', fillPrompt)
  panel.querySelector('#ugc-click-generate').addEventListener('click', clickGenerate)
  panel.querySelector('#ugc-scan-images').addEventListener('click', scanImages)
}

async function fillPrompt() {
  if (!activeSession?.prompt) return alert('Open a package prompt from the Avatar Studio app first.')
  if (UGCBridgeCore.isFlowHost(location.host)) await selectPreferredFlowModel()
  const target = findPromptTarget()
  if (!target) {
    navigator.clipboard?.writeText(activeSession.prompt)
    return alert('Prompt copied. Paste it into the prompt box manually.')
  }
  const result = await UGCBridgeCore.writePromptToTargetAsync(target, activeSession.prompt)
  if (!result.ok) {
    navigator.clipboard?.writeText(activeSession.prompt)
    if (result.visibleDom && UGCBridgeCore.isFlowHost(location.host)) {
      setStatus('Flow shows the text, but Create is still disabled. Prompt copied for manual paste.')
    } else {
      setStatus('Prompt copied. Paste manually if Flow still says it is empty.')
    }
    return
  }
  if (UGCBridgeCore.isFlowHost(location.host)) {
    const accepted = await waitForGenerateReady(1800)
    if (!accepted) {
      navigator.clipboard?.writeText(activeSession.prompt)
      setStatus('Flow did not enable Create after paste. Prompt copied for manual paste.')
      return
    }
  }
  setStatus('Prompt pasted into the active editor.')
}

function findPromptTarget() {
  const selectors = [
    '[data-slate-editor="true"]',
    '[data-slate-string="true"]',
    '[data-slate-node="element"]',
    '[aria-label*="prompt" i]',
    '[placeholder*="prompt" i]',
    '[data-testid*="prompt" i]',
    'textarea:not([readonly]):not([disabled])',
    'input[type="text"]:not([readonly]):not([disabled])',
    '[contenteditable="true"]',
    '[role="textbox"]',
    '.ProseMirror',
  ]
  const candidates = selectors.flatMap(selector => queryDeep(document, selector))
    .filter(el => isVisible(el) && !el.closest?.('#ugc-bridge-panel'))
  if (candidates.length) {
    return candidates.sort((a, b) => promptTargetScore(b) - promptTargetScore(a))[0]
  }
  return null
}

function promptTargetScore(el) {
  const text = [
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('placeholder'),
    el.getAttribute?.('data-testid'),
    el.id,
    el.className,
  ].join(' ')
  let score = area(el)
  if (/prompt/i.test(text)) score += 100000
  if (el.matches?.('[data-slate-editor="true"]')) score += 150000
  if (el.matches?.('[data-slate-string="true"],[data-slate-node="element"]')) score += 90000
  if (/search|filter|model/i.test(text)) score -= 50000
  if (String(el.tagName).toLowerCase() === 'textarea') score += 25000
  if (el.getAttribute?.('contenteditable') === 'true') score += 15000
  return score
}

async function selectPreferredFlowModel() {
  if (!UGCBridgeCore.isFlowHost(location.host)) return false
  const labels = UGCBridgeCore.getPreferredFlowModelLabels(activeSession)
  const openOption = findOpenModelOption(labels)
  if (openOption) {
    clickElementLikeUser(openOption)
    setStatus(`Selected ${labels[0]}.`)
    return true
  }

  if (currentModelLooksSelected(labels)) {
    setStatus(`${labels[0]} is already selected.`)
    return true
  }

  const trigger = findModelMenuTrigger()
  if (!trigger) {
    setStatus(`Could not find the Flow model menu. Select ${labels[0]} manually.`)
    return false
  }

  clickElementLikeUser(trigger)
  await wait(450)
  const option = findOpenModelOption(labels) || findClickableByLabels(labels)
  if (!option) {
    setStatus(`Could not find ${labels[0]} in the open model menu.`)
    return false
  }
  clickElementLikeUser(option)
  setStatus(`Selected ${labels[0]}.`)
  return true
}

function currentModelLooksSelected(labels) {
  const controls = queryDeep(document, 'button,[role="button"],[aria-haspopup="menu"],[aria-haspopup="listbox"]')
    .filter(el => isVisible(el) && !el.closest?.('#ugc-bridge-panel'))
  return controls.some(el => UGCBridgeCore.textMatchesAnyLabel(getVisibleText(el), labels))
}

function findOpenModelOption(labels) {
  const options = queryDeep(document, '[role="option"],[role="menuitem"],[aria-selected],li')
    .filter(el => isVisible(el) && !el.closest?.('#ugc-bridge-panel'))
    .filter(el => UGCBridgeCore.textMatchesAnyLabel(getVisibleText(el), labels))
  return options.sort((a, b) => area(a) - area(b))[0] || null
}

function findClickableByLabels(labels) {
  const clickable = queryDeep(document, 'button,[role="button"],[role="option"],[role="menuitem"],li,div')
    .filter(el => isVisible(el) && !el.closest?.('#ugc-bridge-panel'))
    .filter(el => UGCBridgeCore.textMatchesAnyLabel(getVisibleText(el), labels))
  return clickable.sort((a, b) => area(a) - area(b))[0] || null
}

function findModelMenuTrigger() {
  const candidates = queryDeep(document, 'button,[role="button"],[aria-haspopup="menu"],[aria-haspopup="listbox"]')
    .filter(el => isVisible(el) && !el.closest?.('#ugc-bridge-panel'))
    .filter(el => /model|nano|banana|imagen|image|veo/i.test(getVisibleText(el)))
  return candidates.sort((a, b) => area(a) - area(b))[0] || null
}

function queryDeep(root, selector) {
  const found = []
  try {
    if (root.querySelectorAll) found.push(...root.querySelectorAll(selector))
  } catch {
    return found
  }
  const nodes = root.querySelectorAll ? [...root.querySelectorAll('*')] : []
  for (const node of nodes) {
    if (node.shadowRoot) found.push(...queryDeep(node.shadowRoot, selector))
  }
  return [...new Set(found)]
}

function getVisibleText(el) {
  return [
    el.innerText,
    el.textContent,
    el.getAttribute?.('aria-label'),
    el.getAttribute?.('title'),
    el.getAttribute?.('data-testid'),
  ].join(' ')
}

function setStatus(message) {
  const status = document.getElementById('ugc-bridge-status')
  if (status) status.textContent = message || ''
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function clickGenerate() {
  await wait(250)
  const target = findGenerateButton()
  if (target) {
    clickElementLikeUser(target)
    setStatus('Clicked the generate button.')
    return
  }

  const promptTarget = findPromptTarget()
  if (UGCBridgeCore.submitPromptFromTarget(promptTarget)) {
    setStatus('Submitted from the prompt editor.')
    return
  }

  alert('Could not find a generate button. Click it manually, then use Save to App on the result.')
}

async function waitForGenerateReady(timeoutMs = 1500) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (findGenerateButton()) return true
    await wait(120)
  }
  return Boolean(findGenerateButton())
}

function findGenerateButton() {
  const directSelectors = [
    'button[type="submit"]',
    'button[aria-label*="generate" i]',
    'button[aria-label*="create" i]',
    'button[aria-label*="send" i]',
    '[role="button"][aria-label*="generate" i]',
    '[role="button"][aria-label*="send" i]',
    '[data-testid*="generate" i]',
    '[data-testid*="send" i]',
    '[data-testid*="submit" i]',
  ]
  for (const selector of directSelectors) {
    const match = queryDeep(document, selector)
      .filter(isClickableAction)
      .sort((a, b) => generateButtonScore(b) - generateButtonScore(a))[0]
    if (match) return match
  }

  const buttons = queryDeep(document, 'button,[role="button"]')
    .filter(isClickableAction)
    .sort((a, b) => generateButtonScore(b) - generateButtonScore(a))
  return buttons[0] || null
}

function isClickableAction(el) {
  if (!isVisible(el) || el.closest?.('#ugc-bridge-panel')) return false
  if (el.disabled || el.getAttribute?.('aria-disabled') === 'true') return false
  return generateButtonScore(el) > 0
}

function generateButtonScore(el) {
  const text = getVisibleText(el)
  let score = 0
  if (/generate|create|submit|send|start/i.test(text)) score += 100
  if (/arrow|send|submit|generate/i.test(text)) score += 30
  if (String(el.tagName).toLowerCase() === 'button') score += 15
  if (el.getAttribute?.('type') === 'submit') score += 25
  if (/cancel|stop|close|menu|model|settings|help|upgrade/i.test(text)) score -= 100
  score -= Math.min(area(el) / 10000, 30)
  return score
}

function clickElementLikeUser(el) {
  if (!el) return false
  const win = el.ownerDocument?.defaultView || window
  el.focus?.()
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const EventCtor = type.startsWith('pointer') ? (win.PointerEvent || win.MouseEvent) : win.MouseEvent
    try {
      el.dispatchEvent(new EventCtor(type, { bubbles: true, cancelable: true, composed: true, button: 0 }))
    } catch {
      if (type === 'click') el.click?.()
    }
  }
  return true
}

function scanImages() {
  if (!isToolPage()) return
  const imgs = [...document.querySelectorAll('img')].filter(img => {
    if (seen.has(img) || !isVisible(img)) return false
    const box = img.getBoundingClientRect()
    return UGCBridgeCore.isLikelyGeneratedImage({
      width: box.width,
      height: box.height,
      alt: img.alt || '',
      src: img.currentSrc || img.src || '',
      visible: true,
    })
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
      ownerId: activeSession.ownerId,
      ownerEmail: activeSession.ownerEmail,
      ownerName: activeSession.ownerName,
      mode: activeSession.mode,
      prompt: activeSession.prompt,
      source: UGCBridgeCore.sourceForHost(location.host),
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
