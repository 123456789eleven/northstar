// Mini-map: the same city scene as Home (shared model and CityScene, lite detail), small, with the active district lit.
// Desktop: tap a place to go there, tap the ground for Home. Phone: one compact chip that opens Home.
import { memo, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DISTRICTS, type DistrictId } from '../../components/districts'
import { cameraTransform } from './iso'
import { placeAnchors } from './place'
import { CityScene } from './CityScene'
import { useLifeMap } from './useLifeMap'
import type { LifeMap } from './model'
import './lifemap.css'
import './minimap.css'

const SIZE = { desk: { w: 176, h: 100 }, phone: { w: 64, h: 38 } }

const Scene = memo(function Scene({ map, active, view }: { map: LifeMap; active: DistrictId; view: { w: number; h: number } }) {
  const { cam } = placeAnchors(map, view)
  return (
    <svg className="mm-svg" width={view.w} height={view.h} aria-hidden="true" focusable="false">
      <g transform={cameraTransform(cam, view)}><CityScene map={map} selected={active} lite /></g>
    </svg>
  )
})

export default function MiniMap({ active, phone }: { active: DistrictId; phone: boolean }) {
  const map = useLifeMap()
  const navigate = useNavigate()
  const view = phone ? SIZE.phone : SIZE.desk
  const anchors = useMemo(() => (map && !phone ? placeAnchors(map, view).anchors : []), [map, phone, view])
  const here = DISTRICTS[active].label
  if (phone) {
    return (
      <Link to="/" className="mm is-phone" aria-label={`City map, you are in ${here}. Open Home`} data-active={active}>
        {map ? <Scene map={map} active={active} view={view} /> : <span className="mm-empty" />}
      </Link>
    )
  }
  return (
    <div className="mm" role="group" aria-label={`City map, you are in ${here}`} data-active={active}>
      <button type="button" className="mm-ground" aria-label="Home, the whole city" onClick={() => navigate('/')} />
      {map ? <Scene map={map} active={active} view={view} /> : <span className="mm-empty" />}
      {anchors.map((a) => {
        const d = DISTRICTS[a.id]
        return (
          <Link
            key={a.id} to={d.to} className={`mm-hit${a.id === active ? ' is-active' : ''}`} style={{ left: a.x, top: a.y }}
            aria-label={d.label} aria-current={a.id === active ? 'true' : undefined} title={d.label}
          ><span className="mm-tip" aria-hidden="true">{d.label}</span></Link>
        )
      })}
    </div>
  )
}
