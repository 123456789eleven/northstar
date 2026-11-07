// One small toast for a real win: a tick draws, the count rolls up, a glass ripple. It leaves by itself in about two
// seconds. Fires only on a real change after the first loaded state. Reduced motion: shown still, no ripple, no roll.
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useNumberRoll } from '../../../components/motion'
import { momentFor, type Base, type Moment } from './moment'
import { celebrate } from './feedback'
import { usePlayerState } from './playerContext'

const SHOW_MS = 2000
const STILL_MS = 2600

function Count({ done, total }: { done: number; total: number }) {
  const n = useNumberRoll(done, 500, Math.max(0, done - 1))
  return <span className="moment-count mono">{n} of {total}</span>
}

export function MomentHost() {
  const p = usePlayerState()
  const base = useRef<Base | null>(null)
  const seq = useRef(0)
  const [m, setM] = useState<Moment | null>(null)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (p.loading) return
    const found = momentFor(base.current, p)
    base.current = { done: p.questsDone, total: p.quests.length }
    if (!found) return
    celebrate('tick')
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
        <span className="moment-ripple" aria-hidden />
        <svg className="moment-tick" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path pathLength="1" d="M4.5 10.5l3.5 3.5 7.5-8" />
        </svg>
        <span className="moment-text">
          <span className="moment-title">{m.title} <Count done={m.done} total={m.total} /></span>
          <span className="moment-sub">{m.sub}</span>
        </span>
      </div>
    </div>
  )
}
