// The Life map city as SVG, in world px (camera applied by the parent). Memoised: camera moves never re-render the scene.
// One scene for Home, the mini-map and the backdrop: `lite` drops windows, glow, grid, traffic and markers (small or faint uses).
import { memo, type CSSProperties } from 'react'
import { blockFaces, project, pts, type Pt } from './iso'
import { fogFor, windowOn } from './light'
import { GROUND, type Building, type Civic, type District, type LifeMap, type Road, type Tree } from './model'

const r1 = (n: number) => Math.round(n * 10) / 10
const M = (p: Pt) => `M${r1(p.x)} ${r1(p.y)}`
const L = (p: Pt) => `L${r1(p.x)} ${r1(p.y)}`
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
const up = (p: Pt, z: number): Pt => ({ x: p.x, y: p.y - z })

const ground = pts([project(-GROUND, -GROUND), project(GROUND, -GROUND), project(GROUND, GROUND), project(-GROUND, GROUND)])
const grid = (() => {
  const minor: string[] = [], major: string[] = []
  for (let i = -GROUND; i <= GROUND; i++) {
    const seg = `${M(project(i, -GROUND))}${L(project(i, GROUND))}${M(project(-GROUND, i))}${L(project(GROUND, i))}`
    ;(i % 4 === 0 ? major : minor).push(seg)
  }
  return { minor: minor.join(''), major: major.join('') }
})()

function roadPoly(r: Road): string {
  const h = r.w / 2
  if (r.y1 === r.y2) {
    const [a, b] = r.x1 < r.x2 ? [r.x1, r.x2] : [r.x2, r.x1]
    return pts([project(a - h, r.y1 - h), project(b + h, r.y1 - h), project(b + h, r.y1 + h), project(a - h, r.y1 + h)])
  }
  const [a, b] = r.y1 < r.y2 ? [r.y1, r.y2] : [r.y2, r.y1]
  return pts([project(r.x1 - h, a - h), project(r.x1 + h, a - h), project(r.x1 + h, b + h), project(r.x1 - h, b + h)])
}

const Roads = memo(function Roads({ roads }: { roads: Road[] }) {
  const lanes = roads.map((r) => `${M(project(r.x1, r.y1))}${L(project(r.x2, r.y2))}`)
  return (
    <g className="lm-roads">
      {roads.map((r, i) => <polygon key={i} points={roadPoly(r)} className={r.main ? 'lm-road is-main' : 'lm-road'} />)}
      <path d={lanes.filter((_, i) => roads[i].main).join('')} className="lm-lane" />
      <path d={lanes.filter((_, i) => !roads[i].main).join('')} className="lm-lane is-minor" />
    </g>
  )
})

/** Window quads on the two visible faces, lit by a deterministic share. One path per building. */
function windowPath(b: Building, f: ReturnType<typeof blockFaces>, seed: number, share: number): string {
  if (share <= 0 || b.h < 14) return ''
  const fh = b.bands > 0 ? Math.max(7, b.bands) : 9
  const floors = Math.min(16, Math.floor((b.h - 5) / fh))
  let d = '', i = 0
  const faces: [Pt, Pt, number][] = [[f.left[3], f.left[2], b.w], [f.right[3], f.right[2], b.d]]
  for (const [a, z, width] of faces) {
    const cols = b.mullions > 0 ? b.mullions + 1 : Math.max(1, Math.min(4, Math.round(width * 2.2)))
    for (let fl = 0; fl < floors; fl++) {
      const z0 = fl * fh + fh * 0.36, z1 = fl * fh + fh * 0.74
      for (let c = 0; c < cols; c++, i++) {
        if (!windowOn(seed, i, share)) continue
        const p0 = lerp(a, z, (c + 0.3) / cols), p1 = lerp(a, z, (c + 0.7) / cols)
        d += `${M(up(p0, z0))}${L(up(p1, z0))}${L(up(p1, z1))}${L(up(p0, z1))}Z`
      }
    }
  }
  return d
}

