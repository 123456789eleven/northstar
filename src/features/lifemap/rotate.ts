// Pure: the Life map turned by quarter turns about the city centre. Every footprint, point, road and anchor is rotated in
// world tiles and re-projected, so the scene stays a true 2:1 isometric view from the new side (light stays camera-relative).
import { project, quarter, rotateRect, rotateTile, unproject, type Pt } from './iso'
import { placeBounds, type Building, type LifeMap } from './model'

const rotB = (b: Building, r: number): Building => ({ ...b, ...rotateRect(b.x, b.y, b.w, b.d, r) })
/** A screen point at ground level (z = 0) rotated through world tiles. */
const rotScreen = (p: Pt, r: number): Pt => { const t = unproject(p.x, p.y); const q = rotateTile(t.x, t.y, r); return project(q.x, q.y) }

function rotPlace<T extends { origin: Pt; size: number; centre: Pt; top: Pt }>(p: T, r: number): T {
  const o = rotateRect(p.origin.x, p.origin.y, p.size, p.size, r)
  const centre = project(o.x + p.size / 2, o.y + p.size / 2)
  return { ...p, origin: { x: o.x, y: o.y }, centre, top: { x: centre.x, y: centre.y - (p.centre.y - p.top.y) } }
}

/** The map seen after `r` quarter turns (r = 0 returns the same object). */
export function rotateMap(map: LifeMap, r: number): LifeMap {
  const q = quarter(r)
  if (q === 0) return map
  const districts = map.districts.map((d) => ({
    ...rotPlace(d, q),
    buildings: d.buildings.map((b) => rotB(b, q)),
    trees: d.trees.map((t) => ({ ...t, ...rotateTile(t.x, t.y, q) })),
    path: d.path.map((s) => { const o = rotateRect(s.x, s.y, 0.36, 0.36, q); return { ...s, x: o.x, y: o.y } }),
  }))
  const civic = map.civic.map((c) => ({ ...rotPlace(c, q), buildings: c.buildings.map((b) => rotB(b, q)) }))
  return {
    ...map,
    districts,
    civic,
    roads: map.roads.map((rd) => {
      const a = rotateTile(rd.x1, rd.y1, q), b = rotateTile(rd.x2, rd.y2, q)
      return { ...rd, x1: a.x, y1: a.y, x2: b.x, y2: b.y }
    }),
    cars: map.cars.map((c) => ({ ...c, a: rotScreen(c.a, q), b: rotScreen(c.b, q) })),
    outskirts: map.outskirts.map((b) => rotB(b, q)),
    ...placeBounds(districts, civic),
  }
}
