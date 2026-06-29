import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { usePackages } from '../context/packageStore'
import { useAuth } from '../context/auth'
import { validateExtensionImport } from '../utils/importGuards'

export default function ExtensionImport() {
  const [params] = useSearchParams()
  const { profile } = useAuth()
  const { packages, addPackageItem, serverStatus, hasServerStorage } = usePackages()
  const [status, setStatus] = useState('Waiting for extension import...')
  const [payload, setPayload] = useState(null)
  const [importedPackageId, setImportedPackageId] = useState('')
  const processedRef = useRef(new Set())
  const importId = params.get('importId')

  useEffect(() => {
    function onMessage(event) {
      if (event.source !== window) return
      if (event.data?.type !== 'UGC_STUDIO_IMPORT_IMAGE') return
      setPayload({ ...event.data.payload, importId: event.data.payload?.importId || importId })
    }
    window.addEventListener('message', onMessage)
    window.postMessage({ type: 'UGC_STUDIO_REQUEST_IMPORT', importId }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [importId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!payload) return
    if (serverStatus.sync === 'loading') {
      setStatus('Loading your account library before importing...')
      return
    }

    const key = payload.importId || `${payload.packageId}:${payload.dataUrl?.slice(0, 80)}`
    if (processedRef.current.has(key)) return

    const validation = validateExtensionImport({ payload, profile, packages })
    if (!validation.ok) {
      processedRef.current.add(key)
      setStatus(validation.message)
      return
    }

    const result = addPackageItem(payload.packageId, {
      label: payload.label || `Imported from ${payload.source || 'extension'}`,
      mode: payload.mode,
      source: payload.source || 'extension',
      url: payload.dataUrl,
      prompt: payload.prompt || '',
      ownerId: profile.id,
      importId: key,
    })
    processedRef.current.add(key)
    if (result.error) {
      setStatus(result.error.message)
      return
    }
    setImportedPackageId(payload.packageId)
    setStatus(result.duplicate ? `Image was already in ${validation.pack.name}.` : `Imported image into ${validation.pack.name}.`)
  }, [payload, profile?.id, packages, serverStatus.sync]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="page-shell narrow">
      <section className="panel">
        <p className="eyebrow">Extension import</p>
        <h1>{status}</h1>
        <p className="muted">
          {hasServerStorage
            ? serverStatus.message
            : 'Demo mode saves imports inside this browser account. Server storage turns on when Supabase is configured.'}
        </p>
        <div className="row-actions">
          <Link className="primary-btn" to="/library">Open library</Link>
          <Link className="secondary-btn" to={importedPackageId ? `/prompt-builder?packageId=${importedPackageId}` : '/prompt-builder'}>Back to prompts</Link>
        </div>
        <div className="list">
          {packages.map(p => <span key={p.id}>{p.name}</span>)}
        </div>
      </section>
    </main>
  )
}
