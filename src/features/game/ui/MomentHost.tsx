// One-second moments: a level-up (overall or a skill) or "Day cleared". The small constellation brightens once, then
// the card leaves. No confetti. Fires only on a real change after the first loaded state (never on page load, never
// on day rollover resets), never in Calm mode. Tap, Esc or the Close button skips it. Reduced motion: shown still.
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../../components/motion'
import { momentFor, type Base, type Moment } from './moment'
import { Constellation } from './Constellation'
import { celebrate } from './feedback'
import { usePlayerState } from './playerContext'


const SHOW_MS = 1000
const STILL_MS = 2200

export function MomentHost() {
  const p = usePlayerState()
  const base = useRef<Base | null>(null)
  const seq = useRef(0)
  const [m, setM] = useState<Moment | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (p.loading) return
    const next: Base = { level: p.level, skills: Object.fromEntries(p.skills.map((s) => [s.id, s.level])), cleared: p.cleared }
    const found = momentFor(base.current, p)
    base.current = next
    if (!found) return
    celebrate('double')
    setLeaving(false)
    setM({ id: ++seq.current, ...found })
  }, [p])

  useEffect(() => {
    if (!m) return
    const still = prefersReducedMotion()
    const t1 = window.setTimeout(() => setLeaving(true), still ? STILL_MS : SHOW_MS)
    const t2 = window.setTimeout(() => setM(null), (still ? STILL_MS : SHOW_MS) + 200)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setM(null) }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); window.removeEventListener('keydown', onKey) }
  }, [m])

  if (!m) return <div className="sr-only" role="status" aria-live="polite" />
  return (
    <div className="moment-layer">
      <div key={m.id} className={`moment ${leaving ? 'is-leaving' : ''}`} role="status" aria-live="polite" onClick={() => setM(null)}>
        <div className="moment-sky" aria-hidden><Constellation skills={p.skills} compact bright interactive={false} /></div>
        <div className="moment-text">
          <span className="moment-kicker">{m.kicker}</span>
          <span className="moment-title">{m.title}</span>
          <span className="moment-sub">{m.sub}</span>
        </div>
        <button type="button" className="icon-btn moment-skip" aria-label="Dismiss" onClick={(e) => { e.stopPropagation(); setM(null) }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </div>
    </div>
  )
}
