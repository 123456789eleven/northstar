// Building frame (BUILDINGS_PLAN.md): the layout around every non-home page. You are inside a building of the city.
// Head: mini-map, "Gym / Kitchen" (building in its hue, then the floor), one status line, the 5-window stage meter.
// Floors: an elevator at the left of the content on desktop, a pill row on phone; the lit car springs to the active floor;
// arrow keys move between floors. Entering a building rises the content (the backdrop camera zooms in, CityBackdrop.tsx);
// moving between floors slides the page up or down. Reduced motion: instant. Routes stay absolute, so every old URL works.
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { floorForPath, hasElevator, type DistrictDef, type DistrictId } from './districts'
import { Icon } from './Icons'
import { RouteFade } from './HubLayout'
import { useMedia, PHONE_QUERY } from './useMedia'
import MiniMap from '../features/lifemap/MiniMap'
import { useLifeMap } from '../features/lifemap/useLifeMap'
import StageMeter from '../features/buildings/StageMeter'
import { useBuildingStage } from '../features/buildings/useBuildingStage'
import './building.css'

/** District hue: the area colour for the five areas, powder blue for Plan and You. */
const hueFor = (d: DistrictDef) => (d.skill ? `var(--skill-${d.skill})` : 'var(--accent)')

/** The area's week in one line, from the same Life map figures: the behind/overdue note when there is one. */
function areaLine(a: { id: string; short: string; beacon: string | null }): string {
  if (a.beacon) return a.beacon
  if (a.id === 'people') return a.short
  if (a.id === 'money' && a.short.startsWith('$')) return `Net worth ${a.short}`
  return `${a.short} this week`
}

export function BuildingHead() {
  const { pathname, search } = useLocation()
  const phone = useMedia(PHONE_QUERY)
  const { district: d, floor, sub } = floorForPath(pathname, search)
  const map = useLifeMap()
  const stage = useBuildingStage(d.id)
  if (d.id === 'home') return null
  const area = d.skill ? map?.districts.find((x) => x.id === d.skill) : undefined
  const line = stage ? stage.line : area ? areaLine(area) : null
  const warn = !stage && !!area?.beacon
  return (
    <header className="city-head bf-head" data-district={d.id} style={{ '--d-hue': hueFor(d) } as CSSProperties}>
      <MiniMap active={d.id} phone={phone} />
      <div className="city-head-text">
        <nav aria-label="Breadcrumb" className="city-crumb">
          <ol>
            <li className="city-crumb-home">
              <i className="city-head-mark" aria-hidden="true" />
              {floor ? <Link to={d.to}>{d.building}</Link> : <span aria-current="page">{d.building}</span>}
            </li>
            {floor && (sub ? <li>{floor.label}</li> : <li><span aria-current="page">{floor.label}</span></li>)}
            {sub && <li><span aria-current="page">{sub.label}</span></li>}
          </ol>
        </nav>
        {line && <p className={`city-head-line${warn ? ' is-warn' : ''}`} data-testid="building-line">{line}</p>}
      </div>
      {stage && <StageMeter stage={stage} building={d.building} />}
    </header>
  )
}

/** The floor selector: vertical elevator (desktop) or a pill row (phone). Links, so every floor has a URL. */
export function Elevator({ district, phone }: { district: DistrictDef; phone: boolean }) {
  const { pathname, search } = useLocation()
  const { floor: current } = floorForPath(pathname, search)
  const list = useRef<HTMLOListElement>(null)
  const [car, setCar] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const active = current ? district.floors.indexOf(current) : -1

  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelectorAll<HTMLElement>('.bf-floor-link')[active]
      setCar(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null)
    }
    measure()
    const ro = typeof ResizeObserver !== 'undefined' && list.current ? new ResizeObserver(measure) : null
    if (ro && list.current) ro.observe(list.current)
    return () => ro?.disconnect()
  }, [active, phone])
  useLayoutEffect(() => {
    if (!phone) return
    const el = list.current?.querySelectorAll<HTMLElement>('.bf-floor-link')[active]
    el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [active, phone])

  const onKey = (e: KeyboardEvent<HTMLOListElement>) => {
    const links = [...(list.current?.querySelectorAll<HTMLAnchorElement>('.bf-floor-link') ?? [])]
    const i = links.indexOf(document.activeElement as HTMLAnchorElement)
    if (i < 0) return
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
    let to = step != null ? (i + step + links.length) % links.length : -1
    if (e.key === 'Home') to = 0
    if (e.key === 'End') to = links.length - 1
    if (to < 0) return
    e.preventDefault()
    links[to].focus()
  }

  return (
    <nav className={`bf-elevator${phone ? ' is-phone' : ''}`} aria-label={`${district.building} floors`}>
      <ol ref={list} className="bf-floors" onKeyDown={onKey}>
        {car && (
          <li
            className="bf-car"
            aria-hidden="true"
            style={{ '--car-x': `${car.x}px`, '--car-y': `${car.y}px`, '--car-w': `${car.w}px`, '--car-h': `${car.h}px` } as CSSProperties}
          />
        )}
        {district.floors.map((f, i) => {
          const on = i === active
          return (
            <li key={f.id}>
              <Link
                to={f.to}
                className={`bf-floor-link${on ? ' is-active' : ''}`}
                aria-current={on ? 'page' : undefined}
                tabIndex={on || (active < 0 && i === 0) ? 0 : -1}
                data-floor={f.id}
              >
                {f.icon && <Icon name={f.icon} size={phone ? 14 : 16} />}
                <span className="bf-floor-label">{f.label}</span>
                {!phone && <span className="bf-floor-n mono" aria-hidden="true">{district.floors.length - i}</span>}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

type Dir = 'enter' | 'up' | 'down' | 'same'

export default function BuildingFrame() {
  const { pathname, search } = useLocation()
  const phone = useMedia(PHONE_QUERY)
  const { district, floor } = floorForPath(pathname, search)
  const idx = floor ? district.floors.indexOf(floor) : -1
  // Direction of travel, derived while rendering (React's "previous value" pattern): a new building rises, a floor slides.
  const [prev, setPrev] = useState<{ d: DistrictId; i: number; p: string; dir: Dir }>({ d: district.id, i: idx, p: pathname, dir: 'enter' })
  if (prev.d !== district.id || prev.i !== idx || prev.p !== pathname) {
    setPrev({ d: district.id, i: idx, p: pathname, dir: prev.d !== district.id ? 'enter' : idx > prev.i ? 'down' : idx < prev.i ? 'up' : 'same' })
  }
  const lift = hasElevator(district)
  return (
    <div className={`df bf${lift ? ' has-elevator' : ''}${phone ? ' is-phone' : ''}`} data-district={district.id} style={{ '--d-hue': hueFor(district) } as CSSProperties}>
      <BuildingHead />
      <div className="bf-body">
        {lift && <Elevator district={district} phone={phone} />}
        <div className="bf-floor" data-dir={prev.dir}>
          <RouteFade />
        </div>
      </div>
    </div>
  )
}
