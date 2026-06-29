importScripts('bridgeCore.js')

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'SAVE_ACTIVE_SESSION') {
    chrome.storage.local.set({ activeSession: message.session }, () => sendResponse({ ok: true }))
    return true
  }

  if (message?.type === 'GET_ACTIVE_SESSION') {
    chrome.storage.local.get(['activeSession'], data => sendResponse({ session: data.activeSession || null }))
    return true
  }

  if (message?.type === 'FETCH_IMAGE_AS_DATA_URL') {
    fetchAsDataUrl(message.url).then(
      dataUrl => sendResponse({ dataUrl }),
      error => sendResponse({ error: error.message })
    )
    return true
  }

  if (message?.type === 'STORE_IMPORT') {
    const importId = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    chrome.storage.local.set({ [`import:${importId}`]: { ...message.payload, importId, storedAt: Date.now() } }, () => {
      const appUrl = UGCBridgeCore.getImportAppUrl(message.payload)
      chrome.tabs.create({ url: `${appUrl}/extension-import?importId=${encodeURIComponent(importId)}` })
      sendResponse({ ok: true, importId })
    })
    return true
  }

  if (message?.type === 'GET_IMPORT') {
    chrome.storage.local.get([`import:${message.importId}`], data => {
      sendResponse({ payload: data[`import:${message.importId}`] || null })
    })
    return true
  }

  return false
})

async function fetchAsDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read image blob'))
    reader.readAsDataURL(blob)
  })
}
