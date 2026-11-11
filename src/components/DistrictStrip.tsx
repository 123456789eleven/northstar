// Global primary navigation: the curved glass district strip along the bottom (same band as the Life map's), on phone and
// desktop. The active district is lit; a poppy dot means something there is behind or overdue. You sits in the top bar.
import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { today } from '../lib/dates'
import { useLifeMap } from '../features/lifemap/useLifeMap'
import { DISTRICTS, districtForPath, rememberPath, STRIP, stripTarget, type DistrictId } from './districts'
import './city.css'

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

/** Follows the band's top curve so labels sit on it (u = 0..1 across the strip). */
export const curveOffset = (u: number, depth: number) => Math.round(depth * (1 - 4 * u * (1 - u)))

export default function DistrictStrip({ phone }: { phone: boolean }) {
  const { pathname, search } = useLocation()
  const current = districtForPath(pathname)
  const behind = useBehind()
  const refs = useRef<(HTMLAnchorElement | null)[]>([])
  useEffect(() => { rememberPath(pathname, search) }, [pathname, search])
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
  return (
    <nav className={`dstrip${phone ? ' is-phone' : ''}`} aria-label="Districts" data-spec>
      <svg className="dstrip-bg" viewBox="0 0 700 80" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dstrip-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" className="dstrip-rim-0" /><stop offset="0.5" className="dstrip-rim-1" /><stop offset="1" className="dstrip-rim-0" />
          </linearGradient>
        </defs>
        <path d={phone ? 'M2 14 Q350 -6 698 14 L698 72 Q698 78 692 78 L8 78 Q2 78 2 72 Z' : 'M3 26 Q350 -10 697 26 L697 70 Q697 78 689 78 L11 78 Q3 78 3 70 Z'} className="dstrip-shape" />
        <path d={phone ? 'M2 14 Q350 -6 698 14' : 'M3 26 Q350 -10 697 26'} className="dstrip-rim" />
      </svg>
      <div className="dstrip-row" onKeyDown={onKey}>
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
