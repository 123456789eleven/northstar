// Backdrop city: the same scene, faint, behind every non-home page, laid on a tilted plane so the far side recedes into the
// fog. The SVG renders once per model, rotation or lighting step; a route change only moves a CSS custom property, and the
// layer glides there with a CSS spring (no per-frame JS, no scene re-render).
import { memo, useMemo, type CSSProperties } from 'react'
import { useLocation } from 'react-router-dom'
import { districtForPath } from '../../components/districts'
import { padBounds, type Bounds } from './iso'
import { BACKDROP_K, backdropFocus, backdropOffset } from './place'
import { CityScene } from './CityScene'
import { rotateMap } from './rotate'
import { useCityRotation } from './rotation'
import { useLifeMap } from './useLifeMap'
import { useLighting } from './useLighting'
import type { LifeMap } from './model'
import './lifemap.css'
import './backdrop.css'

const PAD = 260

const Scene = memo(function Scene({ map, b, windows }: { map: LifeMap; b: Bounds; windows: number }) {
  const w = Math.round((b.maxX - b.minX) * BACKDROP_K), h = Math.round((b.maxY - b.minY) * BACKDROP_K)
  return (
    <svg className="cb-svg" width={w} height={h} viewBox={`${b.minX} ${b.minY} ${b.maxX - b.minX} ${b.maxY - b.minY}`} aria-hidden="true" focusable="false">
      <CityScene map={map} selected={null} lite windows={windows} />
    </svg>
  )
})

export default function CityBackdrop() {
  const base = useLifeMap()
  const rot = useCityRotation()
  const light = useLighting()
  const map = useMemo(() => (base ? rotateMap(base, rot) : undefined), [base, rot])
  const { pathname } = useLocation()
  const id = districtForPath(pathname)
  const b = useMemo(() => (map ? padBounds(map.cityBounds, PAD) : null), [map])
  if (!map || !b) return <div className="cb is-home" aria-hidden="true" />
  const at = backdropOffset(backdropFocus(map, id), b)
  return (
    <div className={`cb${id === 'home' ? ' is-home' : ''}`} aria-hidden="true" data-district={id} style={{ '--night': light.night } as CSSProperties}>
      <div className="cb-plane">
        <div className="cb-cam" style={{ '--px': `${at.x}px`, '--py': `${at.y}px` } as CSSProperties}>
          <Scene map={map} b={b} windows={light.windows} />
        </div>
      </div>
      <div className="cb-fog" />
    </div>
  )
}
