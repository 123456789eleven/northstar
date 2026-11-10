// The Life map city as SVG, in world px (camera applied by the parent). Memoised: camera moves never re-render the scene.
import { memo, type CSSProperties } from 'react'
import type { SkillId } from '../game/types'
import { blockFaces, project, pts, type Pt } from './iso'
import { GROUND, type Building, type District, type LifeMap, type Road, type Tree } from './model'

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

function BuildingShape({ b }: { b: Building }) {
  const f = blockFaces(b.x, b.y, b.w, b.d, b.h)
  const [l0, l1, l2, l3] = f.left // top-left, top-right, bottom-right, bottom-left (left face, +y side)
  const [r0, r1_, r2, r3] = f.right // top-back, top-front, bottom-front, bottom-back (right face, +x side)
  let detail = ''
  if (b.bands > 0 && b.h > 18) {
    for (let z = b.bands; z < b.h - 5; z += b.bands) {
      detail += M(up(lerp(l3, l2, 0.1), z)) + L(up(lerp(l3, l2, 0.9), z))
      detail += M(up(lerp(r3, r2, 0.1), z)) + L(up(lerp(r3, r2, 0.9), z))
    }
  }
  for (let i = 1; i <= b.mullions; i++) {
    const t = i / (b.mullions + 1)
    detail += M(lerp(l3, l2, t)) + L(lerp(l0, l1, t)) + M(lerp(r3, r2, t)) + L(lerp(r0, r1_, t))
  }
  const edges = `${M(l3)}${L(l0)}${M(l2)}${L(l1)}${M(r3)}${L(r0)}${M(f.top[0])}${L(f.top[1])}${L(f.top[2])}${L(f.top[3])}Z`
  let roof = null
  if (b.roof === 'spire') {
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
  return (
    <g className={b.lit ? 'lm-b is-lit' : 'lm-b'} style={{ '--e': b.e.toFixed(2) } as CSSProperties}>
      <polygon points={pts(f.left)} className="lm-face-l" />
      <polygon points={pts(f.right)} className="lm-face-r" />
      <polygon points={pts(f.top)} className="lm-face-t" />
      {detail && <path d={detail} className="lm-win" />}
      {b.lit && <path d={edges} className="lm-edge-glow" />}
      <path d={edges} className="lm-edge" />
      {roof}
    </g>
  )
}

function TreeShape({ t }: { t: Tree }) {
  const base = project(t.x, t.y)
  const crown = up(base, 24)
  const R = 17
  const C = 2 * Math.PI * R
  return (
    <g className={`lm-tree${t.placeholder ? ' is-placeholder' : ''}${t.overdue ? ' is-overdue' : ''}`}>
      <ellipse cx={r1(base.x)} cy={r1(base.y)} rx={14} ry={7} className="lm-tree-shadow" />
      <path d={`${M(base)}${L(crown)}`} className="lm-trunk" />
      <circle cx={r1(crown.x)} cy={r1(crown.y)} r={12} className="lm-crown" />
      {!t.placeholder && (t.overdue
        ? <circle cx={r1(crown.x)} cy={r1(crown.y)} r={R} className="lm-leafring is-overdue" />
        : t.ring !== null && <circle cx={r1(crown.x)} cy={r1(crown.y)} r={R} className="lm-leafring" strokeDasharray={`${r1(C * t.ring)} ${r1(C)}`} transform={`rotate(-90 ${r1(crown.x)} ${r1(crown.y)})`} />)}
    </g>
  )
}

function Plinth({ d }: { d: District }) {
  const f = blockFaces(d.origin.x, d.origin.y, d.size, d.size, 4)
  const c = project(d.origin.x + d.size / 2, d.origin.y + d.size / 2)
  return (
    <>
      <ellipse cx={r1(c.x)} cy={r1(c.y)} rx={d.size * 62} ry={d.size * 31} fill="url(#lm-pool)" className="lm-pool" />
      <polygon points={pts(f.left)} className="lm-plinth-side" />
      <polygon points={pts(f.right)} className="lm-plinth-side is-r" />
      <polygon points={pts(f.top)} className="lm-plinth" />
    </>
  )
}

function DistrictShape({ d, selected }: { d: District; selected: boolean }) {
  const items = [
    ...d.buildings.map((b, i) => ({ k: `b${i}`, depth: b.x + b.w + b.y + b.d, el: <BuildingShape key={`b${i}`} b={b} /> })),
    ...d.trees.map((t) => ({ k: `t${t.id}`, depth: t.x + t.y + 0.5, el: <TreeShape key={`t${t.id}`} t={t} /> })),
  ].sort((a, b) => a.depth - b.depth)
  const cx = d.centre.x
  const last = d.path[d.path.length - 1]
  const flag = last ? project(last.x + 0.18, last.y + 0.18) : null
  return (
    <g className={`lm-district${selected ? ' is-selected' : ''}`} data-d={d.id} style={{ '--g': d.glow.toFixed(2) } as CSSProperties}>
      <Plinth d={d} />
      {d.id === 'people' && <ellipse cx={r1(d.centre.x)} cy={r1(d.centre.y - 4)} rx={d.size * 22} ry={d.size * 11} className="lm-park-path" />}
      {d.path.map((s, i) => <polygon key={i} className={s.lit ? 'lm-step is-lit' : 'lm-step'} points={pts([project(s.x, s.y), project(s.x + 0.36, s.y), project(s.x + 0.36, s.y + 0.36), project(s.x, s.y + 0.36)].map((p) => up(p, 4)))} />)}
      {flag && (
        <g className={d.pathDone ? 'lm-flag is-earned' : 'lm-flag'} transform={`translate(${r1(flag.x)} ${r1(flag.y - 4)})`}>
          <line x1="0" y1="0" x2="0" y2="-22" /><polygon points="0,-22 10,-18 0,-14" />
        </g>
      )}
      {items.map((x) => x.el)}
      {d.beacon && (
        <g className="lm-beacon" transform={`translate(${r1(cx)} ${r1(d.top.y - 18)})`}>
          <line x1="0" y1="4" x2="0" y2="22" className="lm-beacon-stem" />
          <circle r="10" className="lm-beacon-ring" />
          <circle r="4.5" className="lm-beacon-dot" />
        </g>
      )}
      {d.gold && (
        <g transform={`translate(${r1(cx + 30)} ${r1(d.top.y - 8)})`} className="lm-gold">
          <line x1="0" y1="4" x2="0" y2="20" />
          <polygon points="0,-7 6,0 0,7 -6,0" />
        </g>
      )}
    </g>
  )
}

export const CityScene = memo(function CityScene({ map, selected }: { map: LifeMap; selected: SkillId | null }) {
  const order = [...map.districts].sort((a, b) => a.origin.x + a.origin.y - (b.origin.x + b.origin.y))
  const outskirts = [...map.outskirts].sort((a, b) => a.x + a.y - (b.x + b.y))
  return (
    <>
      <polygon points={ground} fill="url(#lm-ground)" />
      <path d={grid.minor} className="lm-grid" />
      <path d={grid.major} className="lm-grid is-major" />
      <Roads roads={map.roads} />
      <g className="lm-outskirts">{outskirts.map((b, i) => <BuildingShape key={i} b={b} />)}</g>
      {map.cars.map((c, i) => (
        <g key={i} className="lm-car" style={{ '--ax': `${r1(c.a.x)}px`, '--ay': `${r1(c.a.y)}px`, '--bx': `${r1(c.b.x)}px`, '--by': `${r1(c.b.y)}px`, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` } as CSSProperties}>
          <circle r="5" className="lm-car-glow" /><circle r="1.8" className="lm-car-dot" />
        </g>
      ))}
      {order.map((d) => <DistrictShape key={d.id} d={d} selected={d.id === selected} />)}
    </>
  )
})

export function SceneDefs() {
  return (
    <defs>
      <radialGradient id="lm-ground" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" className="lm-s-g0" /><stop offset="0.65" className="lm-s-g1" /><stop offset="1" className="lm-s-g2" />
      </radialGradient>
      <radialGradient id="lm-pool"><stop offset="0" className="lm-s-p0" /><stop offset="1" className="lm-s-p1" /></radialGradient>
      {(['fl', 'fr', 'dl', 'dr'] as const).map((id) => (
        <linearGradient key={id} id={`lm-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={`lm-s-${id}0`} /><stop offset="1" className={`lm-s-${id}1`} />
        </linearGradient>
      ))}
    </defs>
  )
}
