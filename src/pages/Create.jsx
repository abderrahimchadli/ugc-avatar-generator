import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfluencers, generateId } from '../store'
import { buildThreeVariationPrompts } from '../utils/systemPrompt'
import { generateThreeImages } from '../utils/higgsfieldGenerate'
import { isHFConnected, startHiggsfieldOAuthPopup, fireReferralOnce } from '../utils/higgsfieldAuth'
import { compressImage } from '../utils/imageUtils'
import { gColor } from '../utils/influencerUtils'

const NICHES = ['Fashion', 'Beauty', 'Lifestyle', 'Fitness', 'Travel', 'Food & Dining', 'Tech', 'Gaming', 'Finance', 'Entertainment', 'Wellness', 'Sports', 'Other']
const VIBE_OPTIONS = [
  { id: 'Minimalist',   label: 'Minimalist',   sub: 'Clean, simple, less is more',      icon: '🤍' },
  { id: 'Old Money',    label: 'Old Money',    sub: 'Understated wealth & heritage',    icon: '🏛' },
  { id: 'Clean Girl',   label: 'Clean Girl',   sub: 'Effortless, dewy, no-makeup look', icon: '🫧' },
  { id: 'Editorial',    label: 'Editorial',    sub: 'High fashion, bold & structured',  icon: '🖤' },
  { id: 'Streetwear',   label: 'Streetwear',   sub: 'Urban, casual street style',       icon: '🧢' },
  { id: 'Bohemian',     label: 'Bohemian',     sub: 'Earthy, flowy, free-spirited',     icon: '🌿' },
  { id: 'Glam',         label: 'Glam',         sub: 'Dressy, dramatic & glamorous',     icon: '✨' },
  { id: 'Preppy',       label: 'Preppy',       sub: 'Classic, collegiate, polished',    icon: '🎓' },
  { id: 'Sporty',       label: 'Sporty',       sub: 'Athletic & activewear vibes',      icon: '⚡' },
  { id: 'Dark & Moody', label: 'Dark & Moody', sub: 'Alternative, edgy & dramatic',    icon: '🌙' },
  { id: 'Y2K',          label: 'Y2K',          sub: '2000s nostalgia & pop culture',    icon: '💿' },
  { id: 'Cottagecore',  label: 'Cottagecore',  sub: 'Romantic, vintage & nature',      icon: '🌸' },
  { id: 'Tech Bro',     label: 'Tech Bro',     sub: 'Smart-casual, Silicon Valley',     icon: '💻' },
]
const STEPS = ['Basics', 'References', 'Story', 'Look', 'Generate']

// Floating card configuration
const ALL_IMGS = ['/inf/i1.png', '/inf/i2.png', '/inf/i3.jpg', '/inf/i4.jpg', '/inf/i5.png', '/inf/i6.jpg', '/inf/i7.png', '/inf/i8.png', '/inf/i9.png', '/inf/i10.png']
const CARD_CONFIG = [
  { left: '1%',  top: '15%', w: 162, rot: '-9deg',  op: 0.48, period: 9,  sway: 12, delay: 0.0 },
  { left: '5%',  top: '58%', w: 140, rot:  '5deg',  op: 0.34, period: 11, sway: 15, delay: 1.9 },
  { right: '1%', top: '10%', w: 170, rot:  '10deg', op: 0.48, period: 10, sway: 13, delay: 0.5 },
  { right: '5%', top: '57%', w: 148, rot: '-6deg',  op: 0.34, period: 12, sway: 16, delay: 1.3 },
]

// Theme tokens — map to CSS variables so dark mode is automatic
const L = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surfaceAlt: 'var(--bg-tertiary)',
  border: 'var(--border)',
  borderFocus: '#8B5CF6',
  text: 'var(--text-primary)',
  textSub: 'var(--text-secondary)',
  textFaint: 'var(--text-tertiary)',
  card: 'var(--shadow-md)',
  cardHover: 'var(--shadow-lg)',
}

const inputCls = 'create-input'
const inputStyle = {
  width: '100%', padding: '13px 16px', borderRadius: 12,
  border: `1.5px solid ${L.border}`, background: L.surfaceAlt,
  fontSize: 15, color: L.text, boxSizing: 'border-box',
  outline: 'none', fontFamily: 'inherit',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}
const taStyle = { ...inputStyle, resize: 'vertical', lineHeight: 1.65 }

function Lbl({ children, optional }) {
  return (
    <div style={{ fontSize: 11.5, fontWeight: 700, color: L.textFaint, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 9, display: 'flex', gap: 7, alignItems: 'center' }}>
      {children}
      {optional && <span style={{ fontSize: 10, fontWeight: 500, color: L.textFaint, textTransform: 'none', letterSpacing: 0 }}>optional</span>}
    </div>
  )
}

