// Small node graph: the selected object in the middle, what it points at on the left, what points at it on the right.
import { useEffect, useRef } from 'react'
import { REGISTRY, type LinkGroup, type Row, type TypeKey } from '../../ontology/registry'

const W = 640
const BOX_W = 190
const ROW = 34
const MAX = 6
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function NetworkGraph({ type, obj, groups, onOpen }: { type: TypeKey; obj: Row; groups: LinkGroup[]; onOpen: (t: TypeKey, id: number) => void }) {
  const flat = (dir: 'out' | 'in') =>
    groups.filter((g) => g.direction === dir).flatMap((g) => g.objects.map((o) => ({ g, o }))).filter((x) => x.o.id != null)
  const left = flat('out')
  const right = flat('in')
  const lShow = left.slice(0, MAX)
  const rShow = right.slice(0, MAX)
  const rows = Math.max(lShow.length, rShow.length, 1) + (left.length > MAX || right.length > MAX ? 1 : 0)
  const H = rows * ROW + 16
  const cy = H / 2
  const cx = W / 2
  const y = (i: number, n: number) => (H - n * ROW) / 2 + i * ROW + ROW / 2
  const def = REGISTRY[type]
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => { const el = box.current; if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2 }, [type, obj.id])

  const node = (x: number, yy: number, t: TypeKey, o: Row, cls = '') => (
    <g className={`node ${cls}`} key={`${t}${o.id}${x}`} onClick={() => cls || o.id == null || onOpen(t, o.id)} role={cls ? undefined : 'link'} aria-label={`${REGISTRY[t].label} ${REGISTRY[t].title(o)}`}>
      <rect x={x - BOX_W / 2} y={yy - 14} width={BOX_W} height={28} rx={3} />
      <text className="t" x={x - BOX_W / 2 + 8} y={yy - 1}>{clip(REGISTRY[t].title(o), 24)}</text>
      <text x={x - BOX_W / 2 + 8} y={yy + 10} style={{ fontSize: 9 }}>{REGISTRY[t].label.toUpperCase()} #{o.id}</text>
    </g>
  )

  return (
    <div className="ops-graph" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Links of ${def.title(obj)}`}>
        {lShow.map((x, i) => {
          const yy = y(i, lShow.length)
          return (
            <g key={`l${i}`}>
              <line x1={BOX_W / 2 + 10} y1={yy} x2={cx - BOX_W / 2} y2={cy} />
              <text x={(BOX_W / 2 + 10 + cx - BOX_W / 2) / 2} y={(yy + cy) / 2 - 4} textAnchor="middle" style={{ fill: 'var(--accent)' }}>{x.g.link.label}</text>
            </g>
          )
        })}
        {rShow.map((x, i) => {
          const yy = y(i, rShow.length)
          return (
            <g key={`r${i}`}>
              <line x1={cx + BOX_W / 2} y1={cy} x2={W - BOX_W / 2 - 10} y2={yy} />
              <text x={(cx + BOX_W / 2 + W - BOX_W / 2 - 10) / 2} y={(yy + cy) / 2 - 4} textAnchor="middle" style={{ fill: 'var(--accent)' }}>{x.g.link.label}</text>
            </g>
          )
        })}
        {lShow.map((x, i) => node(BOX_W / 2 + 10, y(i, lShow.length), x.g.type, x.o))}
        {rShow.map((x, i) => node(W - BOX_W / 2 - 10, y(i, rShow.length), x.g.type, x.o))}
        {node(cx, cy, type, obj, 'center')}
        {(left.length > MAX || right.length > MAX) && <text x={W / 2} y={H - 4} textAnchor="middle">{`+${Math.max(0, left.length - MAX) + Math.max(0, right.length - MAX)} more in the explorer`}</text>}
      </svg>
      {!lShow.length && !rShow.length && <div className="ops-label" style={{ padding: '4px 0 8px' }}>No linked objects</div>}
    </div>
  )
}
