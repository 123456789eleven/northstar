// Pure placement for the city chrome: where each place sits in the mini-map, and where the backdrop camera looks.
import type { DistrictId } from '../../components/districts'
import { padBounds, worldToScreen, type Bounds, type Camera, type Pt, type Size } from './iso'
import type { LifeMap } from './model'

/** Mini-map camera (whole city, civic places included) and the screen anchor of every place. */
export function placeAnchors(map: LifeMap, view: Size) {
  // Not fitCamera: the chip needs a scale far below the Life map's zoom floor.
  const b = padBounds(map.cityBounds, 30)
  const cam: Camera = { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2, k: Math.min(view.w / (b.maxX - b.minX), view.h / (b.maxY - b.minY)) }
  const places = [
    ...map.districts.map((d) => ({ id: d.id as DistrictId, centre: d.centre })),
    ...map.civic.map((c) => ({ id: c.id as DistrictId, centre: c.centre })),
  ]
  return { cam, anchors: places.map((p) => ({ id: p.id, ...worldToScreen(p.centre, cam, view) })) }
}

/** World px to backdrop px. */
export const BACKDROP_K = 0.9

/** Where the backdrop camera looks for a district: its centre (civic ones too); Home looks at the middle of the city. */
export function backdropFocus(map: LifeMap, id: DistrictId): Pt {
  const place = map.districts.find((d) => d.id === id) ?? map.civic.find((c) => c.id === id)
  if (!place) return { x: (map.cityBounds.minX + map.cityBounds.maxX) / 2, y: (map.cityBounds.minY + map.cityBounds.maxY) / 2 }
  return { x: place.centre.x, y: (place.centre.y + place.top.y) / 2 }
}

/** Offset (px) of a world point inside the backdrop SVG drawn from bounds `b` at scale `k`. */
export function backdropOffset(p: Pt, b: Bounds, k = BACKDROP_K): Pt {
  return { x: Math.round((p.x - b.minX) * k), y: Math.round((p.y - b.minY) * k) }
}
