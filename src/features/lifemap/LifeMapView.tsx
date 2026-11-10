// The Life map: isometric SVG city of the five areas. Pan by drag or pinch, wheel/buttons to zoom, tap a district to centre it and open its panel.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { prefersReducedMotion } from '../../components/motion'
import type { SkillId } from '../game/types'
import {
  blockFaces, cameraTransform, centreOn, clamp, fitCamera, padBounds, panBy, project, pts, springSettled, springStep, worldToScreen, zoomAt,
  MAX_K, MIN_K, type Camera, type Inset, type Pt, type Size, type Spring,
} from './iso'
import type { District, LifeMap } from './model'
import './lifemap.css'

const HINT: Record<SkillId, string> = {
  body: 'Log a weigh-in or a meal and these blocks start to rise.',
  money: 'Add an account balance or sort a transaction to start this district.',
  mind: 'Write a journal line or log a study session to start this district.',
  career: 'Log a win to start this district.',
  people: 'Add someone and log a contact to start this district.',
}

const GRID = 12
const gridPath = (() => {
  const a: string[] = []
  for (let i = -GRID; i <= GRID; i++) {
    const p = project(i, -GRID), q = project(i, GRID)
    const r = project(-GRID, i), s = project(GRID, i)
    a.push(`M${p.x} ${p.y}L${q.x} ${q.y}M${r.x} ${r.y}L${s.x} ${s.y}`)
  }
  return a.join('')
})()
const groundPoly = pts([project(-GRID, -GRID), project(GRID, -GRID), project(GRID, GRID), project(-GRID, GRID)])

function Roads({ districts }: { districts: District[] }) {
  const hub = districts.find((d) => d.id === 'money')
  if (!hub) return null
  const c = (d: District) => ({ x: d.origin.x + d.size / 2, y: d.origin.y + d.size / 2 })
  const h = c(hub)
  const d = districts.filter((x) => x.id !== 'money').map((x) => {
    const t = c(x)
    const a = project(h.x, h.y), b = project(t.x, t.y)
    return `M${a.x} ${a.y}L${b.x} ${b.y}`
  }).join('')
  return <><path d={d} className="lm-road" /><path d={d} className="lm-road-line" /></>
}

function Tower({ d, selected }: { d: District; selected: boolean }) {
  const [ox, oy] = [d.origin.x, d.origin.y]
  const plinth = blockFaces(ox, oy, d.size, d.size, 5)
  const e = (b: { lit: boolean }) => (b.lit ? 0.55 + 0.45 * d.glow : 0.26)
  const blocks = [...d.blocks].sort((a, b) => a.x + a.y - (b.x + b.y))
  const cx = d.centre.x
  const glow = project(ox + d.size / 2, oy + d.size / 2)
  return (
    <g className={`lm-district${selected ? ' is-selected' : ''}`} style={{ ['--g' as string]: d.glow }}>
      <ellipse className="lm-halo" cx={glow.x} cy={glow.y} rx={d.size * 40} ry={d.size * 19} fill="url(#lm-halo)" />
      <polygon points={pts(plinth.top)} className="lm-plinth-top" />
      <polygon points={pts(plinth.left)} className="lm-plinth-l" />
      <polygon points={pts(plinth.right)} className="lm-plinth-r" />
      {blocks.map((b, i) => {
        const f = blockFaces(ox + b.x, oy + b.y, b.w, b.d, b.h + 5)
        const rows: string[] = []
        if (b.lit && b.h > 24) {
          const l = f.left
          for (let z = 14; z < b.h - 4; z += 9) {
            const t0 = 0.18, t1 = 0.82
            const a = { x: l[3].x + (l[2].x - l[3].x) * t0, y: l[3].y + (l[2].y - l[3].y) * t0 - z }
            const c2 = { x: l[3].x + (l[2].x - l[3].x) * t1, y: l[3].y + (l[2].y - l[3].y) * t1 - z }
            rows.push(`M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${c2.x.toFixed(1)} ${c2.y.toFixed(1)}`)
          }
        }
        return (
          <g key={i} className={b.lit ? 'lm-block is-lit' : 'lm-block'} style={{ ['--e' as string]: e(b) }}>
            <polygon points={pts(f.left)} className="lm-face-l" />
            <polygon points={pts(f.right)} className="lm-face-r" />
            <polygon points={pts(f.top)} className="lm-face-t" />
            {rows.length > 0 && <path d={rows.join('')} className="lm-windows" />}
          </g>
        )
      })}
      {d.beacon && (
        <g className="lm-beacon" transform={`translate(${cx} ${d.top.y - 30})`}>
          <line x1="0" y1="2" x2="0" y2="26" className="lm-beacon-stem" />
          <circle r="9" className="lm-beacon-ring" />
          <circle r="4.5" className="lm-beacon-dot" />
        </g>
      )}
      {d.gold && (
        <g transform={`translate(${cx + 34} ${d.top.y - 18})`} className="lm-gold">
          <line x1="0" y1="4" x2="0" y2="22" className="lm-gold-stem" />
          <polygon points="0,-8 7,0 0,8 -7,0" />
        </g>
      )}
    </g>
  )
}

