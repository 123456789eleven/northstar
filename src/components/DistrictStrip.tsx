// Global primary navigation: the curved glass district strip along the bottom (same band as the Life map's), on phone and
// desktop. The active district is lit; a poppy dot means something there is behind or overdue. You sits in the top bar.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { today } from '../lib/dates'
import { useLifeMap } from '../features/lifemap/useLifeMap'
import { DISTRICTS, districtForPath, rememberPath, STRIP, stripTarget, type DistrictId } from './districts'
import { useStretch } from './useStretch'
import './city.css'
import './liquid-chrome.css'

/** Districts with something behind or overdue: Life map beacons for the five areas, overdue open tasks for Plan. */
export function useBehind(): Set<DistrictId> {
  const map = useLifeMap()
  const d = today()
  const overdue = useLiveQuery(() => db.tasks.where('due').below(d).filter((t) => t.status === 'open').count(), [d]) ?? 0
  const out = new Set<DistrictId>()
  for (const x of map?.districts ?? []) if (x.beacon) out.add(x.id)
  if (overdue > 0) out.add('plan')
  return out
}

/** The band outline in a 700 x 80 box (desktop rises 36 units at the middle, phone 20). */
const SHAPE = {
  desk: [[3, 26], [350, -10], [697, 26], [697, 70], [697, 78], [689, 78], [11, 78], [3, 78], [3, 70]],
  phone: [[2, 14], [350, -6], [698, 14], [698, 72], [698, 78], [692, 78], [8, 78], [2, 78], [2, 72]],
} as const

/** The band as a pixel path for `clip-path: path()`, so the real glass (backdrop blur) takes the curved shape. */
export function bandPath(w: number, h: number, phone: boolean): string {
  const p = (phone ? SHAPE.phone : SHAPE.desk).map(([x, y]) => `${Math.round((x * w) / 7) / 100} ${Math.round((y * h) / 0.8) / 100}`)
  return `M${p[0]} Q${p[1]} ${p[2]} L${p[3]} Q${p[4]} ${p[5]} L${p[6]} Q${p[7]} ${p[8]} Z`
}

/** Follows the band's top curve so labels sit on it (u = 0..1 across the strip). */
export const curveOffset = (u: number, depth: number) => Math.round(depth * (1 - 4 * u * (1 - u)))

export default function DistrictStrip({ phone }: { phone: boolean }) {
  const { pathname, search } = useLocation()
  const current = districtForPath(pathname)
  const behind = useBehind()
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  // Recorded during render (idempotent module write) so the next page's strip already knows it, however fast the tap.
  rememberPath(pathname, search)
  const onKey = (e: KeyboardEvent) => {
    const i = refs.current.findIndex((el) => el === document.activeElement)
    if (i < 0) return
    const n = STRIP.length
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null
    if (next === null) return
    e.preventDefault()
    refs.current[(next + n) % n]?.focus()
  }
  const depth = phone ? 10 : 18
  const nav = useRef<HTMLElement>(null)
  const row = useRef<HTMLDivElement>(null)
  const pill = useRef<HTMLSpanElement>(null)
  const [clip, setClip] = useState<string | undefined>(undefined)
  useEffect(() => {
    const el = nav.current
    if (!el) return
    const fit = () => setClip(`path('${bandPath(el.offsetWidth, el.offsetHeight, phone)}')`)
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [phone])
  const activeIndex = current ? STRIP.indexOf(current) : -1
  // The lit pill: two caps and a scaled middle; the edge toward the new district leads (snappy), the other trails (gentle).
  useStretch(row, pill, () => (activeIndex >= 0 ? refs.current[activeIndex] ?? null : null), 'x', activeIndex, phone)
  return (
    <nav ref={nav} className={`dstrip${phone ? ' is-phone' : ''}`} aria-label="Districts">
      <svg className="dstrip-bg" viewBox="0 0 700 80" preserveAspectRatio="none" aria-hidden="true">
        <path d={phone ? 'M2 14 Q350 -6 698 14 L698 72 Q698 78 692 78 L8 78 Q2 78 2 72 Z' : 'M3 26 Q350 -10 697 26 L697 70 Q697 78 689 78 L11 78 Q3 78 3 70 Z'} className="dstrip-shadow" />
      </svg>
      <div className="dstrip-glass" style={clip ? { clipPath: clip } : undefined} aria-hidden="true" />
      <div ref={row} className="dstrip-row" onKeyDown={onKey}>
        <span ref={pill} className="dstrip-pill lq-ind x" aria-hidden="true">
          <span className="lq-fill"><i className="lq-mid" /><i className="lq-cap a" /><i className="lq-cap b" /></span>
        </span>
        {STRIP.map((id, i) => {
          const d = DISTRICTS[id]
          const active = current === id
          const exact = active && (pathname === d.to || (id === 'home' && pathname === '/map'))
          const u = (i + 0.5) / STRIP.length
          return (
            <Link
              key={id} ref={(el) => { refs.current[i] = el }} to={stripTarget(id, current)} className={`dstrip-tab${active ? ' is-active' : ''}`}
              data-district={id} aria-current={active ? (exact ? 'page' : 'true') : undefined}
              aria-label={behind.has(id) ? `${d.label}, needs attention` : undefined}
              style={{ transform: `translateY(${curveOffset(u, depth)}px)` }}
            >
              <span className="dstrip-label">{d.label}</span>
              {behind.has(id) && <i className="dstrip-dot" aria-hidden="true" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
