chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSION' }, res => {
  const session = res?.session
  const formatted = UGCBridgeCore.formatSession(session)
  document.getElementById('session-title').textContent = formatted.title
  document.getElementById('session-body').textContent = formatted.body
  const sessionButton = document.getElementById('open-session-app')
  if (UGCBridgeCore.canOpenSessionApp(session)) {
    sessionButton.hidden = false
    sessionButton.textContent = 'Open session app'
  }
})

document.getElementById('open-live-app').addEventListener('click', () => {
  chrome.tabs.create({ url: UGCBridgeCore.DEFAULT_APP_URL })
})

document.getElementById('open-session-app').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSION' }, res => {
    chrome.tabs.create({ url: UGCBridgeCore.getSessionAppUrl(res?.session) })
  })
})
