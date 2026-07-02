import { isHFConnected } from '../utils/higgsfieldAuth'
import {
  HIGGSFIELD_ASSET_NOTE,
  HIGGSFIELD_MEDIA_NOTE,
  createPackageMarketingAsset,
  selectPackageImagesForMarketingAsset,
} from '../utils/higgsfieldMarketingAssets'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'
import { useMemo, useState } from 'react'
import {
  getRecentLibraryItems,
  packageImageCount,
  packageUpdatedAt,
  sortPackagesForLibrary,
} from '../utils/libraryView'

function higgsfieldProgressMessage(pack, progress) {
  if (progress?.phase === 'upload') {
    return `Uploading ${progress.index} of ${progress.total} selected images from "${pack.name}" to Higgsfield media.`
  }
  if (progress?.phase === 'asset') {
    return `Creating the Higgsfield Marketing Studio asset for "${pack.name}".`
  }
  return `Preparing "${pack.name}" for Higgsfield.`
}

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
      setMessage('Connect Higgsfield in Settings first. A normal Higgsfield website login in Chrome is separate from this app connection.')
      return
    }
    const selectedItems = selectPackageImagesForMarketingAsset(pack)
    if (!selectedItems.length) {
      setMessage(`"${pack.name}" has no saved images yet. Save images from the extension before creating a Higgsfield asset.`)
      return
    }
    setUploading(pack.id)
    try {
      setMessage(`Preparing ${selectedItems.length} selected image${selectedItems.length === 1 ? '' : 's'} from "${pack.name}".`)
      const asset = await createPackageMarketingAsset(pack, progress => {
        setMessage(higgsfieldProgressMessage(pack, progress))
      })
      updatePackage(pack.id, {
        higgsfieldAsset: asset,
        higgsfieldMedia: asset.media,
      })
      setMessage(`Created ${asset.label} "${pack.name}" in Higgsfield Marketing Studio.`)
    } catch (e) {
      if (e.higgsfieldMedia?.uploadIds?.length) {
        updatePackage(pack.id, {
          higgsfieldMedia: e.higgsfieldMedia,
        })
        setMessage(`Uploaded ${e.higgsfieldMedia.uploadIds.length} image${e.higgsfieldMedia.uploadIds.length === 1 ? '' : 's'} to Higgsfield media, but Marketing Studio asset creation failed: ${e.message}`)
      } else {
        setMessage(e.message)
      }
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
            {pack.higgsfieldMedia?.uploadIds?.length && !pack.higgsfieldAsset?.id && (
              <div className="asset-summary media-only">
                <strong>{pack.higgsfieldMedia.label || 'Higgsfield media uploads'}</strong>
                <span>{pack.higgsfieldMedia.uploadIds.length} confirmed · {HIGGSFIELD_MEDIA_NOTE}</span>
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
            {!(pack.items || []).length && (
              <p className="muted">No saved images in this package yet. Import generated images from the extension first.</p>
            )}
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