// ── Animated floating cards (same feel as Landing) ────────────
function FloatingCards() {
  const [srcs, setSrcs] = useState(() => [ALL_IMGS[0], ALL_IMGS[2], ALL_IMGS[3], ALL_IMGS[5]])
  const [fading, setFading] = useState([false, false, false, false])

  useEffect(() => {
    let alive = true
    function tick() {
      if (!alive) return
      const i = Math.floor(Math.random() * CARD_CONFIG.length)
      setFading(p => { const n = [...p]; n[i] = true; return n })
      setTimeout(() => {
        if (!alive) return
        setSrcs(p => {
          const current = p[i]
          const shown = p.filter((_, idx) => idx !== i)
          const opts = ALL_IMGS.filter(s => !shown.includes(s) && s !== current)
          const next = [...p]; next[i] = opts[Math.floor(Math.random() * opts.length)]; return next
        })
        setFading(p => { const n = [...p]; n[i] = false; return n })
      }, 700)
    }
    const id = setInterval(tick, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  return (
    <>
      {CARD_CONFIG.map((c, i) => (
        <div key={i} className="create-bg-card" style={{
          position: 'absolute', top: c.top,
          ...(c.left ? { left: c.left } : { right: c.right }),
          width: c.w, transform: `rotate(${c.rot})`,
          opacity: 0, '--t-op': c.op,
          animation: `cAppear 0.9s ease ${c.delay + 0.2}s forwards`,
          pointerEvents: 'none', zIndex: 0,
        }}>
          <div style={{
            animation: `cFloat ${c.period}s ease-in-out ${c.delay}s infinite, cSway ${c.sway}s ease-in-out ${c.delay * 0.6}s infinite`,
            borderRadius: 18, overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.04)',
            opacity: fading[i] ? 0 : 1, transition: 'opacity 0.7s ease',
          }}>
            <img src={srcs[i]} alt="" style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' }} />
          </div>
        </div>
      ))}
    </>
  )
}

// ── Step indicator ────────────────────────────────────────────
function StepIndicator({ current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 52 }}>
      {STEPS.map((label, i) => {
        const n = i + 1; const done = n < current; const active = n === current
        return (
          <div key={n} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%', fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: done ? 'linear-gradient(135deg,#EC4899,#8B5CF6)' : active ? 'var(--text-primary)' : L.surfaceAlt,
                color: done ? '#fff' : active ? 'var(--bg)' : L.textFaint,
                border: done || active ? 'none' : `1.5px solid ${L.border}`,
                transition: 'all 0.25s',
                boxShadow: active ? '0 0 0 5px rgba(139,92,246,0.12)' : 'none',
              }}>{done ? '✓' : n}</div>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', color: active ? L.text : L.textFaint, whiteSpace: 'nowrap', transition: 'color 0.2s' }}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 1.5, background: done ? 'linear-gradient(90deg,#EC4899,#8B5CF6)' : L.border, margin: '0 6px', marginBottom: 22, transition: 'background 0.3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Basics ────────────────────────────────────────────
function Step1({ data, set, ageErrorPulse }) {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8, lineHeight: 1.1 }}>Name your influencer</h2>
        <p style={{ fontSize: 15, color: L.textSub, lineHeight: 1.55 }}>Start with the basics — you can always refine later.</p>
      </div>

      <div style={{ marginBottom: 22 }}>
        <Lbl>Name</Lbl>
        <input className={inputCls} style={inputStyle} value={data.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Luna Rose" autoFocus />
      </div>

      <div style={{ marginBottom: 22 }}>
        <Lbl>Gender</Lbl>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[
            { g: 'Female',     color: '#EC4899', glow: 'rgba(236,72,153,0.10)', icon: '♀' },
            { g: 'Male',       color: '#3B82F6', glow: 'rgba(59,130,246,0.10)',  icon: '♂' },
            { g: 'Non-binary', color: '#8B5CF6', glow: 'rgba(139,92,246,0.10)', icon: '⚧' },
          ].map(({ g, color, glow, icon }) => {
            const on = data.gender === g
            return (
              <button key={g} onClick={() => set('gender', g)} style={{
                padding: '15px 10px', borderRadius: 14, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                border: `1.5px solid ${on ? color : L.border}`,
                background: on ? glow : L.surface,
                color: on ? color : L.textSub,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                boxShadow: on ? L.card : 'none',
                transition: 'all 0.18s',
              }}>
                <span style={{ fontSize: 20, opacity: on ? 1 : 0.3, transition: 'opacity 0.15s' }}>{icon}</span>
                {g}
              </button>
            )
          })}
        </div>
      </div>

      <div style={{ marginBottom: data.age !== '' && Number(data.age) < 18 ? 12 : 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 14 }}>
          <div>
            <Lbl>Age</Lbl>
            <input className={inputCls} style={inputStyle} type="text" inputMode="numeric" pattern="[0-9]*" value={data.age} onChange={e => set('age', e.target.value.replace(/[^0-9]/g, ''))} placeholder="e.g. 24" />
          </div>
          <div />
        </div>
        {data.age !== '' && Number(data.age) < 18 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '9px 13px', borderRadius: 10,
            background: ageErrorPulse ? 'rgba(255,59,48,0.10)' : 'rgba(255,59,48,0.05)',
            border: `1px solid ${ageErrorPulse ? 'rgba(255,59,48,0.35)' : 'rgba(255,59,48,0.14)'}`,
            animation: ageErrorPulse ? 'agePulse 0.4s ease' : 'none',
            transition: 'background 0.2s, border-color 0.2s',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF3B30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{ fontSize: 12.5, color: '#FF3B30', fontWeight: 500 }}>Influencer must be 18 or older.</span>
          </div>
        )}
      </div>

      <div>
        <Lbl>Niche <span style={{ fontSize: 10, fontWeight: 500, color: L.textFaint, textTransform: 'none', letterSpacing: 0 }}>pick all that apply</span></Lbl>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {NICHES.map(n => {
            const on = (data.niches || []).includes(n)
            return (
              <button key={n} onClick={() => {
                const cur = data.niches || []
                set('niches', on ? cur.filter(x => x !== n) : [...cur, n])
              }} style={{
                padding: '8px 17px', borderRadius: 22, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: `1.5px solid ${on ? '#8B5CF6' : L.border}`,
                background: on ? 'rgba(139,92,246,0.09)' : L.surface,
                color: on ? '#7C3AED' : L.textSub,
                transition: 'all 0.15s',
                boxShadow: on ? '0 0 0 1px #8B5CF655' : 'none',
              }}>{n}</button>
            )
          })}
        </div>
        {(data.niches || []).includes('Other') && (
          <input className={inputCls} style={{ ...inputStyle, marginTop: 10 }} value={data.nicheCustom} onChange={e => set('nicheCustom', e.target.value)} placeholder="Describe their niche…" />
        )}
      </div>
    </div>
  )
}

// ── Reusable single-image upload slot ────────────────────────
function RefSlot({ label, hint, value, onChange }) {
  const fileRef = useRef()
  const [dragging, setDragging] = useState(false)
  const dragCounter = useRef(0)

  function processFile(f) {
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader()
    r.onload = ev => compressImage(ev.target.result).then(onChange).catch(console.error)
    r.readAsDataURL(f)
  }

  function handleFile(e) {
    const f = e.target.files[0]; if (!f) return; e.target.value = ''
    processFile(f)
  }

  function onDragEnter(e) {
    e.preventDefault(); dragCounter.current++; setDragging(true)
  }
  function onDragLeave(e) {
    e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false)
  }
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e) {
    e.preventDefault(); dragCounter.current = 0; setDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  const dropProps = { onDragEnter, onDragLeave, onDragOver, onDrop }

  return (
    <div style={{ flex: 1 }}>
      <Lbl optional>{label}</Lbl>
      {value ? (
        <div
          {...dropProps}
          style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', aspectRatio: '3/4', boxShadow: L.card, outline: dragging ? '2.5px dashed #8B5CF6' : 'none', transition: 'outline 0.15s' }}
        >
          <img src={value} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: dragging ? 0.5 : 1, transition: 'opacity 0.15s' }} />
          {dragging && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(139,92,246,0.15)', pointerEvents: 'none' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>Drop to replace</span>
            </div>
          )}
          <button
            onClick={() => onChange(null)}
            style={{ position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.60)', color: '#fff', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
          >×</button>
        </div>
      ) : (
        <div
          {...dropProps}
          onClick={() => fileRef.current.click()}
          style={{
            aspectRatio: '3/4', borderRadius: 16, cursor: 'pointer', transition: 'all 0.18s', padding: 16,
            border: dragging ? '2px dashed #8B5CF6' : '2px dashed var(--border)',
            background: dragging ? 'rgba(139,92,246,0.08)' : L.surfaceAlt,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
          onMouseEnter={e => { if (!dragging) { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.50)'; e.currentTarget.style.background = 'rgba(139,92,246,0.06)' } }}
          onMouseLeave={e => { if (!dragging) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = L.surfaceAlt } }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 12, background: L.surface, boxShadow: L.card, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: dragging ? '#8B5CF6' : L.textFaint, transition: 'color 0.15s' }}>
            {dragging ? '↓' : '+'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: dragging ? '#7C3AED' : L.textSub, marginBottom: 3, transition: 'color 0.15s' }}>
              {dragging ? 'Drop image' : 'Upload photo'}
            </div>
            <div style={{ fontSize: 12, color: L.textFaint, lineHeight: 1.4 }}>{hint}</div>
          </div>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ── Step 2: References ────────────────────────────────────────
function Step2({ data, set }) {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8, lineHeight: 1.1 }}>Add references</h2>
        <p style={{ fontSize: 15, color: L.textSub, lineHeight: 1.55 }}>Both optional — the more you give, the closer the result.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <RefSlot
          label="Face reference"
          hint="A photo of the face you want"
          value={data.faceRef}
          onChange={v => set('faceRef', v)}
        />
        <RefSlot
          label="Style reference"
          hint="Outfit, aesthetic, or vibe inspo"
          value={data.styleRef}
          onChange={v => set('styleRef', v)}
        />
      </div>
    </div>
  )
}