interface Look { lite: boolean; windows: number; seed: number; fogMax: number; rise?: number }

function BuildingShape({ b, look }: { b: Building; look: Look }) {
  const { lite, windows, seed, fogMax, rise } = look
  const f = blockFaces(b.x, b.y, b.w, b.d, b.h)
  const [l0, l1, l2, l3] = f.left // top-left, top-right, bottom-right, bottom-left (left face, +y side)
  const [r0, r1_, r2, r3] = f.right // top-back, top-front, bottom-front, bottom-back (right face, +x side)
  let detail = ''
  if (!lite && b.bands > 0 && b.h > 18) {
    for (let z = b.bands; z < b.h - 5; z += b.bands) {
      detail += M(up(lerp(l3, l2, 0.06), z)) + L(up(lerp(l3, l2, 0.94), z))
      detail += M(up(lerp(r3, r2, 0.06), z)) + L(up(lerp(r3, r2, 0.94), z))
    }
  }
  for (let i = 1; !lite && i <= b.mullions; i++) {
    const t = i / (b.mullions + 1)
    detail += M(lerp(l3, l2, t)) + L(lerp(l0, l1, t)) + M(lerp(r3, r2, t)) + L(lerp(r0, r1_, t))
  }
  const share = b.lit ? Math.min(0.8, windows * 1.05 + 0.08) : windows * (fogMax > 0.5 ? 0.42 : 0.6)
  const lights = windowPath(b, f, seed, share)
  const edges = `${M(l3)}${L(l0)}${M(l2)}${L(l1)}${M(r3)}${L(r0)}${M(f.top[0])}${L(f.top[1])}${L(f.top[2])}${L(f.top[3])}Z`
  const fog = lite ? 0 : fogFor(b.x + b.w / 2 + b.y + b.d / 2, fogMax)
  let roof = null
  if (lite && b.roof === 'spire') {
    roof = <path d={`${M(f.peak)}${L(up(f.peak, 26))}`} className="lm-spire" />
  } else if (b.roof === 'spire') {
    const tip = up(f.peak, 26)
    roof = <><path d={`${M(f.peak)}${L(tip)}`} className="lm-spire" /><circle cx={r1(tip.x)} cy={r1(tip.y)} r={2.2} className="lm-tip" /></>
  } else if (b.roof === 'pyramid') {
    const apex = up(f.peak, 14)
    roof = <><polygon points={pts([f.top[3], f.top[2], apex])} className="lm-roof-l" /><polygon points={pts([f.top[1], f.top[2], apex])} className="lm-roof-r" /></>
  } else if (b.roof === 'crown') {
    // A smaller box sitting on the roof: the same faces raised by the building height.
    const c = blockFaces(b.x + b.w * 0.25, b.y + b.d * 0.25, b.w * 0.5, b.d * 0.5, 8)
    const lift = (ps: Pt[]) => pts(ps.map((p) => up(p, b.h)))
    roof = <><polygon points={lift(c.left)} className="lm-face-l" /><polygon points={lift(c.right)} className="lm-face-r" /><polygon points={lift(c.top)} className="lm-face-t" /></>
  }
  const style = { '--e': b.e.toFixed(2), ...(rise !== undefined ? { '--from': rise.toFixed(2) } : {}) } as CSSProperties
  return (
    <g className={`lm-b${b.lit ? ' is-lit' : ''}${rise !== undefined ? ' is-rising' : ''}`} style={style}>
      <polygon points={pts(f.left)} className="lm-face-l" />
      <polygon points={pts(f.right)} className="lm-face-r" />
      <polygon points={pts(f.top)} className="lm-face-t" />
      {detail && <path d={detail} className="lm-win" />}
      {lights && <path d={lights} className="lm-lights" />}
      {b.lit && !lite && <path d={edges} className="lm-edge-glow" />}
      <path d={edges} className="lm-edge" />
      {!lite && <path d={`${M(f.top[3])}${L(f.top[0])}${L(f.top[1])}`} className="lm-spec" />}
      {roof}
      {fog > 0.03 && <polygon points={pts([f.top[0], f.top[1], r3, r2, l3, l0])} className="lm-veil" style={{ '--fog': fog } as CSSProperties} />}
    </g>
  )
}

