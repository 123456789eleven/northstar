// The People tree: you at the trunk, one branch per relation, a leaf per person. Ring = contact health (full when recent,
// draining toward the due date, poppy only when overdue, neutral with no cadence). SVG, pan and zoom, arrow-key navigation.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ISODate, Person } from '../../db'
import { personStatus } from './people'
import { type Branch, type Dir, type TNode, firstName, fitView, layoutTree, navigate, ringFraction } from './tree'

interface Props {
  branches: Branch[]
  collapsed: ReadonlySet<string>
  now: ISODate
  selectedId?: number | null
  onToggle: (branchKey: string) => void
  onOpen: (personId: number) => void
  onAdd: (relation: string) => void
}

const R = 20
const ARROWS: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }
const clampK = (k: number) => Math.min(2.2, Math.max(0.3, k))
const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function TreeView({ branches, collapsed, now, selectedId, onToggle, onOpen, onAdd }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [active, setActive] = useState<string>('')
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ moved: boolean; dist: number } | null>(null)
  const justDragged = useRef(false)

  const perRow = size.w >= 1000 ? 8 : size.w >= 640 ? 6 : 3
  const layout = useMemo(() => layoutTree(branches, collapsed, { perRow }), [branches, collapsed, perRow])
  const byPerson = useMemo(() => new Map(branches.flatMap((b) => b.people).map((p) => [p.id!, p])), [branches])
  const branchOf = useMemo(() => new Map(branches.map((b) => [b.key, b])), [branches])
  const focusable = useMemo(() => layout.nodes.filter((n) => n.kind !== 'root'), [layout])
  const activeKey = focusable.some((n) => n.key === active) ? active : (focusable[0]?.key ?? '')

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => { if (size.w > 0) setView(fitView(layout.bounds, size.w, size.h)) }, [layout.bounds, size.w, size.h])
  // Refit when the shape of the tree changes (people added, branch opened or closed, width class changed).
  const shape = `${layout.nodes.length}:${perRow}:${size.w > 0}`
  useEffect(() => { fit() }, [shape]) // eslint-disable-line react-hooks/exhaustive-deps

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const k = clampK(v.k * factor)
      const f = k / v.k
      return { k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f }
    })
  }, [])
  const zoomCentre = (factor: number) => zoomAt(factor, size.w / 2, size.h / 2)

  // Ctrl/cmd + wheel (and trackpad pinch) zooms around the cursor; a plain wheel keeps scrolling the page.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current = { moved: false, dist: 0 }
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    const g = gesture.current
    if (!prev || !g) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 1) {
      const dx = cur.x - prev.x, dy = cur.y - prev.y
      if (!g.moved && Math.hypot(dx, dy) < 3) return
      if (!g.moved) { g.moved = true; try { box.current?.setPointerCapture(e.pointerId) } catch { /* ignore */ } }
      pointers.current.set(e.pointerId, cur)
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
    } else if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, cur)
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const r = box.current!.getBoundingClientRect()
      if (g.dist > 0) zoomAt(dist / g.dist, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top)
      g.dist = dist
      g.moved = true
    }
  }
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (gesture.current?.moved) { justDragged.current = true; setTimeout(() => { justDragged.current = false }, 0) }
    if (pointers.current.size === 0) gesture.current = null
  }

  const focusNode = (key: string) => {
    setActive(key)
    const el = box.current?.querySelector<SVGGElement>(`[data-k="${CSS.escape(key)}"]`)
    el?.focus()
    const n = layout.nodes.find((x) => x.key === key)
    if (n) {
      const sx = n.x * view.k + view.x, sy = n.y * view.k + view.y
      const m = 48
      if (sx < m || sx > size.w - m || sy < m || sy > size.h - m) setView((v) => ({ ...v, x: size.w / 2 - n.x * v.k, y: size.h / 2 - n.y * v.k }))
    }
  }
  const activate = (n: TNode) => {
    if (n.kind === 'branch') onToggle(n.branch!)
    else if (n.kind === 'person') onOpen(n.personId!)
    else if (n.kind === 'add') onAdd(branchOf.get(n.branch!)?.relation ?? '')
  }
  const handle = (n: TNode) => ({
    'data-k': n.key,
    tabIndex: n.key === activeKey ? 0 : -1,
    onFocus: () => setActive(n.key),
    onClick: () => { if (!justDragged.current) activate(n) },
    onKeyDown: (e: React.KeyboardEvent) => {
      const dir = ARROWS[e.key]
      if (dir) { e.preventDefault(); const next = navigate(focusable, n.key, dir); if (next !== n.key) focusNode(next) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(n) }
    },
  })

  let leafIndex = 0
  return (
    <div className="ppl-tree" data-testid="people-tree">
      <div className="ppl-canvas" ref={box} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <svg className="ppl-tree-svg" role="group" aria-label="Tree of the people you know, grouped by relation. Use the arrow keys to move between people and Enter to open one. The List view has the same information as text.">
          <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {layout.nodes.filter((n) => n.path).map((n) => (
              <path key={`l:${n.key}`} className="ppl-limb" d={n.path} />
            ))}
            {layout.nodes.map((n) => {
              if (n.kind === 'root') {
                return (
                  <g key="root" transform={`translate(${n.x} ${n.y})`} className="ppl-root" aria-hidden>
                    <circle r={26} />
                    <text y={4} textAnchor="middle">You</text>
                  </g>
                )
              }
              if (n.kind === 'branch') {
                const b = branchOf.get(n.branch!)!
                const shut = collapsed.has(b.key)
                const label = `${b.label} ${b.people.length}`
                const w = Math.max(84, label.length * 7.4 + 38)
                return (
                  <g key={n.key} transform={`translate(${n.x} ${n.y})`} className="ppl-node ppl-branch" role="button" aria-expanded={!shut}
                    aria-label={`${b.label}, ${b.people.length} ${b.people.length === 1 ? 'person' : 'people'}, ${shut ? 'collapsed' : 'expanded'}`} {...handle(n)}>
                    <rect className="ppl-branch-pill" x={-w / 2} y={-17} width={w} height={34} rx={17} />
                    <text className="ppl-branch-label" x={-w / 2 + 14} y={4}>{b.label}</text>
                    <text className="ppl-branch-count" x={w / 2 - 12} y={4} textAnchor="end">{b.people.length}</text>
                  </g>
                )
              }
              const idx = leafIndex++
              const style = { animationDelay: `${Math.min(idx, 14) * 22}ms` }
              if (n.kind === 'add') {
                const b = branchOf.get(n.branch!)!
                return (
                  <g key={n.key} transform={`translate(${n.x} ${n.y})`} className="ppl-node ppl-add-node" role="button" aria-label={`Add a person to ${b.label}`} {...handle(n)}>
                    <g className="ppl-pop" style={style}>
                      <circle className="ppl-hit" r={R} />
                      <circle className="ppl-add-circle" r={13} />
                      <path className="ppl-add-plus" d="M-5 0h10M0 -5v10" />
                    </g>
                  </g>
                )
              }
              const p = byPerson.get(n.personId!) as Person
              const ring = ringFraction(p, now)
              const st = personStatus(p, now)
              return (
                <g key={n.key} transform={`translate(${n.x} ${n.y})`} className={`ppl-node ppl-person ${selectedId === p.id ? 'is-selected' : ''}`} role="button"
                  aria-label={`${p.name}, ${st.text.replace(' · never logged', '')}`} data-person={p.id} {...handle(n)}>
                  <g className="ppl-pop" style={style}>
                    <title>{`${p.name}, ${st.text.replace(' · never logged', '')}`}</title>
                    <circle className="ppl-glow" r={R + 6} />
                    <circle className="ppl-disc" r={R} />
                    <circle className={ring.fraction === null ? 'ppl-track is-neutral' : 'ppl-track'} r={R + 3} />
                    {ring.overdue && <circle className="ppl-arc is-overdue" r={R + 3} />}
                    {!ring.overdue && ring.fraction !== null && ring.fraction > 0 && (
                      <circle className="ppl-arc" r={R + 3} pathLength={100} strokeDasharray={`${ring.fraction * 100} 100`} transform="rotate(-90)" />
                    )}
                    <text className="ppl-initial" y={5} textAnchor="middle">{p.name.trim().charAt(0).toUpperCase()}</text>
                    <text className="ppl-leaf-label" y={R + 20} textAnchor="middle">{trunc(firstName(p.name), 11)}</text>
                  </g>
                </g>
              )
            })}
          </g>
        </svg>
        <div className="ppl-zoom" role="group" aria-label="Tree view controls">
          <button type="button" className="btn btn-sm" onClick={fit}>Fit</button>
          <button type="button" className="btn btn-sm ppl-zbtn" onClick={() => zoomCentre(1.25)} aria-label="Zoom in">+</button>
          <button type="button" className="btn btn-sm ppl-zbtn" onClick={() => zoomCentre(0.8)} aria-label="Zoom out">−</button>
        </div>
      </div>
    </div>
  )
}