// ── Step 3: Story ─────────────────────────────────────────────
function Step3({ data, set }) {
  const pv = data.personality ?? 50
  const mood = pv < 35 ? 'Thoughtful & introspective' : pv > 65 ? 'Bold & outgoing' : 'Balanced & versatile'
  const moodColor = pv < 35 ? '#3B82F6' : pv > 65 ? '#EC4899' : '#8B5CF6'

  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8, lineHeight: 1.1 }}>Who are they?</h2>
        <p style={{ fontSize: 15, color: L.textSub, lineHeight: 1.55 }}>Their story, vibe, what makes them different.</p>
      </div>

      <div style={{ background: L.surface, borderRadius: 18, padding: '22px', boxShadow: L.card, marginBottom: 16 }}>
        <Lbl>Backstory</Lbl>
        <textarea
          className={inputCls}
          value={data.backstory}
          onChange={e => set('backstory', e.target.value)}
          placeholder="Their background, what drives them, what makes them unique…"
          rows={5}
          style={{ ...taStyle, background: L.surfaceAlt, marginBottom: 0 }}
        />
      </div>

      <div style={{ background: L.surface, borderRadius: 18, padding: '22px', boxShadow: L.card }}>
        <Lbl>Personality</Lbl>
        <input
          type="range" min={0} max={100} value={pv}
          onChange={e => set('personality', Number(e.target.value))}
          style={{ width: '100%', appearance: 'none', WebkitAppearance: 'none', height: 6, borderRadius: 3, outline: 'none', cursor: 'pointer', marginBottom: 14, background: `linear-gradient(to right, #3B82F6 0%, ${moodColor} ${pv}%, var(--bg-tertiary) ${pv}%, var(--bg-tertiary) 100%)`, transition: 'background 0.15s' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: L.textFaint }}>Introvert</span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: moodColor, padding: '5px 14px', borderRadius: 22, background: `${moodColor}12`, border: `1.5px solid ${moodColor}25`, transition: 'all 0.2s' }}>{mood}</span>
          <span style={{ fontSize: 12, color: L.textFaint }}>Extrovert</span>
        </div>
      </div>
    </div>
  )
}

