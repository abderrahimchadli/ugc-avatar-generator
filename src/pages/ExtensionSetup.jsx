import { useEffect, useState } from 'react'

const REPO_URL = 'https://github.com/abderrahimchadli/ugc-avatar-generator'
const EXTENSION_ZIP = '/downloads/ugc-avatar-studio-extension.zip'

export default function ExtensionSetup() {
  const [detected, setDetected] = useState(false)
  const [checkedAt, setCheckedAt] = useState(null)

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return
      if (event.data?.type === 'UGC_STUDIO_PONG') {
        setDetected(true)
        setCheckedAt(new Date())
      }
    }
    window.addEventListener('message', onMessage)
    checkExtension()
    return () => window.removeEventListener('message', onMessage)
  }, [])

  function checkExtension() {
    setDetected(false)
    setCheckedAt(new Date())
    window.postMessage({ type: 'UGC_STUDIO_PING' }, window.location.origin)
  }

  async function copyPath() {
    const text = 'extension'
    await navigator.clipboard?.writeText(text)
  }

  return (
    <main className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Browser bridge</p>
          <h1>Install Chrome extension</h1>
        </div>
        <div className={detected ? 'status-ok' : 'status-wait'}>
          {detected ? 'Extension detected' : 'Not detected'}
        </div>
      </div>

      <section className="panel builder-grid">
        <div className="stack">
          <h2>Download and install locally</h2>
          <a className="primary-btn full" href={EXTENSION_ZIP} download>
            Download extension ZIP
          </a>
          <ol className="steps-list">
            <li>Download the extension ZIP and unzip it on the computer.</li>
            <li>Open Chrome and go to <strong>chrome://extensions</strong>.</li>
            <li>Turn on <strong>Developer mode</strong>.</li>
            <li>Click <strong>Load unpacked</strong>.</li>
            <li>Select the unzipped <strong>extension</strong> folder.</li>
            <li>Pin <strong>UGC Avatar Studio Bridge</strong> in Chrome.</li>
          </ol>
          <div className="row-actions">
            <a className="primary-btn" href="chrome://extensions">Open Chrome extensions</a>
            <button className="secondary-btn" onClick={copyPath}>Copy folder name</button>
            <button className="secondary-btn" onClick={checkExtension}>Check again</button>
          </div>
          <p className="muted">
            Chrome may block direct links to <strong>chrome://extensions</strong>. If the button does not open it,
            paste the address manually into Chrome.
          </p>
        </div>

        <div className="stack">
          <h2>How it works</h2>
          <div className="settings-row">
            <div><strong>1. Start prompt</strong><span>Open Prompt Builder and choose Google Flow or ChatGPT.</span></div>
          </div>
          <div className="settings-row">
            <div><strong>2. Generate in browser</strong><span>The extension pastes the prompt and watches that active tab.</span></div>
          </div>
          <div className="settings-row">
            <div><strong>3. Save to app</strong><span>Click Save to App on the generated image to import it into the right package.</span></div>
          </div>
          <div className="settings-row">
            <div><strong>4. Create Higgsfield asset</strong><span>Review in Library, then create a Marketing Studio avatar or product asset when you want.</span></div>
          </div>
          <p className="notice">
            {detected
              ? `Extension responded${checkedAt ? ` at ${checkedAt.toLocaleTimeString()}` : ''}.`
              : 'If you already installed the extension, refresh this page and check again.'}
          </p>
          <a className="secondary-btn full" href={REPO_URL} target="_blank" rel="noreferrer">Open GitHub repo</a>
        </div>
      </section>
    </main>
  )
}
