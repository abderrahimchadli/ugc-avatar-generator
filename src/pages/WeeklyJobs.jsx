import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/auth'
import { usePackages } from '../context/packageStore'
import { useBrandDeals, useInfluencers } from '../store'
import { hasSupabaseConfig } from '../lib/supabaseClient'
import { isHFConnected } from '../utils/higgsfieldAuth'
import { generateSingleImage, generateVideo } from '../utils/higgsfieldGenerate'
import { buildPrompt } from '../utils/promptPresets'
import {
  deleteServerWeeklyJob,
  loadServerWeeklyJobs,
  saveServerWeeklyJob,
} from '../utils/serverWeeklyJobs'
import {
  WEEKLY_VIDEO_FORMATS,
  buildWeeklyJobSeedancePrompt,
  createWeeklyJob,
  getWeeklyJobChecklist,
  getWeeklyJobReferences,
  getWeeklyJobVideoReferences,
  getWeeklyLocations,
  groupWeeklyJobsByWeek,
  isWeeklyJobReady,
  mergeWeeklyJobLists,
  startOfISOWeek,
  storageKeyForWeeklyJobs,
  updateWeeklyJob,
} from '../utils/weeklyJobs'

const STATUS_OPTIONS = [
  { id: 'draft', label: 'Draft' },
  { id: 'references-ready', label: 'References ready' },
  { id: 'video-ready', label: 'Video ready' },
  { id: 'published', label: 'Published' },
]

function readJobs(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeJobs(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Weekly jobs storage failed', error)
  }
}