export default function LifeMapView({ map }: { map: LifeMap }) {
  const root = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<Size>({ w: 0, h: 0 })
  const [sel, setSel] = useState<SkillId | null>(null)
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 })
  const camRef = useRef(cam)
  const raf = useRef(0)
  const moved = useRef(false)
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ d: number } | null>(null)
  const first = useRef(true)

  const phone = view.w > 0 && view.w < 720
  const selected = map.districts.find((d) => d.id === sel) ?? null
  const limit = useMemo(() => padBounds(map.bounds, 120), [map.bounds])

  const inset = useCallback((open: boolean): Inset => (phone ? { t: 84, b: open ? 330 : 64 } : { l: open ? 0 : 250, r: open ? 380 : 0, b: 70, t: 20 }), [phone])
  const fitCam = useMemo(() => (view.w ? fitCamera(map.bounds, view, phone ? 1.12 : 0.96, inset(false)) : null), [map.bounds, view, inset, phone])
  const target = useMemo<Camera | null>(() => {
    if (!fitCam) return null
    if (!selected) return fitCam
    const k = clamp(fitCam.k * (phone ? 1.9 : 1.3), MIN_K, MAX_K)
    return centreOn({ x: selected.centre.x, y: (selected.centre.y + selected.top.y) / 2 - 6 }, k, view, inset(true))
  }, [fitCam, selected, phone, view, inset])

  const set = useCallback((c: Camera) => { camRef.current = c; setCam(c) }, [])
  const stop = useCallback(() => { cancelAnimationFrame(raf.current); raf.current = 0 }, [])
  const goTo = useCallback((t: Camera, instant = false) => {
    stop()
    if (instant || prefersReducedMotion()) { set(t); return }
    let sx: Spring = { v: camRef.current.x, vel: 0 }, sy: Spring = { v: camRef.current.y, vel: 0 }, sk: Spring = { v: camRef.current.k, vel: 0 }
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      sx = springStep(sx, t.x, dt, 130, 19); sy = springStep(sy, t.y, dt, 130, 19); sk = springStep(sk, t.k, dt, 130, 19)
      if (springSettled(sx, t.x, 0.05) && springSettled(sy, t.y, 0.05) && springSettled(sk, t.k, 0.0008)) { set(t); raf.current = 0; return }
      set({ x: sx.v, y: sy.v, k: clamp(sk.v, MIN_K, MAX_K) })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [set, stop])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setView({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => stop, [stop])

  // Follow the target: instant on first layout, springy afterwards.
  const tKey = target ? `${target.x.toFixed(1)}|${target.y.toFixed(1)}|${target.k.toFixed(3)}` : ''
  useEffect(() => {
    if (!target) return
    goTo(target, first.current)
    first.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey])

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('.lm-panel, .lm-tabs, .lm-overview')) return
      e.preventDefault()
      stop()
      const r = el.getBoundingClientRect()
      set(zoomAt(camRef.current, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }, { w: r.width, h: r.height }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [set, stop])

  const zoomBy = (f: number) => goTo(zoomAt(camRef.current, f, { x: view.w / 2, y: view.h / 2 }, view))
  const fit = () => { setSel(null); if (fitCam) goTo(fitCam) }
  const pick = (id: SkillId | null) => { if (id === sel) return; setSel(id) }

  const down = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('.lm-panel, .lm-tabs, .lm-overview, .lm-zoom')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    moved.current = false
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y) }
    }
  }
  const move = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 2 && pinch.current) {
      pointers.current.set(e.pointerId, cur)
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const r = root.current!.getBoundingClientRect()
      stop(); moved.current = true
      set(zoomAt(camRef.current, d / pinch.current.d, { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }, view))
      pinch.current.d = d
      return
    }
    const dx = cur.x - prev.x, dy = cur.y - prev.y
    if (!moved.current && Math.hypot(dx, dy) < 4) return
    if (!moved.current) { moved.current = true; stop(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ } }
    pointers.current.set(e.pointerId, cur)
    set(panBy(camRef.current, dx, dy, limit))
  }
  const up = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && sel) { setSel(null); return }
    if (e.target !== e.currentTarget) return
    if (e.key === '+' || e.key === '=') zoomBy(1.3)
    else if (e.key === '-') zoomBy(1 / 1.3)
    else if (e.key === '0') fit()
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      const s = 60
      goTo(panBy(camRef.current, e.key === 'ArrowLeft' ? s : e.key === 'ArrowRight' ? -s : 0, e.key === 'ArrowUp' ? s : e.key === 'ArrowDown' ? -s : 0, limit))
    }
  }

  const ready = view.w > 0
  return (
    <div className={`lm${phone ? ' is-phone' : ''}${selected ? ' has-panel' : ''}`} ref={root} data-testid="lifemap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      <svg className="lm-svg" width={view.w} height={view.h} aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="lm-halo"><stop offset="0" stopColor="var(--accent)" stopOpacity="0.5" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></radialGradient>
        </defs>
        <g transform={cameraTransform(cam, view)}>
          <polygon points={groundPoly} className="lm-ground" />
          <path d={gridPath} className="lm-grid" />
          <Roads districts={map.districts} />
          {[...map.districts].sort((a, b) => a.origin.x + a.origin.y - (b.origin.x + b.origin.y)).map((d) => <Tower key={d.id} d={d} selected={d.id === sel} />)}
        </g>
      </svg>
      <div className="lm-vignette" aria-hidden="true" />

      <div className="lm-viewport" tabIndex={0} role="group" aria-label="Life map. Drag to pan, plus and minus to zoom, zero to fit.">
        {ready && map.districts.map((d) => {
          const tl = worldToScreen(project(d.origin.x, d.origin.y + d.size), cam, view)
          const br = worldToScreen(project(d.origin.x + d.size, d.origin.y), cam, view)
          const bot = worldToScreen(project(d.origin.x + d.size, d.origin.y + d.size), cam, view)
          const top = worldToScreen({ x: d.centre.x, y: d.top.y - 58 }, cam, view)
          const left = tl.x, width = br.x - tl.x
          return (
            <button
              key={d.id} type="button" className={`lm-hit${sel === d.id ? ' is-selected' : ''}${d.beacon ? ' has-beacon' : ''}`} data-district={d.id}
              style={{ left, top: top.y, width, height: Math.max(40, bot.y - top.y) }}
              aria-pressed={sel === d.id} aria-label={`${d.label}, ${d.short}${d.beacon ? `, ${d.beacon}` : ''}. Open details`}
              onClick={() => { if (!moved.current) pick(sel === d.id ? null : d.id) }}
            >
              <span className="lm-label"><b>{d.label}</b><span className="mono">{d.short}</span></span>
            </button>
          )
        })}
      </div>

      <div className="lm-overview" aria-label="Overview">
        <dl>
          <div><dt>Net worth</dt><dd className="mono">{map.overview.netWorth}</dd></div>
          <div><dt>Active days</dt><dd className="mono">{map.overview.activeDays}</dd></div>
          <div><dt>To contact</dt><dd className="mono">{map.overview.toContact}</dd></div>
          <div><dt>Plan left</dt><dd className="mono">{map.overview.planLeft}</dd></div>
        </dl>
        {map.empty && <p className="lm-hint">Nothing counted yet. Log a weigh-in, a balance or a message to someone and the nearest district rises.</p>}
      </div>

      <div className="lm-zoom" role="group" aria-label="Map zoom">
        <button type="button" className="btn btn-sm" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
        <button type="button" className="btn btn-sm" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">&minus;</button>
        <button type="button" className="btn btn-sm" onClick={fit}>Fit</button>
      </div>

      {selected && (
        <aside className="lm-panel" aria-label={`${selected.label} details`} data-testid="lifemap-panel">
          <div className="lm-panel-head">
            <h2>{selected.label}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(null)} aria-label={`Close ${selected.label} details`}>Close</button>
          </div>
          {selected.beacon && <p className="lm-warn">{selected.beacon}</p>}
          {selected.gold && <p className="lm-earned">Milestone logged this week</p>}
          <dl className="lm-facts">
            {selected.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd className="mono">{f.value}</dd></div>)}
          </dl>
          {selected.days === 0 && <p className="lm-hint">{HINT[selected.id]}</p>}
          <Link className="btn btn-primary" to={selected.to}>Open {selected.label}</Link>
        </aside>
      )}

      <nav className="lm-tabs" aria-label="Districts">
        {map.districts.map((d) => (
          <button key={d.id} type="button" className="lm-tab" data-tab={d.id} aria-pressed={sel === d.id} onClick={() => pick(sel === d.id ? null : d.id)}>
            <span>{d.label}</span>
            {d.beacon && <i className="lm-tab-dot" aria-hidden="true" />}
          </button>
        ))}
      </nav>

      <table className="sr-only">
        <caption>Life map, this week</caption>
        <thead><tr><th scope="col">Area</th><th scope="col">Figures</th><th scope="col">Needs attention</th></tr></thead>
        <tbody>
          {map.districts.map((d) => (
            <tr key={d.id}>
              <th scope="row"><Link to={d.to}>{d.label}</Link></th>
              <td>{d.facts.map((f) => `${f.label}: ${f.value}`).join('. ')}</td>
              <td>{d.beacon ?? 'No'}{d.gold ? '. Milestone this week' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