// ── Step 4: Look ──────────────────────────────────────────────
function Step4({ data, set }) {
  return (
    <div>
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8, lineHeight: 1.1 }}>How do they look?</h2>
        <p style={{ fontSize: 15, color: L.textSub, lineHeight: 1.55 }}>Physical features and aesthetic — this shapes the AI generation.</p>
      </div>

      <div style={{ background: L.surface, borderRadius: 18, padding: '22px', boxShadow: L.card, marginBottom: 16 }}>
        <Lbl>Physical description</Lbl>
        <textarea className={inputCls} value={data.physicalDesc} onChange={e => set('physicalDesc', e.target.value)} placeholder="Hair color, length, texture. Eye color. Skin tone. Facial features…" rows={4} style={{ ...taStyle, background: L.surfaceAlt, marginBottom: 0 }} />
      </div>

      <div style={{ background: L.surface, borderRadius: 18, padding: '22px', boxShadow: L.card }}>
        <Lbl optional>Aesthetic vibe</Lbl>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {VIBE_OPTIONS.map(v => {
            const on = data.vibeWords?.includes(v.id)
            return (
              <button key={v.id} onClick={() => {
                const cur = data.vibeWords || []
                set('vibeWords', on ? cur.filter(x => x !== v.id) : [...cur, v.id])
              }} style={{
                padding: '11px 13px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                background: on ? 'rgba(139,92,246,0.09)' : L.surfaceAlt,
                border: `1.5px solid ${on ? '#8B5CF6' : L.border}`,
                transition: 'all 0.15s',
                boxShadow: on ? '0 0 0 1px #8B5CF655' : 'none',
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: on ? '#7C3AED' : L.text, marginBottom: 3 }}>
                    <span style={{ marginRight: 6 }}>{v.icon}</span>{v.label}
                  </div>
                  <div style={{ fontSize: 11, color: on ? 'rgba(124,58,237,0.6)' : L.textFaint, lineHeight: 1.35 }}>{v.sub}</div>
                </div>
                {on && (
                  <div style={{ width: 17, height: 17, borderRadius: '50%', background: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                    <svg width="8" height="7" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Fun loading screen ────────────────────────────────────────
const LOADING_MESSAGES = [
  'this will take 3 to 6 minutes. go touch grass then come back.',
  'sculpting cheekbones to dangerous levels...',
  "still going. your future influencer's net worth is loading.",
  'making the lighting criminally flattering...',
  'this takes like 3 to 6 min. patience is an underrated aesthetic.',
  'configuring the jaw to cheekbone ratio...',
  'your influencer will earn more than you. probably.',
  'adding invisible botox to the render...',
  '3 to 6 minutes is the price of perfection. worth it.',
  'your future brand deals are being pre-approved...',
  'making sure the outfit costs more than your rent...',
  'still rendering. the algorithm is already impressed.',
  "they're basically already famous btw.",
  "calibrating the effortless look. it takes effort.",
  'your influencer just declined a free product collab.',
  "in a few minutes you'll have a new business partner.",
  'making them look hot. you can thank us later.',
  'Running a vibe check. Results: immaculate.',
  'Teaching the algorithm what good bone structure looks like.',
  'Your influencer is already planning their Coachella fits.',
  'Finding the angle that says "I woke up like this" when they absolutely did not.',
  'Computing exactly how unbothered they should look.',
  'Adding the kind of natural glow that takes 45 minutes to achieve.',
  'Generating the type of face that stops a scroll mid-thumb.',
  'Deciding exactly how expensive they should look without trying.',
  'We could rush this. We will not.',
  'Fine-tuning the "didn\'t even try" energy. It requires a lot of trying.',
  'Selecting the perfect posture that says "I own this sidewalk."',
  'Rendering confidence on a cellular level.',
  'Their first brand deal is hypothetically already in the DMs.',
  'Teaching the outfit to look expensive without showing a single logo.',
  'Still going. The best things take time. So does pasta. Both worth it.',
  'Adding a hint of "I just got back from somewhere you\'d love."',
  'Finalizing the expression that says "seen it, been there, not impressed."',
  'Choosing between three poses. All of them unreasonably good.',
  'Making sure the lighting is doing what it\'s supposed to do. Which is a lot.',
  'Calibrating the collarbone situation.',
  'Your influencer is already two seasons ahead of the trend cycle.',
  'Running a final check to make sure they look effortlessly rich.',
  'The algorithm just followed them. That\'s how good this is going.',
  'Technically this could go faster. Technically you could also eat gas station sushi.',
  'Almost there. Well. Almost almost there.',
  'They look so good right now and you haven\'t even seen them yet.',
  'Measuring the exact ratio of approachable to aspirational.',
  'Your influencer just declined an interview. Very on brand.',
  'Adding the kind of warmth that makes strangers want to follow a stranger.',
  'Currently deciding between two lighting setups that are both perfect.',
  'Adjusting the hair so it moves in a breeze that doesn\'t exist.',
  'Making sure the skin texture is real enough to make people uncomfortable.',
  'Your future influencer already has opinions about your fridge.',
  'Setting the jaw angle to "I have a morning routine and it shows."',
  'Still rendering. This is not a drill. This is art.',
  'Giving them the kind of face that gets free upgrades at hotels.',
  'Adding just enough imperfection to make it feel embarrassingly real.',
  'They\'re basically already in a mood board somewhere.',
  'Making the outfit say "money" without saying a single brand name.',
  'Hang on. The cheekbones needed a second opinion.',
]

const FAKE_WAYPOINTS = [
  [0, 0], [12000, 14], [25000, 27], [38000, 24],
  [52000, 38], [70000, 51], [88000, 49], [105000, 61],
  [122000, 69], [140000, 65], [158000, 74], [180000, 80],
  [205000, 78], [225000, 85], [250000, 89], [300000, 93], [360000, 95],
]

function GeneratingScreen({ genProgress }) {
  const [fakeProgress, setFakeProgress] = useState(0)
  const [isDipping, setIsDipping] = useState(false)
  const [msgIdx, setMsgIdx] = useState(0)
  const [msgVisible, setMsgVisible] = useState(true)
  const startRef = useRef(Date.now())
  const prevRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      if (genProgress >= 100) { setFakeProgress(100); setIsDipping(false); return }
      const elapsed = Date.now() - startRef.current
      let lo = FAKE_WAYPOINTS[0], hi = FAKE_WAYPOINTS[FAKE_WAYPOINTS.length - 1]
      for (let i = 0; i < FAKE_WAYPOINTS.length - 1; i++) {
        if (elapsed >= FAKE_WAYPOINTS[i][0] && elapsed < FAKE_WAYPOINTS[i + 1][0]) {
          lo = FAKE_WAYPOINTS[i]; hi = FAKE_WAYPOINTS[i + 1]; break
        }
      }
      const span = hi[0] - lo[0]
      const t = span === 0 ? 1 : Math.min((elapsed - lo[0]) / span, 1)
      const val = Math.round(lo[1] + (hi[1] - lo[1]) * t)
      setIsDipping(val < prevRef.current - 0.5)
      prevRef.current = val
      setFakeProgress(val)
    }, 700)
    return () => clearInterval(id)
  }, [genProgress])

  useEffect(() => {
    const id = setInterval(() => {
      setMsgVisible(false)
      setTimeout(() => { setMsgIdx(i => (i + 1) % LOADING_MESSAGES.length); setMsgVisible(true) }, 350)
    }, 6500)
    return () => clearInterval(id)
  }, [])

  const barGradient = isDipping ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : 'linear-gradient(90deg,#EC4899,#8B5CF6)'
  const textGradient = isDipping ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'linear-gradient(135deg,#EC4899,#8B5CF6)'
  const statusLabel = isDipping ? 'recalibrating...' : fakeProgress >= 88 ? 'almost there...' : 'generating...'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg,#EC4899,#8B5CF6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'genSpin 4s linear infinite',
          boxShadow: '0 4px 18px rgba(139,92,246,0.45)',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: L.text }}>Creating your influencer</div>
          <div style={{ fontSize: 12, color: L.textFaint, marginTop: 2 }}>3–6 minutes — worth every second</div>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <span style={{
          display: 'inline-block', fontSize: 80, fontWeight: 900, lineHeight: 1, letterSpacing: '-4px',
          color: isDipping ? '#F59E0B' : '#8B5CF6', transition: 'color 0.5s',
        }}>{fakeProgress}%</span>
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase',
          color: isDipping ? '#F59E0B' : L.textFaint, marginTop: 6, transition: 'color 0.4s',
        }}>{statusLabel}</div>
      </div>

      <div style={{ marginBottom: 22 }}>
        <div style={{ height: 8, borderRadius: 6, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 6, background: barGradient, width: `${fakeProgress}%`,
            transition: isDipping ? 'width 1.4s ease, background 0.5s' : 'width 0.9s ease, background 0.5s',
          }} />
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 26, minHeight: 20 }}>
        <span style={{
          fontSize: 13.5, color: L.textSub, fontStyle: 'italic',
          opacity: msgVisible ? 1 : 0, transition: 'opacity 0.35s ease',
        }}>{LOADING_MESSAGES[msgIdx]}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            aspectRatio: '2/3', borderRadius: 18, background: 'var(--bg-tertiary)',
            border: `1.5px solid ${L.border}`, position: 'relative', overflow: 'hidden',
            animation: `shimmer 1.8s ease-in-out ${i * 0.28}s infinite`,
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.06) 50%,transparent 60%)',
              animation: `shimmerSlide 2.4s ease-in-out ${i * 0.4}s infinite`,
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shared download helper ────────────────────────────────────
async function downloadImage(url, index) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const ext = blob.type.includes('png') ? 'png' : 'jpg'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `influencer-look-${index + 1}.${ext}`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    URL.revokeObjectURL(a.href)
  } catch {
    window.open(url, '_blank')
  }
}

