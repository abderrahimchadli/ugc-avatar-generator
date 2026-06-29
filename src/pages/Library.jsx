import { isHFConnected } from '../utils/higgsfieldAuth'
import { uploadPackageToHiggsfield } from '../utils/higgsfieldPackageUpload'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'
import { useState } from 'react'

export default function Library() {
  const { packages, updatePackage, storageStats } = usePackages()
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState('')

  async function upload(pack) {
    setMessage('')
    if (!isHFConnected()) {
      setMessage('Connect Higgsfield in Settings first.')
      return
    }
    setUploading(pack.id)
    try {
      const results = await uploadPackageToHiggsfield(pack)
      const byId = Object.fromEntries(results.map(r => [r.itemId, r.higgsfield]))
      updatePackage(pack.id, {
        items: (pack.items || []).map(item => byId[item.id] ? { ...item, higgsfield: byId[item.id] } : item),
      })
      setMessage(`Uploaded ${results.length} images to Higgsfield.`)
    } catch (e) {
      setMessage(e.message)
    } finally {
      setUploading('')
    }
  }

  return (
    <main className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Review and upload</p>
          <h1>Library</h1>
        </div>
        <div className="storage-pill">{storageStats.images} images · {formatBytes(storageStats.usedBytes)}</div>
      </div>
      {message && <p className="notice">{message}</p>}
      <div className="card-grid">
        {packages.map(pack => (
          <article className="package-card" key={pack.id}>
            <span className="pill">{pack.type}</span>
            <h2>{pack.name}</h2>
            <p className="muted">{(pack.items || []).length} package images</p>
            <div className="thumb-grid">
              {(pack.items || []).slice(0, 8).map(item => (
                <div className="thumb" key={item.id}>
                  <img src={item.url} alt={item.label} />
                  {item.higgsfield?.url && <span className="uploaded">HF</span>}
                </div>
              ))}
            </div>
            <button className="primary-btn full" onClick={() => upload(pack)} disabled={uploading === pack.id || !(pack.items || []).length}>
              {uploading === pack.id ? 'Uploading…' : 'Upload package to Higgsfield'}
            </button>
            <button className="secondary-btn full" disabled title="No server storage connected yet">Remove from server</button>
          </article>
        ))}
      </div>
    </main>
  )
}