/** Soft contact shadow on the ground, falling front-right (the light is camera-relative, from the back left). */
function Shadow({ b }: { b: Building }) {
  const off = Math.min(0.9, b.h / 150)
  const c = project(b.x + b.w / 2 + off, b.y + b.d / 2 + off * 0.25)
  const rx = (b.w + b.d) * 19 + b.h * 0.12
  return <ellipse cx={r1(c.x)} cy={r1(c.y)} rx={r1(rx)} ry={r1(rx * 0.5)} className="lm-shadow" />
}

function TreeShape({ t, isNew }: { t: Tree; isNew: boolean }) {
  const base = project(t.x, t.y)
  const crown = up(base, 24)
  const R = 17
  const C = 2 * Math.PI * R
  return (
    <g className={`lm-tree${t.placeholder ? ' is-placeholder' : ''}${t.overdue ? ' is-overdue' : ''}${isNew ? ' is-rising' : ''}`}>
      <ellipse cx={r1(base.x + 4)} cy={r1(base.y + 1)} rx={15} ry={7.5} className="lm-tree-shadow" />
      <path d={`${M(base)}${L(crown)}`} className="lm-trunk" />
      <circle cx={r1(crown.x)} cy={r1(crown.y)} r={12} className="lm-crown" />
      {!t.placeholder && (t.overdue
        ? <circle cx={r1(crown.x)} cy={r1(crown.y)} r={R} className="lm-leafring is-overdue" />
        : t.ring !== null && <circle cx={r1(crown.x)} cy={r1(crown.y)} r={R} className="lm-leafring" strokeDasharray={`${r1(C * t.ring)} ${r1(C)}`} transform={`rotate(-90 ${r1(crown.x)} ${r1(crown.y)})`} />)}
    </g>
  )
}

const PLINTH_H = 5

function Plinth({ d }: { d: { origin: Pt; size: number } }) {
  const f = blockFaces(d.origin.x, d.origin.y, d.size, d.size, PLINTH_H)
  return (
    <>
      <polygon points={pts(f.left)} className="lm-plinth-side" />
      <polygon points={pts(f.right)} className="lm-plinth-side is-r" />
      <polygon points={pts(f.top)} className="lm-plinth" />
    </>
  )
}

/** The glow pool under a place; stays on the ground when the place lifts on hover. */
function Pool({ d }: { d: { origin: Pt; size: number } }) {
  const c = project(d.origin.x + d.size / 2, d.origin.y + d.size / 2)
  return <ellipse cx={r1(c.x)} cy={r1(c.y)} rx={d.size * 62} ry={d.size * 31} fill="url(#lm-pool)" className="lm-pool" />
}

interface SceneOpts { lite: boolean; windows: number; rising: ReadonlySet<string> }

const depthOf = (b: Building) => b.x + b.w + b.y + b.d