// ── Full-size lightbox ────────────────────────────────────────
function Lightbox({ url, index, onClose }) {
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  async function dl() {
    setDownloading(true)
    await downloadImage(url, index)
    setDownloading(false)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.18s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'relative', display: 'flex' }}>
        <img src={url} alt="" style={{ maxHeight: '90vh', maxWidth: '88vw', borderRadius: 18, display: 'block', objectFit: 'contain', boxShadow: '0 32px 96px rgba(0,0,0,0.6)' }} />
        <button onClick={onClose} style={{
          position: 'absolute', top: -14, right: -14,
          width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
          color: '#fff', fontSize: 19, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(10px)',
        }}>×</button>
        <button onClick={dl} style={{
          position: 'absolute', bottom: 14, right: 14,
          padding: '9px 16px', borderRadius: 10,
          background: 'rgba(0,0,0,0.68)', border: '1px solid rgba(255,255,255,0.16)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 7,
          cursor: 'pointer', backdropFilter: 'blur(12px)',
        }}>
          {downloading
            ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          }
          Download
        </button>
      </div>
    </div>
  )
}

// ── Single variation card ─────────────────────────────────────
function VariationCard({ url, selected, gc, onSelect, index }) {
  const [hovered, setHovered] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function dl(e) {
    e.stopPropagation()
    if (downloading) return
    setDownloading(true)
    await downloadImage(url, index)
    setDownloading(false)
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
      style={{
        aspectRatio: '2/3', borderRadius: 18, overflow: 'hidden', cursor: 'pointer',
        border: `2.5px solid ${selected ? gc : hovered ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: hovered
          ? '0 24px 72px rgba(0,0,0,0.38)'
          : selected
          ? `0 0 0 3px ${gc}35, 0 16px 48px rgba(0,0,0,0.22)`
          : L.card,
        position: 'relative',
        zIndex: hovered ? 20 : selected ? 2 : 1,
        transition: 'transform 0.28s cubic-bezier(0.34,1.42,0.64,1), box-shadow 0.22s, border-color 0.15s',
        transform: hovered ? 'scale(1.18)' : selected ? 'scale(1.03)' : 'scale(1)',
        transformOrigin: 'top center',
      }}
    >
      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />

      {/* Number badge — always visible */}
      {!selected && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 24, height: 24, borderRadius: 8,
          background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.88)',
        }}>{index + 1}</div>
      )}

      {/* Hover gradient + action buttons */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%',
        background: 'linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 100%)',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', pointerEvents: 'none',
      }} />

      {hovered && (
        <button onClick={dl} title="Download" style={{
          position: 'absolute', bottom: 10, right: 10,
          width: 34, height: 34, borderRadius: 10,
          background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.18)',
          backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', cursor: 'pointer',
        }}>
          {downloading
            ? <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          }
        </button>
      )}

      {/* Selected checkmark */}
      {selected && (
        <div style={{
          position: 'absolute', top: 10, left: 10,
          width: 26, height: 26, borderRadius: 8,
          background: gc, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 2px 12px ${gc}66`,
        }}>
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
    </div>
  )
}

