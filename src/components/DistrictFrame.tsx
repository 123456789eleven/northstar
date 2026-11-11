// District frame: the layout around every non-home page. Head (mini-map; breadcrumb such as "Money / Cash / Budgets" led by
// the district name in its hue; the area's line from the Life map), then the district's sub-tabs, then the page, which slides
// in briefly on a route change. A single-page district (Career, People) shows no name here: its page title already is one.
// Routes stay absolute (/tasks, /food, /journal ...), so every old URL, deep link and ?focus= param keeps working.
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { subtabForPath, type DistrictDef } from './districts'
import { RouteFade } from './HubLayout'
import { useMedia, PHONE_QUERY } from './useMedia'
import MiniMap from '../features/lifemap/MiniMap'
import { useLifeMap } from '../features/lifemap/useLifeMap'

/** District hue: the area colour for the five areas, powder blue for Plan and You. */
export const hueFor = (d: DistrictDef) => (d.skill ? `var(--skill-${d.skill})` : 'var(--accent)')

/** The area's week in one line, from the same Life map figures: the behind/overdue note when there is one. */
export function areaLine(a: { id: string; short: string; beacon: string | null }): string {
  if (a.beacon) return a.beacon
  if (a.id === 'people') return a.short
  if (a.id === 'money' && a.short.startsWith('$')) return `Net worth ${a.short}`
  return `${a.short} this week`
}

export function CityHead() {
  const { pathname, search } = useLocation()
  const phone = useMedia(PHONE_QUERY)
  const { district: d, tab, sub } = subtabForPath(pathname, search)
  const map = useLifeMap()
  if (d.id === 'home') return null
  const area = d.skill ? map?.districts.find((x) => x.id === d.skill) : undefined
  return (
    <header className="city-head" data-district={d.id} style={{ '--d-hue': hueFor(d) } as CSSProperties}>
      <MiniMap active={d.id} phone={phone} />
      <div className="city-head-text">
        {tab && (
          <nav aria-label="Breadcrumb" className="city-crumb">
            <ol>
              <li className="city-crumb-home"><i className="city-head-mark" aria-hidden="true" /><Link to={d.to}>{d.label}</Link></li>
              {sub ? <li>{tab.label}</li> : <li><span aria-current="page">{tab.label}</span></li>}
              {sub && <li><span aria-current="page">{sub.label}</span></li>}
            </ol>
          </nav>
        )}
        {area && (
          <p className={`city-head-line${area.beacon ? ' is-warn' : ''}`}>{areaLine(area)}</p>
        )}
      </div>
    </header>
  )
}

/** The district's sub-tabs (Money keeps its own in-page tabs, Career and People have none). */
function DistrictTabs() {
  const { pathname, search } = useLocation()
  const { district: d, tab: current } = subtabForPath(pathname, search)
  if (d.id === 'money' || d.tabs.length < 2) return null
  return (
    <nav className="hub-strip" aria-label={`${d.label} sections`}>
      <div className="hub-strip-row">
        {d.tabs.map((t) => {
          const active = current === t
          return (
            <Link key={t.to} to={t.to} className={`hub-tab ${active ? 'active' : ''}`} aria-current={active ? (pathname === t.to ? 'page' : 'true') : undefined}>
              {t.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

export default function DistrictFrame() {
  const { pathname } = useLocation()
  const { district } = subtabForPath(pathname)
  return (
    <div className="df" data-district={district.id}>
      <CityHead />
      <DistrictTabs />
      <RouteFade />
    </div>
  )
}
