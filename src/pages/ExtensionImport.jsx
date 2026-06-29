import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePackages } from '../context/packageStore'

export default function ExtensionImport() {
  const [params] = useSearchParams()
  const { packages, addPackageItem } = usePackages()
  const [status, setStatus] = useState('Waiting for extension import...')
  const importId = params.get('importId')

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return
      if (event.data?.type !== 'UGC_STUDIO_IMPORT_IMAGE') return
      const payload = event.data.payload
      if (!payload?.packageId || !payload?.dataUrl) {
        setStatus('Import payload was incomplete.')
        return
      }
      addPackageItem(payload.packageId, {
        label: payload.label || 'Extension import',
        mode: payload.mode,
        source: payload.source || 'extension',
        url: payload.dataUrl,
        prompt: payload.prompt || '',
      })
      setStatus(`Imported image into ${payload.packageName || 'package'}.`)
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ type: 'UGC_STUDIO_REQUEST_IMPORT', importId }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [importId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page-shell narrow">
      <section className="panel">
        <p className="eyebrow">Extension import</p>
        <h1>{status}</h1>
        <p className="muted">If this stays waiting, reload the page after the extension is installed and active on this domain.</p>
        <div className="row-actions">
          <Link className="primary-btn" to="/library">Open library</Link>
          <Link className="secondary-btn" to="/prompt-builder">Back to prompts</Link>
        </div>
        <div className="list">
          {packages.map(p => <span key={p.id}>{p.name}</span>)}
        </div>
      </section>
    </main>
  )
}