function DistrictShape({ d, selected, o }: { d: District; selected: boolean; o: SceneOpts }) {
  const { lite } = o
  const seed0 = d.id.charCodeAt(0) * 31 + d.id.charCodeAt(1)
  const items = [
    ...d.buildings.map((b, i) => ({
      depth: depthOf(b),
      el: <BuildingShape key={`b${i}`} b={b} look={{ lite, windows: o.windows, seed: seed0 + i, fogMax: 0.34, rise: o.rising.has(`${d.id}:${i}`) ? 0.2 : undefined }} />,
    })),
    ...d.trees.map((t) => ({ depth: t.x + t.y + 0.5, el: <TreeShape key={`t${t.id}`} t={t} isNew={o.rising.has(`${d.id}:t${t.id}`)} /> })),
  ].sort((a, b) => a.depth - b.depth)
  const cx = d.centre.x
  const last = d.path[d.path.length - 1]
  const flag = last ? project(last.x + 0.18, last.y + 0.18) : null
  return (
    <g className={`lm-district${selected ? ' is-selected' : ''}`} data-d={d.id} style={{ '--g': d.glow.toFixed(2) } as CSSProperties}>
      <Pool d={d} />
      <g className="lm-lift">
        <Plinth d={d} />
        <g transform={`translate(0 -${PLINTH_H})`}>
          {d.id === 'people' && <ellipse cx={r1(d.centre.x)} cy={r1(d.centre.y)} rx={d.size * 22} ry={d.size * 11} className="lm-park-path" />}
          {!lite && d.path.map((s, i) => <polygon key={i} className={s.lit ? 'lm-step is-lit' : 'lm-step'} points={pts([project(s.x, s.y), project(s.x + 0.36, s.y), project(s.x + 0.36, s.y + 0.36), project(s.x, s.y + 0.36)])} />)}
          {flag && !lite && (
            <g className={d.pathDone ? 'lm-flag is-earned' : 'lm-flag'} transform={`translate(${r1(flag.x)} ${r1(flag.y)})`}>
              <line x1="0" y1="0" x2="0" y2="-22" /><polygon points="0,-22 10,-18 0,-14" />
            </g>
          )}
          {!lite && d.buildings.map((b, i) => <Shadow key={`s${i}`} b={b} />)}
          {items.map((x) => x.el)}
          {d.beacon && !lite && (
            <g className="lm-beacon" transform={`translate(${r1(cx)} ${r1(d.top.y - 18)})`}>
              <line x1="0" y1="4" x2="0" y2="22" className="lm-beacon-stem" />
              <circle r="10" className="lm-beacon-ring" />
              <circle r="4.5" className="lm-beacon-dot" />
            </g>
          )}
          {d.gold && !lite && (
            <g transform={`translate(${r1(cx + 30)} ${r1(d.top.y - 8)})`} className="lm-gold">
              <line x1="0" y1="4" x2="0" y2="20" />
              <polygon points="0,-7 6,0 0,7 -6,0" />
            </g>
          )}
        </g>
      </g>
    </g>
  )
}

function CivicShape({ c, selected, o }: { c: Civic; selected: boolean; o: SceneOpts }) {
  const items = c.buildings.map((b, i) => ({ b, i })).sort((a, b) => depthOf(a.b) - depthOf(b.b))
  const seed0 = c.id.charCodeAt(0) * 37
  return (
    <g className={`lm-district lm-civic${selected ? ' is-selected' : ''}`} data-d={c.id} style={{ '--g': selected ? '0.6' : '0.1' } as CSSProperties}>
      <Pool d={c} />
      <g className="lm-lift">
        <Plinth d={c} />
        <g transform={`translate(0 -${PLINTH_H})`}>
          {!o.lite && c.buildings.map((b, i) => <Shadow key={`s${i}`} b={b} />)}
          {items.map(({ b, i }) => <BuildingShape key={i} b={b} look={{ lite: o.lite, windows: o.windows, seed: seed0 + i, fogMax: 0.34 }} />)}
        </g>
      </g>
    </g>
  )
}

const NO_RISE: ReadonlySet<string> = new Set()

/** `selected` is a district or civic id (the Life map's focus, or the shell's active district). `windows` is the lit share
 *  from the time of day; `rising` holds keys (`district:index`, `district:tId`) of buildings and trees that just grew. */
