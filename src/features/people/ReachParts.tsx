// Park floor parts. WarmthHead: the circle's warmth as a small ring and one line (testid circle-warmth). ReachRow: one person
// who is waiting, with a Contacted button that slides the row out before the contact is logged.
import { useEffect, useRef, useState } from 'react'
import type { ISODate, Person } from '../../db'
import { prefersReducedMotion, useNumberRoll } from '../../components/motion'
import { usePopKey } from '../buildings/usePop'
import { Ring } from '../game/ui/Ring'
import { reachLine } from './starter'
import type { CircleWarmth } from './warmth'

/** The warmth line: "Your circle is 72% warm" with the inputs under it. The ring pops when the circle gets warmer. */
export function WarmthHead({ warmth, size = 56 }: { warmth: CircleWarmth; size?: number }) {
  const pct = warmth.pct
  const shown = useNumberRoll(pct ?? 0, 500)
  const pop = usePopKey(pct)
  if (pct === null) return null
  const { tracked, warm, cooling } = warmth
  const inputs = [`${warm} of ${tracked} inside their rhythm`, cooling > 0 ? `${cooling} cooling` : null].filter(Boolean).join(' · ')
  return (
    <div className="warm-head" data-testid="circle-warmth">
      <span key={pop} className={pop ? 'tick-pop' : ''} style={{ display: 'inline-flex' }}>
        <Ring value={pct / 100} size={size} stroke={5} tone="people" label={`Circle ${pct} percent warm`}>
          <span className="warm-ring-n mono">{shown}</span>
        </Ring>
      </span>
      <div className="warm-text">
        <h2 className="warm-title">Your circle is <span className="cw-pct mono" data-pct={pct}>{pct}%</span> warm</h2>
        <p className="warm-inputs">{inputs}</p>
      </div>
    </div>
  )
}

/** A person waiting to hear from you. Contacted slides the row out (reduced motion: straight away), then logs. */
export function ReachRow({ p, now, first, onOpen, onContacted }: { p: Person; now: ISODate; first?: boolean; onOpen: () => void; onContacted: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const go = () => {
    if (leaving) return
    if (prefersReducedMotion()) { onContacted(); return }
    setLeaving(true)
    timer.current = window.setTimeout(onContacted, 300)
  }
  return (
    <li className={`reach-row${leaving ? ' is-leaving' : ''}`}>
      <button type="button" className="reach-line" onClick={onOpen} data-testid={first ? 'reach-out' : undefined}>{reachLine(p, now)}</button>
      <button type="button" className="btn btn-sm" onClick={go} disabled={leaving} aria-label={`Contacted ${p.name} today`}>Contacted</button>
    </li>
  )
}
