chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSION' }, res => {
  const session = res?.session
  document.getElementById('session').innerHTML = session
    ? `Active package: <code>${session.packageName}</code><br>Mode: <code>${session.mode}</code>`
    : 'No active package. Open the app and click Open in Google Flow or ChatGPT.'
})

document.getElementById('open-app').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_ACTIVE_SESSION' }, res => {
    chrome.tabs.create({ url: res?.session?.appUrl || 'http://localhost:5173' })
  })
})