export const CityScene = memo(function CityScene({ map, selected, lite = false, windows = 0.4, rising = NO_RISE }: {
  map: LifeMap; selected: string | null; lite?: boolean; windows?: number; rising?: ReadonlySet<string>
}) {
  const o: SceneOpts = { lite, windows, rising }
  const places = [
    ...map.districts.map((d) => ({ k: d.origin.x + d.origin.y, el: <DistrictShape key={d.id} d={d} selected={d.id === selected} o={o} /> })),
    ...(map.civic ?? []).map((c) => ({ k: c.origin.x + c.origin.y, el: <CivicShape key={c.id} c={c} selected={c.id === selected} o={o} /> })),
  ].sort((a, b) => a.k - b.k)
  const outskirts = map.outskirts.map((b, i) => ({ b, i })).sort((a, b) => a.b.x + a.b.y - (b.b.x + b.b.y))
  return (
    <>
      <polygon points={ground} fill="url(#lm-ground)" />
      {!lite && <path d={grid.minor} className="lm-grid" />}
      <path d={grid.major} className="lm-grid is-major" />
      <Roads roads={map.roads} />
      {/* survey rings on the ground around the centre: a quiet sense of scale */}
      {!lite && <ellipse cx={0} cy={0} rx={8.6 * 45.25} ry={8.6 * 22.63} className="lm-survey" />}
      {!lite && <ellipse cx={0} cy={0} rx={13.4 * 45.25} ry={13.4 * 22.63} className="lm-survey is-outer" />}
      <g className="lm-outskirts">
        {!lite && outskirts.map(({ b, i }) => <Shadow key={`s${i}`} b={b} />)}
        {outskirts.map(({ b, i }) => <BuildingShape key={i} b={b} look={{ lite, windows, seed: 900 + i, fogMax: 0.62 }} />)}
      </g>
      {!lite && map.cars.map((c, i) => {
        const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y, n = Math.hypot(dx, dy) || 1
        return (
          <g key={i} className="lm-car" style={{ '--ax': `${r1(c.a.x)}px`, '--ay': `${r1(c.a.y)}px`, '--bx': `${r1(c.b.x)}px`, '--by': `${r1(c.b.y)}px`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` } as CSSProperties}>
            <path d={`M0 0L${r1((-dx / n) * 18)} ${r1((-dy / n) * 18)}`} className="lm-car-trail" />
            <circle r="5" className="lm-car-glow" /><circle r="1.8" className="lm-car-dot" />
          </g>
        )
      })}
      {places.map((p) => p.el)}
    </>
  )
})

export function SceneDefs() {
  const lin = (id: string, n: number, x2 = '0', y2 = '1') => (
    <linearGradient key={id} id={`lm-${id}`} x1="0" y1="0" x2={x2} y2={y2}>
      {Array.from({ length: n }, (_, i) => <stop key={i} offset={i / (n - 1)} className={`lm-s-${id}${i}`} />)}
    </linearGradient>
  )
  return (
    <defs>
      <radialGradient id="lm-ground" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" className="lm-s-g0" /><stop offset="0.65" className="lm-s-g1" /><stop offset="1" className="lm-s-g2" />
      </radialGradient>
      <radialGradient id="lm-pool"><stop offset="0" className="lm-s-p0" /><stop offset="1" className="lm-s-p1" /></radialGradient>
      <radialGradient id="lm-shadow"><stop offset="0" className="lm-s-sh0" /><stop offset="0.55" className="lm-s-sh1" /><stop offset="1" className="lm-s-sh2" /></radialGradient>
      {/* faces lit from the back left (left face brighter), darker toward the ground (ambient occlusion) */}
      {(['fl', 'fr', 'dl', 'dr'] as const).map((id) => lin(id, 3))}
      {/* roofs: a glass sheen from the back corner toward the front */}
      {lin('tl', 3, '1', '1')}
      {lin('td', 3, '1', '1')}
    </defs>
  )
}

/** The scene's gradients, mounted once for the whole app (Home, mini-map and backdrop all reference them by id). */
export function CityDefs() {
  return <svg className="lm-defs" width="0" height="0" aria-hidden="true" focusable="false"><SceneDefs /></svg>
}
