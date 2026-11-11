// District frame: the layout around every non-home page. Head (mini-map, district name in its hue, breadcrumb such as
// "Money / Markets"), then the district's sub-tabs, then the page, which slides in briefly on a route change.
// Routes stay absolute (/tasks, /food, /journal ...), so every old URL, deep link and ?focus= param keeps working.
import type { CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { subtabForPath, type DistrictDef } from './districts'
import { RouteFade } from './HubLayout'
import { useMedia, PHONE_QUERY } from './useMedia'
import MiniMap from '../features/lifemap/MiniMap'

/** District hue: the area colour for the five areas, powder blue for Plan and You. */
export const hueFor = (d: DistrictDef) => (d.skill ? `var(--skill-${d.skill})` : 'var(--accent)')

export function CityHead() {
  const { pathname, search } = useLocation()
  const phone = useMedia(PHONE_QUERY)
  const { district: d, tab } = subtabForPath(pathname, search)
  if (d.id === 'home') return null
  return (
    <header className="city-head" data-district={d.id} style={{ '--d-hue': hueFor(d) } as CSSProperties}>
      <MiniMap active={d.id} phone={phone} />
      <div className="city-head-text">
        <span className="city-head-name"><i className="city-head-mark" aria-hidden="true" />{d.label}</span>
        {tab && (
          <nav aria-label="Breadcrumb" className="city-crumb">
            <ol>
              <li><Link to={d.to}>{d.label}</Link></li>
              <li><span aria-current="page">{tab.label}</span></li>
            </ol>
          </nav>
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
