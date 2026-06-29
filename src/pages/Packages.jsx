import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePackages } from '../context/packageStore'
import { formatBytes } from '../utils/promptPresets'

export default function Packages({ type }) {
  const { packages, createPackage, deletePackage, removePackageItem } = usePackages()
  const [name, setName] = useState('')
  const list = useMemo(() => packages.filter(p => p.type === type), [packages, type])
  const title = type === 'avatar' ? 'Avatars' : 'Products'

  function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    createPackage(type, name)
    setName('')
  }

  return (
    <main className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">{type === 'avatar' ? 'People and characters' : 'Products and props'}</p>
          <h1>{title}</h1>
        </div>
        <Link className="primary-btn" to="/prompt-builder">Build prompt</Link>
      </div>
      <form className="panel inline-form" onSubmit={add}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={`New ${type} name`} />
        <button className="primary-btn" type="submit">Create {type}</button>
      </form>
      <div className="card-grid">
        {list.map(pack => (
          <article className="package-card" key={pack.id}>
            <div className="card-top">
              <div>
                <span className="pill">{pack.type}</span>
                <h2>{pack.name}</h2>
              </div>
              <button className="danger-btn compact" onClick={() => deletePackage(pack.id)}>Delete</button>
            </div>
            <p className="muted">{(pack.items || []).length} images · {formatBytes((pack.items || []).reduce((s, i) => s + (i.sizeBytes || 0), 0))}</p>
            <div className="thumb-grid">
              {(pack.items || []).slice(0, 6).map(item => (
                <div className="thumb" key={item.id}>
                  {item.url ? <img src={item.url} alt={item.label} /> : null}
                  <button onClick={() => removePackageItem(pack.id, item.id)}>Remove</button>
                </div>
              ))}
            </div>
            <Link className="secondary-btn full" to={`/prompt-builder?packageId=${pack.id}`}>Use package</Link>
          </article>
        ))}
      </div>
    </main>
  )
}