export default function WeeklyJobs() {
  const { profile } = useAuth()
  const { packages, addPackageItem } = usePackages()
  const influencerStore = useInfluencers() || [[], () => {}]
  const brandDealStore = useBrandDeals() || [[], () => {}]
  const [influencers] = influencerStore
  const [brandDeals] = brandDealStore
  const storageKey = storageKeyForWeeklyJobs(profile)
  const avatarPackages = useMemo(() => packages.filter(pack => pack.type === 'avatar'), [packages])
  const productPackages = useMemo(() => packages.filter(pack => pack.type === 'product'), [packages])
  const locations = useMemo(() => getWeeklyLocations(), [])
  const [jobs, setJobs] = useState([])
  const [notice, setNotice] = useState('')
  const [referenceRuns, setReferenceRuns] = useState({})
  const [videoRuns, setVideoRuns] = useState({})
  const [serverStatus, setServerStatus] = useState(() => ({
    mode: hasSupabaseConfig ? 'server' : 'local',
    sync: hasSupabaseConfig ? 'idle' : 'local-only',
    message: hasSupabaseConfig ? 'Weekly jobs will sync to Supabase when the weekly_jobs table exists.' : 'Demo mode saves weekly jobs in this browser.',
  }))
  const [form, setForm] = useState(() => ({
    weekStart: startOfISOWeek(),
    title: '',
    avatarPackageId: '',
    productPackageId: '',
    locationId: 'studio',
    videoFormat: 'ugc-ad',
    videoBrief: '',
    notes: '',
  }))

  useEffect(() => {
    let cancelled = false
    const cachedJobs = readJobs(storageKey)
    setJobs(cachedJobs)

    async function loadJobs() {
      if (!hasSupabaseConfig || !profile?.id) {
        setServerStatus({
          mode: 'local',
          sync: 'local-only',
          message: 'Demo mode saves weekly jobs in this browser.',
        })
        return
      }

      setServerStatus({
        mode: 'server',
        sync: 'loading',
        message: 'Loading weekly jobs from server...',
      })
      const result = await loadServerWeeklyJobs(profile)
      if (cancelled) return
      if (result.error) {
        setServerStatus({
          mode: 'server',
          sync: 'error',
          message: result.error.message || 'Weekly jobs table is not ready yet. Local account cache is still active.',
        })
        return
      }

      const mergedJobs = mergeWeeklyJobLists(result.jobs || [], cachedJobs)
      setJobs(mergedJobs)
      writeJobs(storageKey, mergedJobs)
      setServerStatus({
        mode: 'server',
        sync: 'synced',
        message: 'Weekly jobs synced.',
      })

      const serverIds = new Set((result.jobs || []).map(job => job.id))
      const missingOnServer = mergedJobs.filter(job => !serverIds.has(job.id))
      if (missingOnServer.length) {
        Promise.allSettled(missingOnServer.map(job => saveServerWeeklyJob(profile, job))).then(results => {
          if (cancelled) return
          const failed = results.find(item => item.status === 'fulfilled' && item.value?.error)
            || results.find(item => item.status === 'rejected')
          if (failed) {
            setServerStatus({
              mode: 'server',
              sync: 'error',
              message: 'Some weekly jobs could not sync to server yet. They remain saved in this account browser cache.',
            })
          }
        })
      }
    }

    loadJobs()
    return () => {
      cancelled = true
    }
  }, [profile?.id, storageKey])

  useEffect(() => {
    setForm(current => ({
      ...current,
      avatarPackageId: current.avatarPackageId || avatarPackages[0]?.id || '',
      productPackageId: current.productPackageId || productPackages[0]?.id || '',
    }))
  }, [avatarPackages[0]?.id, productPackages[0]?.id])

  const groupedJobs = useMemo(() => groupWeeklyJobsByWeek(jobs), [jobs])
  const readyJobs = useMemo(() => jobs.filter(job => isWeeklyJobReady(job, packages)).length, [jobs, packages])

  function persist(nextJobs, message, serverOperation) {
    setJobs(nextJobs)
    writeJobs(storageKey, nextJobs)
    if (serverOperation && hasSupabaseConfig && profile?.id) persistServer(serverOperation)
    if (message) {
      setNotice(message)
      window.setTimeout(() => setNotice(''), 3000)
    }
  }

  function updateForm(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function createJob(event) {
    event.preventDefault()
    const job = createWeeklyJob(form)
    persist([job, ...jobs], 'Weekly UGC job created.', () => saveServerWeeklyJob(profile, job))
    setForm(current => ({ ...current, title: '', videoBrief: '', notes: '' }))
  }

  function patchJob(jobId, patch, message = 'Weekly job updated.') {
    let updatedJob = null
    const nextJobs = jobs.map(job => {
      if (job.id !== jobId) return job
      updatedJob = updateWeeklyJob(job, patch)
      return updatedJob
    })
    persist(nextJobs, message, () => saveServerWeeklyJob(profile, updatedJob))
  }

  function deleteJob(jobId) {
    persist(jobs.filter(job => job.id !== jobId), 'Weekly job removed.', () => deleteServerWeeklyJob(jobId))
  }

  function persistServer(operation) {
    setServerStatus({
      mode: 'server',
      sync: 'saving',
      message: 'Saving weekly job to server...',
    })
    operation().then(result => {
      if (result?.error) {
        setServerStatus({
          mode: 'server',
          sync: 'error',
          message: result.error.message || 'Server save failed. Local account cache is still active.',
        })
      } else {
        setServerStatus({
          mode: 'server',
          sync: 'synced',
          message: 'Weekly jobs synced.',
        })
      }
    }).catch(error => {
      setServerStatus({
        mode: 'server',
        sync: 'error',
        message: error.message || 'Server save failed. Local account cache is still active.',
      })
    })
  }

  async function copyPrompt(job) {
    const prompt = buildWeeklyJobSeedancePrompt(job, packages)
    try {
      await navigator.clipboard.writeText(prompt)
      setNotice('Seedance video prompt copied.')
    } catch {
      setNotice('Copy failed. Select the prompt text manually.')
    }
  }

  function updateVideoRun(jobId, patch) {
    setVideoRuns(current => ({
      ...current,
      [jobId]: {
        ...(current[jobId] || {}),
        ...patch,
      },
    }))
  }

  function updateReferenceRun(jobId, kind, patch) {
    const key = `${jobId}:${kind}`
    setReferenceRuns(current => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...patch,
      },
    }))
  }

  async function generateReference(job, kind) {
    if (!isHFConnected()) {
      setNotice('Connect Higgsfield in Settings first, then generate references in app.')
      return
    }

    const refs = getWeeklyJobReferences(job, packages)
    const isAvatar = kind === 'avatar'
    const isProduct = kind === 'product'
    const pack = isAvatar ? refs.avatarPackage : isProduct ? refs.productPackage : null
    if ((isAvatar || isProduct) && !pack) {
      setNotice(`Select a ${kind} package before generating this reference.`)
      return
    }
    if (kind === 'location' && !refs.location) {
      setNotice('Select a weekly location before generating a location reference.')
      return
    }

    updateReferenceRun(job.id, kind, { generating: true, progress: 5, error: '' })
    try {
      const prompt = buildWeeklyReferencePrompt({ job, refs, pack, kind })
      const url = await generateSingleImage({
        prompt,
        aspectRatio: '9:16',
        resolution: '4k',
        onProgress: progress => updateReferenceRun(job.id, kind, { progress: Math.round(progress) }),
      })
      if (!url) throw new Error('No image was returned.')

      if (isAvatar || isProduct) {
        const mode = referenceModeFor(kind, refs)
        addPackageItem(pack.id, {
          importId: `weekly-${job.id}-${kind}-${Date.now()}`,
          label: `${job.title} ${referenceLabelFor(kind, refs)}`,
          type: 'image',
          mode,
          source: 'weekly-job-studio',
          url,
          prompt,
        })
      } else {
        patchJob(job.id, {
          locationReference: {
            id: `loc_${Date.now()}`,
            label: refs.location?.label || 'Location reference',
            packageName: refs.location?.label || 'Location',
            type: 'image',
            mode: 'location_reference',
            source: 'weekly-job-studio',
            url,
            prompt,
            createdAt: Date.now(),
          },
        }, `Location reference generated for "${job.title}".`)
      }

      updateReferenceRun(job.id, kind, { generating: false, progress: 100, error: '' })
      if (isAvatar || isProduct) setNotice(`${capitalize(kind)} reference generated and saved to "${pack.name}".`)
    } catch (error) {
      updateReferenceRun(job.id, kind, {
        generating: false,
        error: error.message || `${capitalize(kind)} reference generation failed.`,
      })
      setNotice(error.message || `${capitalize(kind)} reference generation failed.`)
    }
  }

  async function generateSeedanceVideo(job) {
    if (!isHFConnected()) {
      setNotice('Connect Higgsfield in Settings first, then generate the Seedance video.')
      return
    }
    const missing = getWeeklyJobChecklist(job, packages).filter(item => !item.done)
    if (missing.length) {
      setNotice(`This week job still needs: ${missing.map(item => item.label).join(', ')}.`)
      return
    }

    const videoRefs = getWeeklyJobVideoReferences(job, packages)
    if (!videoRefs.length) {
      setNotice('Save avatar and product reference images before generating a Seedance video.')
      return
    }

    const prompt = buildWeeklyJobSeedancePrompt(job, packages)
    updateVideoRun(job.id, { generating: true, progress: 3, error: '', urls: [], shareUrls: [] })

    try {
      const result = await generateVideo({
        prompt,
        aspectRatio: '9:16',
        duration: 8,
        count: 1,
        referenceImages: videoRefs.map(ref => ref.url),
        model: 'seedance_2_0',
        resolution: '1080p',
        pendingKey: `weekly_${job.id}`,
        onProgress: progress => updateVideoRun(job.id, { progress: Math.round(progress) }),
        onPartialResults: urls => updateVideoRun(job.id, { urls: [...new Set((urls || []).filter(Boolean))] }),
        isCancelled: () => false,
      })
      const urls = [...new Set((result.urls || []).filter(Boolean))]
      const shareUrls = [...new Set((result.shareUrls || []).filter(Boolean))]
      updateVideoRun(job.id, { generating: false, progress: 100, urls, shareUrls, error: '' })
      patchJob(job.id, {
        status: 'video-ready',
        videoUrls: urls,
        seedance: {
          model: 'seedance_2_0',
          prompt,
          videoUrls: urls,
          generatedAt: Date.now(),
          shareUrls,
          referenceMap: videoRefs.map(ref => ({
            refTag: ref.refTag,
            role: ref.role,
            label: ref.label,
            packageId: ref.packageId,
            packageName: ref.packageName,
          })),
        },
      }, `Seedance video generated for "${job.title}".`)
    } catch (error) {
      updateVideoRun(job.id, {
        generating: false,
        error: error.message || 'Seedance video generation failed.',
      })
      setNotice(error.message || 'Seedance video generation failed.')
    }
  }

  return (
    <main className="page-shell weekly-page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Studio production planner</p>
          <h1>Weekly UGC Jobs</h1>
          <p className="muted">Group avatar, product, location, and video references by week before creating UGC ads.</p>
        </div>
        <div className="row-actions">
          <Link className="secondary-btn" to="/avatars">Avatars</Link>
          <Link className="secondary-btn" to="/products">Products</Link>
          <Link className="primary-btn" to="/studio">Open studio</Link>
        </div>
      </div>

      {notice && <div className="notice">{notice}</div>}
      <div className={`weekly-sync ${serverStatus.sync}`}>
        {serverStatus.message}
      </div>

      <section className="weekly-overview">
        <div className="panel weekly-overview-card">
          <span>Avatar packages</span>
          <strong>{avatarPackages.length}</strong>
          <p>Create or reuse identity-locked influencer references.</p>
        </div>
        <div className="panel weekly-overview-card">
          <span>Product packages</span>
          <strong>{productPackages.length}</strong>
          <p>Create packshots, details, lifestyle images, and product sheets.</p>
        </div>
        <div className="panel weekly-overview-card">
          <span>Studio assets</span>
          <strong>{influencers.length + brandDeals.length}</strong>
          <p>Original influencers and brand deals are still available in Studio.</p>
        </div>
        <div className="panel weekly-overview-card">
          <span>Ready jobs</span>
          <strong>{readyJobs}/{jobs.length}</strong>
          <p>Ready means avatar, product, location, images, and video brief exist.</p>
        </div>
      </section>

      <section className="weekly-layout">
        <form className="panel weekly-job-form" onSubmit={createJob}>
          <div>
            <p className="eyebrow">Create week job</p>
            <h2>Plan one UGC ad package</h2>
            <p className="muted">Use this to prepare the references needed before making a video.</p>
          </div>

          <div className="weekly-form-grid">
            <label>
              Week starts
              <input type="date" value={form.weekStart} onChange={event => updateForm('weekStart', event.target.value)} />
            </label>
            <label>
              Job title
              <input value={form.title} onChange={event => updateForm('title', event.target.value)} placeholder="Example: Serum launch week" />
            </label>
            <label>
              Avatar
              <select value={form.avatarPackageId} onChange={event => updateForm('avatarPackageId', event.target.value)}>
                <option value="">Select avatar package</option>
                {avatarPackages.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
              </select>
            </label>
            <label>
              Product
              <select value={form.productPackageId} onChange={event => updateForm('productPackageId', event.target.value)}>
                <option value="">Select product package</option>
                {productPackages.map(pack => <option key={pack.id} value={pack.id}>{pack.name}</option>)}
              </select>
            </label>
            <label>
              Location
              <select value={form.locationId} onChange={event => updateForm('locationId', event.target.value)}>
                {locations.map(location => <option key={location.id} value={location.id}>{location.label}</option>)}
              </select>
            </label>
            <label>
              Video type
              <select value={form.videoFormat} onChange={event => updateForm('videoFormat', event.target.value)}>
                {WEEKLY_VIDEO_FORMATS.map(format => <option key={format.id} value={format.id}>{format.label}</option>)}
              </select>
            </label>
          </div>

          <label>
            Video brief
            <textarea
              value={form.videoBrief}
              onChange={event => updateForm('videoBrief', event.target.value)}
              placeholder="Example: Morning bathroom mirror routine. Avatar applies the product, shows texture closeup, then gives one honest reason to buy."
            />
          </label>

          <label>
            Notes
            <textarea
              value={form.notes}
              onChange={event => updateForm('notes', event.target.value)}
              placeholder="Offer, CTA, script line, angle, or what still needs to be generated."
            />
          </label>

          <button className="primary-btn full" type="submit">Create weekly job</button>
          <div className="weekly-missing-note">
            {!avatarPackages.length && <Link to="/avatars">Create an avatar package first</Link>}
            {!productPackages.length && <Link to="/products">Create a product package first</Link>}
          </div>
        </form>

        <section className="weekly-side-panel">
          <div className="panel">
            <p className="eyebrow">What this adds</p>
            <ul className="steps-list">
              <li><strong>Weekly grouping:</strong> keep each ad job under a clear week.</li>
              <li><strong>Reference generation:</strong> create avatar, product, and location images directly in app.</li>
              <li><strong>Seedance video:</strong> generate one vertical video after the selected references are ready.</li>
              <li><strong>Existing tools:</strong> Studio, packages, library, extension, and Higgsfield stay separate but organized.</li>
            </ul>
          </div>
          <div className="panel">
            <p className="eyebrow">Fast actions</p>
            <div className="weekly-action-list">
              <Link to="/avatars">Create influencer avatar</Link>
              <Link to="/products">Create product images</Link>
              <Link to="/studio">Open Studio generator</Link>
              <Link to="/influencers">Open original Studio</Link>
              <Link to="/library">Check saved references</Link>
            </div>
          </div>
        </section>
      </section>

      <section className="weekly-jobs-section">
        <div className="page-head compact-head">
          <div>
            <p className="eyebrow">Grouped by week</p>
            <h2>Production board</h2>
          </div>
        </div>

        {groupedJobs.length === 0 ? (
          <div className="panel empty-library">
            <h2>No weekly jobs yet</h2>
            <p className="muted">Create the first week job to group the avatar, product, location, and video brief in one place.</p>
          </div>
        ) : groupedJobs.map(group => (
          <div className="weekly-group" key={group.weekStart}>
            <div className="weekly-group-head">
              <strong>{group.label}</strong>
              <span>{group.jobs.length} job{group.jobs.length === 1 ? '' : 's'}</span>
            </div>
            <div className="card-grid">
              {group.jobs.map(job => (
                <WeeklyJobCard
                  key={job.id}
                  job={job}
                  packages={packages}
                  onPatch={patch => patchJob(job.id, patch)}
                  onDelete={() => deleteJob(job.id)}
                  onCopy={() => copyPrompt(job)}
                  onGenerateVideo={() => generateSeedanceVideo(job)}
                  onGenerateReference={kind => generateReference(job, kind)}
                  referenceRuns={referenceRuns}
                  videoRun={videoRuns[job.id]}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

function WeeklyJobCard({ job, packages, onPatch, onDelete, onCopy, onGenerateVideo, onGenerateReference, referenceRuns, videoRun }) {
  const refs = getWeeklyJobReferences(job, packages)
  const checklist = getWeeklyJobChecklist(job, packages)
  const ready = checklist.every(item => item.done)
  const prompt = buildWeeklyJobSeedancePrompt(job, packages)
  const videos = videoRun?.urls?.length ? videoRun.urls : (job.videoUrls || job.seedance?.videoUrls || [])
  const shareUrls = videoRun?.shareUrls?.length ? videoRun.shareUrls : (job.seedance?.shareUrls || [])
  const progress = Math.max(0, Math.min(100, videoRun?.progress || 0))
  const avatarRun = referenceRuns[`${job.id}:avatar`] || {}
  const productRun = referenceRuns[`${job.id}:product`] || {}
  const locationRun = referenceRuns[`${job.id}:location`] || {}

  return (
    <article className="package-card weekly-job-card">
      <div className="card-top">
        <div>
          <span className={ready ? 'status-ok' : 'status-wait'}>{ready ? 'Ready for video' : 'Needs references'}</span>
          <h2>{job.title}</h2>
          <p className="muted">{refs.videoFormat.label} in {refs.location?.label || 'no location'}</p>
        </div>
        <button className="danger-btn compact" onClick={onDelete} type="button">Delete</button>
      </div>

      <label className="weekly-status-select">
        Status
        <select value={job.status} onChange={event => onPatch({ status: event.target.value })}>
          {STATUS_OPTIONS.map(status => <option key={status.id} value={status.id}>{status.label}</option>)}
        </select>
      </label>

      <div className="weekly-reference-grid">
        <ReferenceCell
          title="Avatar"
          name={refs.avatarPackage?.name || 'Missing'}
          items={refs.avatarImages}
          actionLabel={avatarRun.generating ? `Generating ${avatarRun.progress || 0}%` : refs.avatarImages.length ? 'Generate extra avatar' : 'Generate avatar in app'}
          actionDisabled={!refs.avatarPackage || avatarRun.generating}
          progress={avatarRun.generating ? avatarRun.progress : 0}
          error={avatarRun.error}
          onAction={() => onGenerateReference('avatar')}
        />
        <ReferenceCell
          title="Product"
          name={refs.productPackage?.name || 'Missing'}
          items={refs.productImages}
          actionLabel={productRun.generating ? `Generating ${productRun.progress || 0}%` : refs.productImages.length ? 'Generate extra product' : 'Generate product in app'}
          actionDisabled={!refs.productPackage || productRun.generating}
          progress={productRun.generating ? productRun.progress : 0}
          error={productRun.error}
          onAction={() => onGenerateReference('product')}
        />
        <div className="weekly-reference-cell">
          <span>Location</span>
          <strong>{refs.location?.label || 'Missing'}</strong>
          <p>{refs.location?.description || 'Choose where the UGC ad should happen.'}</p>
          {refs.locationImages.length > 0 && (
            <div className="weekly-thumb-row single">
              {refs.locationImages.slice(0, 1).map(item => (
                <img key={item.id || item.url} src={item.url || item.dataUrl} alt={item.label || 'Location reference'} />
              ))}
            </div>
          )}
          <ReferenceAction
            label={locationRun.generating ? `Generating ${locationRun.progress || 0}%` : refs.locationImages.length ? 'Regenerate location' : 'Generate location in app'}
            disabled={!refs.location || locationRun.generating}
            progress={locationRun.generating ? locationRun.progress : 0}
            error={locationRun.error}
            onAction={() => onGenerateReference('location')}
          />
        </div>
      </div>

      <div className="weekly-checklist">
        {checklist.map(item => (
          <span key={item.id} className={item.done ? 'done' : ''}>{item.done ? 'OK' : 'Need'} {item.label}</span>
        ))}
      </div>

      {job.videoBrief && <p className="weekly-brief">{job.videoBrief}</p>}
      {job.notes && <p className="muted">{job.notes}</p>}

      <label>
        Seedance reference prompt
        <textarea className="weekly-prompt-textarea" readOnly value={prompt} />
      </label>

      <div className="row-actions">
        <button className="primary-btn" onClick={onGenerateVideo} disabled={!ready || videoRun?.generating} type="button">
          {videoRun?.generating ? `Generating ${progress}%` : 'Generate Seedance video'}
        </button>
        <button className="secondary-btn" onClick={onCopy} type="button">Copy prompt</button>
        <Link className="secondary-btn" to="/library">Open library</Link>
      </div>
      {videoRun?.generating && (
        <div className="weekly-video-progress" aria-label={`Seedance video generation ${progress}% complete`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      )}
      {videoRun?.error && <p className="weekly-video-error">{videoRun.error}</p>}
      {videos.length > 0 && (
        <div className="weekly-video-results">
          {videos.map((url, index) => (
            <video key={`${url}-${index}`} src={url} controls playsInline preload="metadata" />
          ))}
          {shareUrls.length > 0 && (
            <div className="weekly-video-links">
              {shareUrls.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">Open Higgsfield video {index + 1}</a>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function ReferenceCell({ title, name, items, actionLabel, actionDisabled, progress, error, onAction }) {
  return (
    <div className="weekly-reference-cell">
      <span>{title}</span>
      <strong>{name}</strong>
      {items.length ? (
        <div className="weekly-thumb-row">
          {items.slice(0, 4).map(item => (
            <img key={item.id} src={item.url || item.dataUrl} alt={item.label || title} />
          ))}
        </div>
      ) : <p>No images saved yet.</p>}
      <ReferenceAction
        label={actionLabel}
        disabled={actionDisabled}
        progress={progress}
        error={error}
        onAction={onAction}
      />
    </div>
  )
}

function ReferenceAction({ label, disabled, progress, error, onAction }) {
  if (!label) return null
  return (
    <div className="weekly-reference-action">
      <button className="secondary-btn compact" type="button" disabled={disabled} onClick={onAction}>{label}</button>
      {progress > 0 && (
        <div className="weekly-mini-progress" aria-label={`${label} progress`}>
          <span style={{ width: `${Math.max(5, Math.min(100, progress))}%` }} />
        </div>
      )}
      {error && <p className="weekly-reference-error">{error}</p>}
    </div>
  )
}

function buildWeeklyReferencePrompt({ job, refs, pack, kind }) {
  if (kind === 'location') {
    return [
      `Weekly UGC job: ${job.title}`,
      `Create one vertical location/environment reference for Seedance video generation.`,
      `Location: ${refs.location?.label || 'selected location'}. ${refs.location?.description || ''}`,
      `Video brief: ${job.videoBrief || 'Short vertical UGC ad.'}`,
      'No people, no logos, no readable text, no watermark.',
      'Make it realistic, clean, phone-video friendly, with enough background detail to guide the later video.',
    ].filter(Boolean).join('\n')
  }

  const mode = referenceModeFor(kind, refs)
  const extra = [
    `Weekly UGC job: ${job.title}.`,
    `Video type: ${refs.videoFormat?.label || 'UGC ad'}.`,
    `Location context: ${refs.location?.label || 'studio'}.`,
    `Video brief: ${job.videoBrief || 'Create a short vertical UGC ad.'}`,
    'Generate a reusable reference image for later Seedance video generation inside this app.',
  ].join(' ')

  return buildPrompt({
    pack,
    mode,
    style: kind === 'product' ? 'product' : 'realistic',
    extra,
  })
}

function referenceModeFor(kind, refs) {
  if (kind === 'avatar') return refs.avatarImages.length ? 'full_body' : 'main_portrait'
  if (kind === 'product') return refs.productImages.length ? 'lifestyle_shot' : 'packshot'
  return 'location_reference'
}

function referenceLabelFor(kind, refs) {
  if (kind === 'avatar') return refs.avatarImages.length ? 'extra avatar reference' : 'avatar reference'
  if (kind === 'product') return refs.productImages.length ? 'extra product reference' : 'product reference'
  return 'location reference'
}

function capitalize(value) {
  return String(value || '').charAt(0).toUpperCase() + String(value || '').slice(1)
}
