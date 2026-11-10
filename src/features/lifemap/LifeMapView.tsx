// The Life map stage: full-bleed isometric city with a spring camera. Pan by drag or pinch, wheel or buttons to zoom,
// tap a district to focus it. Controlled: the Home page owns which district is focused and how much room the HUD takes.
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { prefersReducedMotion } from '../../components/motion'
import type { SkillId } from '../game/types'
import {
  cameraTransform, centreOn, clamp, fitCamera, padBounds, panBy, project, springSettled, springStep, worldToScreen, zoomAt,
  MAX_K, MIN_K, type Camera, type Inset, type Pt, type Size, type Spring,
} from './iso'
import { CityScene, SceneDefs } from './CityScene'
import type { LifeMap } from './model'
import './lifemap.css'

interface Props {
  map: LifeMap
  focus: SkillId | null
  onFocus: (id: SkillId | null) => void
  /** Px of the stage covered by HUD on each side; the camera frames the free area. */
  inset: Inset
  phone: boolean
}

export default function LifeMapView({ map, focus, onFocus, inset, phone }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<Size>({ w: 0, h: 0 })
  const [hover, setHover] = useState<SkillId | null>(null)
  const [cam, setCam] = useState<Camera>({ x: 0, y: 0, k: 1 })
  const camRef = useRef(cam)
  const raf = useRef(0)
  const moved = useRef(false)
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ d: number } | null>(null)
  const first = useRef(true)

  const selected = map.districts.find((d) => d.id === focus) ?? null
  const limit = useMemo(() => padBounds(map.bounds, 160), [map.bounds])
  const insetKey = `${inset.l ?? 0}|${inset.r ?? 0}|${inset.t ?? 0}|${inset.b ?? 0}`
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ins = useMemo(() => inset, [insetKey])
  const fitCam = useMemo(() => (view.w ? fitCamera(map.bounds, view, 1, phone ? ins : { ...ins, l: (ins.l ?? 0) * 0.85, r: (ins.r ?? 0) * 0.9 }) : null), [map.bounds, view, ins, phone])
  const target = useMemo<Camera | null>(() => {
    if (!fitCam) return null
    if (!selected) return fitCam
    const k = clamp(fitCam.k * (phone ? 1.9 : 1.55), MIN_K, MAX_K)
    return centreOn({ x: selected.centre.x, y: (selected.centre.y + selected.top.y) / 2 }, k, view, ins)
  }, [fitCam, selected, phone, view, ins])

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
      sx = springStep(sx, t.x, dt, 120, 21); sy = springStep(sy, t.y, dt, 120, 21); sk = springStep(sk, t.k, dt, 120, 21)
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
      e.preventDefault()
      stop()
      const r = el.getBoundingClientRect()
      set(zoomAt(camRef.current, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }, { w: r.width, h: r.height }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [set, stop])

  const zoomBy = (f: number) => goTo(zoomAt(camRef.current, f, { x: view.w / 2, y: view.h / 2 }, view))
  const fit = () => { if (focus) onFocus(null); else if (fitCam) goTo(fitCam) }

  const down = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('.lm-zoom')) return
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
    if (!moved.current && Math.hypot(dx, dy) < 5) return
    if (!moved.current) { moved.current = true; stop(); try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ } }
    pointers.current.set(e.pointerId, cur)
    set(panBy(camRef.current, dx, dy, limit))
  }
  const up = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && focus) { onFocus(null); return }
    if (e.target !== e.currentTarget) return
    if (e.key === '+' || e.key === '=') zoomBy(1.3)
    else if (e.key === '-') zoomBy(1 / 1.3)
    else if (e.key === '0') fit()
    else if (e.key.startsWith('Arrow')) {
      e.preventDefault()
      const s = 70
      goTo(panBy(camRef.current, e.key === 'ArrowLeft' ? s : e.key === 'ArrowRight' ? -s : 0, e.key === 'ArrowUp' ? s : e.key === 'ArrowDown' ? -s : 0, limit))
    }
  }

  const ready = view.w > 0
  return (
    <div className={`lm${phone ? ' is-phone' : ''}${focus ? ' has-focus' : ''}`} ref={root} data-testid="lifemap" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      <svg className="lm-svg" width={view.w} height={view.h} aria-hidden="true" focusable="false">
        <SceneDefs />
        <g transform={cameraTransform(cam, view)}>
          <CityScene map={map} selected={focus} />
        </g>
      </svg>
      <div className="lm-fog" aria-hidden="true" />

      <div className="lm-viewport" tabIndex={0} role="group" aria-label="Life map. Arrow keys pan, plus and minus zoom, zero fits the city, Escape clears the focus.">
        {ready && map.districts.map((d) => {
          const tl = worldToScreen(project(d.origin.x, d.origin.y + d.size), cam, view)
          const br = worldToScreen(project(d.origin.x + d.size, d.origin.y), cam, view)
          const bot = worldToScreen(project(d.origin.x + d.size, d.origin.y + d.size), cam, view)
          const top = worldToScreen({ x: d.centre.x, y: d.top.y - (d.beacon || d.gold ? 50 : 14) }, cam, view)
          const on = focus === d.id || hover === d.id
          return (
            <button
              key={d.id} type="button" className={`lm-hit${focus === d.id ? ' is-selected' : ''}${on ? ' is-on' : ''}${d.beacon ? ' has-beacon' : ''}`} data-district={d.id}
              style={{ left: tl.x, top: top.y, width: Math.max(44, br.x - tl.x), height: Math.max(44, bot.y - top.y) }}
              aria-pressed={focus === d.id} aria-label={`${d.label}, ${d.short}${d.beacon ? `, ${d.beacon}` : ''}`}
              onPointerEnter={() => setHover(d.id)} onPointerLeave={() => setHover((h) => (h === d.id ? null : h))}
              onFocus={() => setHover(d.id)} onBlur={() => setHover((h) => (h === d.id ? null : h))}
              onClick={() => { if (!moved.current) onFocus(focus === d.id ? null : d.id) }}
            >
              <span className="lm-label">
                <span className="lm-label-name">{d.beacon && <i className="lm-label-dot" aria-hidden="true" />}{d.label}</span>
                {on && <span className="lm-label-fig mono">{d.short}</span>}
              </span>
            </button>
          )
        })}
      </div>

      <div className="lm-zoom" role="group" aria-label="Map zoom">
        <button type="button" className="lm-zbtn" onClick={() => zoomBy(1.3)} aria-label="Zoom in">+</button>
        <button type="button" className="lm-zbtn" onClick={() => zoomBy(1 / 1.3)} aria-label="Zoom out">&minus;</button>
        <button type="button" className="lm-zbtn is-text" onClick={fit}>Fit</button>
      </div>

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