// ── Step 5: Generate ──────────────────────────────────────────
function Step5({ data, onFinish, onReset, hfConnected, onConnected }) {
  const [phase, setPhase] = useState('idle')
  const [genProgress, setGenProgress] = useState(0)
  const [genError, setGenError] = useState(null)
  const [variations, setVariations] = useState([])
  const [selected, setSelected] = useState(null)
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [connectingHF, setConnectingHF] = useState(false)
  const gc = gColor(data.gender)

  async function generate() {
    setPhase('generating'); setGenError(null); setVariations([]); setSelected(null); setGenProgress(5); setLightboxUrl(null)
    try {
      const prompts = buildThreeVariationPrompts(data)
      const urls = await generateThreeImages({ prompts, aspectRatio: '9:16', faceRef: data.faceRef || null, styleRef: data.styleRef || null, onProgress: setGenProgress })
      setVariations(urls.slice(0, 3))
      setPhase('done')
    } catch (e) {
      setGenError(e.message); setPhase('error')
    }
  }

  const displayName = data.name?.trim() || 'your influencer'

  async function doConnect() {
    setConnectingHF(true)
    try {
      await startHiggsfieldOAuthPopup()
      onConnected?.()
    } catch (e) {
      if (e.message !== 'cancelled') alert('Failed to connect Higgsfield: ' + e.message)
    } finally {
      setConnectingHF(false)
    }
  }

  if (!hfConnected) {
    return (
      <div>
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8 }}>Almost there</h2>
          <p style={{ fontSize: 15, color: L.textSub }}>Connect your Higgsfield account first.</p>
        </div>
        <div style={{ background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.18)', borderRadius: 18, padding: '24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#7C3AED', marginBottom: 8 }}>Connect Higgsfield</div>
          <div style={{ fontSize: 14, color: L.textSub, marginBottom: 18, lineHeight: 1.5 }}>Connect your Higgsfield account to start generating images.</div>
          <button
            onClick={doConnect}
            disabled={connectingHF}
            style={{ padding: '10px 22px', borderRadius: 10, background: 'linear-gradient(135deg,#EC4899,#8B5CF6)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: connectingHF ? 'default' : 'pointer', opacity: connectingHF ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {connectingHF ? (
              <>
                <div style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.7s linear infinite' }} />
                Connecting…
              </>
            ) : 'Connect Higgsfield'}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {phase !== 'generating' && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-1px', color: L.text, marginBottom: 8, lineHeight: 1.1 }}>
            {phase === 'done' ? `Which look is ${displayName}?` : 'Generate your influencer'}
          </h2>
          <p style={{ fontSize: 15, color: L.textSub, lineHeight: 1.55 }}>
            {phase === 'idle' && "We'll build 3 distinct looks — different poses, scenes, and outfits."}
            {phase === 'done' && 'Hover any look to zoom in. Click to pick your favourite.'}
          </p>
        </div>
      )}

      {phase === 'idle' && (
        <button onClick={generate} style={{
          width: '100%', padding: '18px', borderRadius: 14, fontSize: 16, fontWeight: 700,
          background: 'linear-gradient(135deg,#EC4899,#8B5CF6)', color: '#fff',
          border: 'none', cursor: 'pointer', letterSpacing: '-0.2px',
          boxShadow: '0 4px 32px rgba(139,92,246,0.40)', transition: 'transform 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 44px rgba(139,92,246,0.55)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 32px rgba(139,92,246,0.40)' }}
        >Generate 3 looks →</button>
      )}

      {phase === 'generating' && <GeneratingScreen genProgress={genProgress} />}

      {phase === 'error' && (
        <div>
          <div style={{ padding: '16px 20px', borderRadius: 14, background: 'rgba(255,59,48,0.06)', border: '1.5px solid rgba(255,59,48,0.18)', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#FF3B30', marginBottom: 5 }}>Generation failed</div>
            <div style={{ fontSize: 13, color: '#FF6B6B', lineHeight: 1.5 }}>{genError}</div>
          </div>
          <button onClick={generate} style={{ width: '100%', padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: L.surfaceAlt, color: L.text, border: `1.5px solid ${L.border}`, cursor: 'pointer' }}>Try again →</button>
        </div>
      )}

      {phase === 'done' && variations.length > 0 && (
        <div>
          {/* Image grid */}
          <div style={{ margin: variations.length === 1 ? '0 auto' : '0 -230px', maxWidth: variations.length === 1 ? 320 : 'none', marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${variations.length},1fr)`, gap: 16 }}>
              {variations.map((url, i) => (
                <VariationCard
                  key={i} url={url} selected={selected === i} gc={gc}
                  onSelect={() => setSelected(i)} index={i}
                />
              ))}
            </div>
          </div>

          {/* Primary CTA — always visible, morphs on selection */}
          <button
            onClick={selected !== null ? () => onFinish(variations, selected) : undefined}
            style={{
              width: '100%', padding: '17px', borderRadius: 14, fontSize: 15, fontWeight: 700,
              border: 'none', cursor: selected !== null ? 'pointer' : 'default',
              marginBottom: 10,
              background: selected !== null
                ? `linear-gradient(135deg,${gc},${gc}bb)`
                : 'var(--bg-tertiary)',
              color: selected !== null ? '#fff' : L.textFaint,
              boxShadow: selected !== null ? `0 4px 28px ${gc}45` : 'none',
              transition: 'all 0.25s ease',
              transform: 'translateY(0)',
            }}
            onMouseEnter={e => { if (selected !== null) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 8px 38px ${gc}65` } }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = selected !== null ? `0 4px 28px ${gc}45` : 'none' }}
          >
            {selected !== null ? `Create ${displayName}'s profile →` : 'Select a look to continue'}
          </button>

          {/* Secondary actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onReset} style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: 'transparent', color: L.textFaint,
              border: `1.5px solid ${L.border}`, cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = L.textSub; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.30)' }}
              onMouseLeave={e => { e.currentTarget.style.color = L.textFaint; e.currentTarget.style.borderColor = L.border }}
            >Start over</button>
            <button onClick={generate} style={{
              flex: 1, padding: '11px', borderRadius: 11, fontSize: 13, fontWeight: 600,
              background: 'rgba(139,92,246,0.07)', color: '#7C3AED',
              border: '1.5px solid rgba(139,92,246,0.20)', cursor: 'pointer', transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.13)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.40)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(139,92,246,0.07)'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.20)' }}
            >Regenerate</button>
          </div>
        </div>
      )}

      {lightboxUrl && (
        <Lightbox url={lightboxUrl} index={0} onClose={() => setLightboxUrl(null)} />
      )}
    </div>
  )
}

// ── Main wizard ───────────────────────────────────────────────
export default function Create() {
  const navigate = useNavigate()
  const [, setInfluencers] = useInfluencers()
  const [step, setStep] = useState(1)
  const [data, setData] = useState({
    name: '', gender: '', age: '', niches: [], nicheCustom: '',
    backstory: '', personality: 50,
    physicalDesc: '', vibeWords: [], faceRef: null, styleRef: null,
  })

  const [shakeContinue, setShakeContinue] = useState(false)
  const [ageErrorPulse, setAgeErrorPulse] = useState(false)
  const [hfConnected, setHfConnected] = useState(isHFConnected)

  function set(k, v) { setData(prev => ({ ...prev, [k]: v })) }
  function canAdvance() { return step === 1 ? !!data.name.trim() : true }

  function handleContinue() {
    if (step === 1 && data.age !== '' && Number(data.age) < 18) {
      setShakeContinue(true)
      setAgeErrorPulse(true)
      setTimeout(() => setShakeContinue(false), 500)
      setTimeout(() => setAgeErrorPulse(false), 600)
      return
    }
    setStep(s => s + 1)
  }

  async function connectFromBanner() {
    try {
      await startHiggsfieldOAuthPopup()
      setHfConnected(true)
    } catch (e) {
      if (e.message !== 'cancelled') alert('Failed to connect: ' + e.message)
    }
  }

  function resetAll() {
    setStep(1)
    setData({ name: '', gender: '', age: '', niches: [], nicheCustom: '', backstory: '', personality: 50, physicalDesc: '', vibeWords: [], faceRef: null, styleRef: null })
  }

  function finish(variations, selectedIdx) {
    const newInf = {
      id: generateId(), name: data.name.trim(), gender: data.gender, age: data.age,
      type: 'Influencer', createdAt: Date.now(),
      niche: (data.niches || []).filter(n => n !== 'Other').join(', ') || '',
      niches: data.niches || [], nicheCustom: data.nicheCustom,
      backstory: data.backstory, introExtrovert: data.personality,
      physicalDesc: data.physicalDesc, vibeWords: data.vibeWords,
      mainImage: variations[selectedIdx] || null,
      characterSheetImage: null, closeUpImage1: null, closeUpImage2: null,
      palette: [], voice: '', dreamBrands: '', contentPillars: [],
      videoUrls: [], scripts: [], homeImages: [],
      wardrobeSlots: [
        { id: generateId(), name: 'Wardrobe 1', image: null },
        { id: generateId(), name: 'Wardrobe 2', image: null },
        { id: generateId(), name: 'Wardrobe 3', image: null },
      ],
      brandDealImages: [],
    }
    setInfluencers(prev => [...prev, newInf])
    navigate('/influencers')
  }

  const isLastStep = step === STEPS.length

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', background: L.bg, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>

      {/* Subtle atmosphere orbs */}
      <div style={{ position: 'absolute', width: 700, height: 700, top: '-20%', left: '-14%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 65%)', pointerEvents: 'none', animation: 'orbA 18s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 600, height: 600, top: '-14%', right: '-12%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 65%)', pointerEvents: 'none', animation: 'orbB 22s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, bottom: '-20%', left: '22%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,0.06) 0%, transparent 65%)', pointerEvents: 'none', animation: 'orbC 26s ease-in-out infinite' }} />

      <FloatingCards />

      {/* Edge vignette to blend cards into bg */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 42%, transparent 28%, var(--bg) 100%)', pointerEvents: 'none', zIndex: 1 }} />

      <div style={{ width: '100%', maxWidth: 548, padding: '40px 24px 100px', position: 'relative', zIndex: 2 }}>
        <StepIndicator current={step} />

        {!hfConnected && step < 5 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 15px', borderRadius: 12, background: 'rgba(139,92,246,0.06)', border: '1.5px solid rgba(139,92,246,0.14)', marginBottom: 32 }}>
            <span style={{ fontSize: 13 }}>🔗</span>
            <span style={{ fontSize: 13, color: L.textSub, flex: 1 }}>Connect your Higgsfield account first.</span>
            <button onClick={connectFromBanner} style={{ fontSize: 12, fontWeight: 700, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', padding: 0 }}>Connect →</button>
          </div>
        )}

        {step === 1 && <Step1 data={data} set={set} ageErrorPulse={ageErrorPulse} />}
        {step === 2 && <Step2 data={data} set={set} />}
        {step === 3 && <Step3 data={data} set={set} />}
        {step === 4 && <Step4 data={data} set={set} />}
        {step === 5 && <Step5 data={data} onFinish={finish} onReset={resetAll} hfConnected={hfConnected} onConnected={() => setHfConnected(true)} />}

        {!isLastStep && (
          <div style={{ display: 'flex', gap: 10, marginTop: 36 }}>
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} style={{ flexShrink: 0, padding: '13px 22px', borderRadius: 12, border: `1.5px solid ${L.border}`, fontSize: 14, fontWeight: 600, color: L.textSub, background: L.surface, cursor: 'pointer', transition: 'all 0.15s', boxShadow: L.card }}
                onMouseEnter={e => { e.currentTarget.style.color = L.text; e.currentTarget.style.boxShadow = L.cardHover }}
                onMouseLeave={e => { e.currentTarget.style.color = L.textSub; e.currentTarget.style.boxShadow = L.card }}
              >← Back</button>
            )}
            <button onClick={handleContinue} disabled={!canAdvance()} style={{
              flex: 1, padding: '13px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700, border: 'none',
              background: canAdvance() ? 'linear-gradient(135deg,#EC4899,#8B5CF6)' : L.surfaceAlt,
              color: canAdvance() ? '#fff' : L.textFaint,
              boxShadow: canAdvance() ? '0 4px 22px rgba(139,92,246,0.35)' : 'none',
              transition: 'all 0.2s', cursor: canAdvance() ? 'pointer' : 'default',
              animation: shakeContinue ? 'shake 0.45s ease' : 'none',
            }}
              onMouseEnter={e => { if (canAdvance()) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 30px rgba(139,92,246,0.50)' } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = canAdvance() ? '0 4px 22px rgba(139,92,246,0.35)' : 'none' }}
            >{step === 4 ? 'Continue to Generate →' : 'Continue →'}</button>
          </div>
        )}

        {isLastStep && step > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 14 }}>
            <button onClick={() => setStep(s => s - 1)} style={{ padding: '11px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, color: L.textSub, background: 'transparent', border: `1.5px solid ${L.border}`, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(139,92,246,0.35)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = L.border; e.currentTarget.style.color = L.textSub }}
            >← Back</button>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 980px) { .create-bg-card { display: none !important; } }
        @keyframes orbA { 0%,100%{transform:translate(0,0)scale(1)} 40%{transform:translate(50px,-40px)scale(1.05)} 70%{transform:translate(-30px,28px)scale(0.96)} }
        @keyframes orbB { 0%,100%{transform:translate(0,0)scale(1)} 50%{transform:translate(-38px,48px)scale(1.08)} }
        @keyframes orbC { 0%,100%{transform:translate(0,0)scale(1)} 35%{transform:translate(28px,-48px)scale(0.93)} 70%{transform:translate(-38px,18px)scale(1.06)} }
        @keyframes cFloat { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-16px)} }
        @keyframes cSway  { 0%,100%{transform:translateX(0px)} 25%{transform:translateX(5px)} 75%{transform:translateX(-4px)} }
        @keyframes cAppear { from{opacity:0} to{opacity:var(--t-op,0.45)} }
        @keyframes shimmer { 0%,100%{opacity:.45} 50%{opacity:.85} }
        @keyframes genSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes shimmerSlide { 0%{transform:translateX(-100%)} 100%{transform:translateX(250%)} }
        @keyframes shake { 0%,100%{transform:translateX(0)} 18%{transform:translateX(-7px)} 36%{transform:translateX(7px)} 54%{transform:translateX(-5px)} 72%{transform:translateX(5px)} 88%{transform:translateX(-2px)} }
        @keyframes agePulse { 0%{transform:scale(1)} 40%{transform:scale(1.015)} 100%{transform:scale(1)} }
        .create-input:focus { border-color: #8B5CF6 !important; box-shadow: 0 0 0 3px rgba(139,92,246,0.12) !important; background: var(--surface) !important; }
        .create-input::placeholder { color: var(--text-tertiary) !important; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:22px; height:22px; border-radius:50%; background:#fff; border:2.5px solid #8B5CF6; box-shadow:0 2px 8px rgba(0,0,0,0.18); cursor:pointer; transition:transform 0.1s, box-shadow 0.1s; }
        input[type=range]::-webkit-slider-thumb:active { transform:scale(1.15); box-shadow:0 0 0 5px rgba(139,92,246,0.18); }
      `}</style>
    </div>
  )
}
