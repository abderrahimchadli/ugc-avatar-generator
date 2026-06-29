import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { usePackages } from '../context/packageStore'
import { AVATAR_MODES, PRODUCT_MODES, buildPrompt } from '../utils/promptPresets'
import { getToolUrl } from '../utils/toolTargets'

const FLOW_MODELS = [
  { id: 'nano_banana_pro', label: 'Nano Banana Pro' },
  { id: 'nano_banana_2', label: 'Nano Banana 2' },
]

export default function PromptBuilder() {
  const [params] = useSearchParams()
  const { packages, createGenerationSession } = usePackages()
  const [packageId, setPackageId] = useState(params.get('packageId') || packages[0]?.id || '')
  const pack = packages.find(p => p.id === packageId)
  const modes = pack?.type === 'product' ? PRODUCT_MODES : AVATAR_MODES
  const [mode, setMode] = useState(modes[0]?.id || 'main_portrait')
  const [style, setStyle] = useState('realistic')
  const [flowModel, setFlowModel] = useState('nano_banana_pro')
  const [extra, setExtra] = useState('')
  const prompt = useMemo(() => buildPrompt({ pack, mode, style, extra }), [pack, mode, style, extra])

  function openTool(source) {
    if (!pack) return
    const session = createGenerationSession({
      packageId: pack.id,
      mode,
      prompt,
      source,
      flowModel: source === 'google-flow' ? flowModel : null,
      imageModel: source === 'google-flow' ? flowModel : 'chatgpt-image-2',
    })
    const payload = { type: 'UGC_STUDIO_SESSION', session }
    localStorage.setItem('ugc_active_generation_session', JSON.stringify(session))
    window.postMessage(payload, window.location.origin)
    navigator.clipboard?.writeText(prompt).catch(() => {})
    window.open(getToolUrl(source), '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="page-shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Prompt bridge</p>
          <h1>Generate in Flow or ChatGPT</h1>
        </div>
      </div>
      <section className="panel builder-grid">
        <div className="builder-controls">
          <label>Package
            <select value={packageId} onChange={e => setPackageId(e.target.value)}>
              {packages.map(p => <option key={p.id} value={p.id}>{p.name} · {p.type}</option>)}
            </select>
          </label>
          <label>Mode
            <select value={mode} onChange={e => setMode(e.target.value)}>
              {modes.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label>Style
            <select value={style} onChange={e => setStyle(e.target.value)}>
              <option value="realistic">Realistic UGC</option>
              <option value="fashion">Fashion/editorial</option>
              <option value="animation">Animation style</option>
              <option value="product">Product commercial</option>
            </select>
          </label>
          <label>Google Flow model
            <select value={flowModel} onChange={e => setFlowModel(e.target.value)}>
              {FLOW_MODELS.map(model => <option key={model.id} value={model.id}>{model.label}</option>)}
            </select>
          </label>
          <label>Extra direction
            <textarea value={extra} onChange={e => setExtra(e.target.value)} placeholder="Scene, outfit, product use, camera feel..." />
          </label>
          <div className="row-actions">
            <button className="primary-btn" onClick={() => openTool('google-flow')} disabled={!pack}>Open in Google Flow</button>
            <button className="secondary-btn" onClick={() => openTool('chatgpt-image')} disabled={!pack}>Open in ChatGPT</button>
          </div>
        </div>
        <div>
          <div className="prompt-box">{prompt || 'Create an avatar or product package first.'}</div>
          <p className="muted">The extension stores the session ID and only imports visible images generated in that active tab after this prompt is sent.</p>
        </div>
      </section>
    </main>
  )
}
