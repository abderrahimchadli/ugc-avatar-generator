import { isHFConnected } from '../utils/higgsfieldAuth'
import { HIGGSFIELD_ASSET_NOTE, createPackageMarketingAsset } from '../utils/higgsfieldMarketingAssets'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'
import { useMemo, useState } from 'react'
import {
  getRecentLibraryItems,
  packageImageCount,
  packageUpdatedAt,
  sortPackagesForLibrary,
} from '../utils/libraryView'

export default function Library() {
  const { packages, updatePackage, removePackageItem, storageStats, serverStatus, hasServerStorage } = usePackages()
  const [uploading, setUploading] = useState('')
  const [message, setMessage] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState('updated')
  const [query, setQuery] = useState('')
  const visiblePackages = useMemo(
    () => sortPackagesForLibrary(packages, { type: typeFilter, query, sort }),
    [packages, typeFilter, query, sort]
  )
  const recentItems = useMemo(() => getRecentLibraryItems(packages, 10), [packages])

  async function upload(pack) {
    setMessage('')
    if (!isHFConnected()) {
      setMessage('Connect Higgsfield in Settings first.')
      return
    }
    setUploading(pack.id)
    try {
      const asset = await createPackageMarketingAsset(pack)
      updatePackage(pack.id, {
        higgsfieldAsset: asset,
      })
      setMessage(`Created ${asset.label} "${pack.name}" in Higgsfield Marketing Studio.`)
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
        <div className="storage-pill">
          {storageStats.images} images · {formatBytes(storageStats.usedBytes)} · {hasServerStorage ? serverStatus.sync : 'local'}
        </div>
      </div>
      {message && <p className="notice">{message}</p>}
      <section className="panel library-toolbar">
        <label>Search
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Package name, type, notes..." />
        </label>
        <label>Group
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="all">All packages</option>
            <option value="avatar">Avatars</option>
            <option value="product">Products</option>
          </select>
        </label>
        <label>Sort
          <select value={sort} onChange={e => setSort(e.target.value)}>
            <option value="updated">Recently updated</option>
            <option value="images">Most images</option>
            <option value="name">Name</option>
          </select>
        </label>
      </section>
      <p className="muted library-sync">{serverStatus.message}</p>
      {recentItems.length > 0 && (
        <section className="recent-strip">
          {recentItems.map(item => (
            <article className="recent-thumb" key={item.id}>
              <img src={item.url} alt={item.label} />
              <div>
                <strong>{item.packageName}</strong>
                <span>{item.mode || 'imported'} · {item.source || 'extension'}</span>
              </div>
            </article>
          ))}
        </section>
      )}
      <div className="card-grid">
        {visiblePackages.map(pack => (
          <article className="package-card" key={pack.id}>
            <div className="card-top">
              <div>
                <span className="pill">{pack.type}</span>
                <h2>{pack.name}</h2>
              </div>
              <span className="storage-pill compact">{packageImageCount(pack)}</span>
            </div>
            <p className="muted">Updated {new Date(packageUpdatedAt(pack)).toLocaleString()}</p>
            {pack.higgsfieldAsset?.id && (
              <div className="asset-summary">
                <strong>{pack.higgsfieldAsset.label || 'Higgsfield asset'}</strong>
                <span>ID {String(pack.higgsfieldAsset.id).slice(0, 8)} · {HIGGSFIELD_ASSET_NOTE}</span>
              </div>
            )}
            <div className="thumb-grid">
              {(pack.items || []).slice(0, 8).map(item => (
                <div className="thumb" key={item.id}>
                  <img src={item.url} alt={item.label} />
                  {item.higgsfield?.url && (
                    <span className="uploaded" title="Legacy generation reference media">HF ref</span>
                  )}
                  <button type="button" title="Remove image" onClick={() => removePackageItem(pack.id, item.id)}>Remove</button>
                </div>
              ))}
            </div>
            <button className="primary-btn full" onClick={() => upload(pack)} disabled={uploading === pack.id || !(pack.items || []).length}>
              {uploading === pack.id
                ? 'Creating asset...'
                : pack.higgsfieldAsset?.id
                  ? 'Recreate Higgsfield asset'
                  : 'Create Higgsfield asset'}
            </button>
          </article>
        ))}
        {visiblePackages.length === 0 && (
          <section className="panel empty-library">
            <h2>No packages found</h2>
            <p className="muted">Create an avatar or product package, then save generated images from the extension.</p>
          </section>
        )}
      </div>
    </main>
  )
}
