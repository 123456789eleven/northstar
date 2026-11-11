// The Life map stage: full-bleed isometric city under a perspective tilt, with a spring camera. Pan by drag or pinch, wheel or
// buttons to zoom, Q and E (or the rotate buttons) turn the city a quarter, tap a district to focus it. Controlled: the Home
// page owns which district is focused and how much room the HUD takes.
// Performance: the scene is memoised and only re-renders when the data, rotation or lighting step changes. One
// requestAnimationFrame loop drives the camera, tilt and rotation swing and writes transforms straight to DOM nodes (no React
// render per frame); it stops as soon as everything settles.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { prefersReducedMotion } from '../../components/motion'
import { isTypingTarget } from '../../components/shortcutsData'
import type { SkillId } from '../game/types'
import {
  cameraTransform, centreOn, clamp, fitCamera, padBounds, panBy, project, quarter, rotateTile, springSettled, springStep, swingTransform,
  tiltCss, tiltPoint, unproject, worldToScreen, zoomAt, MAX_K, MIN_K, type Camera, type Inset, type Pt, type Size, type Spring, type Tilt,
} from './iso'
import { CityScene } from './CityScene'
import { useRising } from './growth'
import { rotateMap } from './rotate'
import { setCityRotation, useCityRotation } from './rotation'
import { useLighting } from './useLighting'
import type { District, LifeMap } from './model'
import './lifemap.css'

interface Props {
  map: LifeMap
  focus: SkillId | null
  onFocus: (id: SkillId | null) => void
  /** Px of the stage covered by HUD on each side; the camera frames the free area. */
  inset: Inset
  phone: boolean
}

/** Resting tilt of the stage (degrees): the far side of the city recedes. */
const BASE: Tilt = { rx: 11, ry: 0 }
/** Rotation swing: how far the old view turns before the new one takes over (radians), and its fade-out time. */
const SWING = 0.42
const SWING_OUT_MS = 170
const SWING_IN_MS = 260

/** Drifting light motes: fixed, deterministic positions (screen space, percent). */
const MOTES = [
  [12, 72, 0, 19], [26, 58, -6, 23], [38, 80, -12, 17], [52, 66, -3, 26], [61, 84, -15, 21],
  [70, 62, -9, 24], [82, 76, -18, 18], [90, 60, -2, 28], [46, 90, -21, 22],
] as const

interface CamAnim { x: Spring; y: Spring; k: Spring; t: Camera; stiff: number; damp: number }
interface SwingAnim { phase: 'out' | 'wait' | 'in'; t0: number; dir: number; next: number; th: Spring }
interface Anim { cam: CamAnim | null; tilt: { x: Spring; y: Spring; t: Tilt }; swing: SwingAnim | null }

function hitBox(d: District, cam: Camera, view: Size, tilt: Tilt) {
  const s = (p: Pt) => tiltPoint(worldToScreen(p, cam, view), view, tilt)
  const tl = s(project(d.origin.x, d.origin.y + d.size))
  const br = s(project(d.origin.x + d.size, d.origin.y))
  const bot = s(project(d.origin.x + d.size, d.origin.y + d.size))
  const top = s({ x: d.centre.x, y: d.top.y - (d.beacon || d.gold ? 50 : 14) })
  return { left: tl.x, top: top.y, width: Math.max(44, br.x - tl.x), height: Math.max(44, bot.y - top.y) }
}

export default function LifeMapView({ map: base, focus, onFocus, inset, phone }: Props) {
  const wanted = useCityRotation()
  const [rot, setRot] = useState(wanted)
  const map = useMemo(() => rotateMap(base, rot), [base, rot])
  const light = useLighting()
  const rising = useRising(base)

  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const camG = useRef<SVGGElement>(null)
  const swingG = useRef<SVGGElement>(null)
  const motes = useRef<HTMLDivElement>(null)
  const hits = useRef(new Map<string, HTMLButtonElement>())
  const [view, setView] = useState<Size>({ w: 0, h: 0 })
  const [hover, setHover] = useState<SkillId | null>(null)
  const camRef = useRef<Camera>({ x: 0, y: 0, k: 1 })
  const tiltRef = useRef<Tilt>(BASE)
  const anim = useRef<Anim>({ cam: null, tilt: { x: { v: BASE.rx, vel: 0 }, y: { v: BASE.ry, vel: 0 }, t: BASE }, swing: null })
  const raf = useRef(0)
  const last = useRef(0)
  const moved = useRef(false)
  const pointers = useRef(new Map<number, Pt>())
  const pinch = useRef<{ d: number } | null>(null)
  const first = useRef(true)
  const live = useRef({ map, view })
  live.current = { map, view }

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

  /** Write the camera, tilt and label positions to the DOM. */
  const apply = useCallback(() => {
    const { map: m, view: v } = live.current
    const c = camRef.current, t = tiltRef.current
    camG.current?.setAttribute('transform', cameraTransform(c, v))
    if (stage.current) stage.current.style.transform = tiltCss(t)
    if (motes.current) motes.current.style.transform = `translate3d(${(t.ry * -5).toFixed(1)}px, ${((t.rx - BASE.rx) * 4).toFixed(1)}px, 0)`
    if (!v.w) return
    for (const d of m.districts) {
      const el = hits.current.get(d.id)
      if (!el) continue
      const b = hitBox(d, c, v, t)
      el.style.left = `${b.left}px`; el.style.top = `${b.top}px`; el.style.width = `${b.width}px`; el.style.height = `${b.height}px`
    }
  }, [])

  const loop = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - last.current) / 1000)
    last.current = now
    const a = anim.current
    let busy = false
    if (a.cam) {
      const ca = a.cam
      ca.x = springStep(ca.x, ca.t.x, dt, ca.stiff, ca.damp); ca.y = springStep(ca.y, ca.t.y, dt, ca.stiff, ca.damp); ca.k = springStep(ca.k, ca.t.k, dt, ca.stiff, ca.damp)
      if (springSettled(ca.x, ca.t.x, 0.05) && springSettled(ca.y, ca.t.y, 0.05) && springSettled(ca.k, ca.t.k, 0.0008)) { camRef.current = ca.t; a.cam = null }
      else { camRef.current = { x: ca.x.v, y: ca.y.v, k: clamp(ca.k.v, MIN_K, MAX_K) }; busy = true }
    }
    const tl = a.tilt
    tl.x = springStep(tl.x, tl.t.rx, dt, 50, 13); tl.y = springStep(tl.y, tl.t.ry, dt, 50, 13)
    if (springSettled(tl.x, tl.t.rx, 0.002) && springSettled(tl.y, tl.t.ry, 0.002)) { tl.x = { v: tl.t.rx, vel: 0 }; tl.y = { v: tl.t.ry, vel: 0 } }
    else busy = true
    tiltRef.current = { rx: tl.x.v, ry: tl.y.v }
    const sw = a.swing, g = swingG.current
    if (sw && g) {
      const pivot = { x: camRef.current.x, y: camRef.current.y }
      if (sw.phase === 'out') {
        const p = Math.min(1, (now - sw.t0) / SWING_OUT_MS)
        g.setAttribute('transform', swingTransform(sw.dir * SWING * p * p, pivot))
        g.style.opacity = String(1 - p)
        if (p >= 1) { sw.phase = 'wait'; setRot(sw.next) } else busy = true
      } else if (sw.phase === 'in') {
        sw.th = springStep(sw.th, 0, dt, 150, 15)
        const op = Math.min(1, (now - sw.t0) / SWING_IN_MS)
        g.setAttribute('transform', swingTransform(sw.th.v, pivot))
        g.style.opacity = String(op)
        if (op >= 1 && springSettled(sw.th, 0, 0.001)) { g.removeAttribute('transform'); g.style.opacity = ''; a.swing = null }
        else busy = true
      }
    }
    apply()
    raf.current = busy ? requestAnimationFrame(loop) : 0
  }, [apply])

  const kick = useCallback(() => {
    if (raf.current) return
    last.current = performance.now()
    raf.current = requestAnimationFrame(loop)
  }, [loop])

  const set = useCallback((c: Camera) => { anim.current.cam = null; camRef.current = c; apply() }, [apply])
  const goTo = useCallback((t: Camera, instant = false, stiff = 120, damp = 21) => {
    if (instant || prefersReducedMotion()) { set(t); return }
    const c = camRef.current
    anim.current.cam = { x: { v: c.x, vel: 0 }, y: { v: c.y, vel: 0 }, k: { v: c.k, vel: 0 }, t, stiff, damp }
    kick()
  }, [set, kick])

  useEffect(() => {
    const el = root.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setView({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => () => { cancelAnimationFrame(raf.current); raf.current = 0 }, [])
  // Labels, camera and tilt after every render (positions come from refs, so they never fight the loop).
  useLayoutEffect(() => { apply() })

  // Follow the target: instant on first layout, springy afterwards; selecting a district eases in with a slight overshoot.
  const targetRef = useRef(target)
  targetRef.current = target
  const tKey = target ? `${target.x.toFixed(1)}|${target.y.toFixed(1)}|${target.k.toFixed(3)}` : ''
  useEffect(() => {
    if (!target) return
    goTo(target, first.current, ...(selected ? [150, 16] as const : [120, 21] as const))
    first.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tKey])

  // Rotation: keep the camera on the same ground point, then play the second half of the swing.
  const shown = useRef(rot)
  useLayoutEffect(() => {
    const delta = quarter(rot - shown.current)
    shown.current = rot
    if (!delta) return
    const c = camRef.current
    const g = unproject(c.x, c.y), q = rotateTile(g.x, g.y, delta), p = project(q.x, q.y)
    camRef.current = { ...c, x: p.x, y: p.y }
    anim.current.cam = null
    // Re-frame the same focus from the new side (the target key can be unchanged when the focus sits on the pivot).
    const t = targetRef.current
    if (t) { if (prefersReducedMotion()) camRef.current = t; else anim.current.cam = { x: { v: camRef.current.x, vel: 0 }, y: { v: camRef.current.y, vel: 0 }, k: { v: c.k, vel: 0 }, t, stiff: 120, damp: 21 } }
    const sw = anim.current.swing
    if (sw && sw.phase === 'wait') {
      sw.phase = 'in'; sw.t0 = performance.now(); sw.th = { v: -sw.dir * SWING, vel: 0 }
      swingG.current?.setAttribute('transform', swingTransform(sw.th.v, camRef.current))
    }
    kick()
    apply()
  }, [rot, apply, kick])

  const rotate = useCallback((dir: 1 | -1) => {
    if (anim.current.swing) return
    const next = quarter(shown.current + dir)
    setCityRotation(next)
    if (prefersReducedMotion() || !swingG.current) { setRot(next); return }
    anim.current.swing = { phase: 'out', t0: performance.now(), dir, next, th: { v: 0, vel: 0 } }
    kick()
  }, [kick])
  // The store can change elsewhere (another tab of the app in this window): follow it without a swing.
  useEffect(() => { if (!anim.current.swing && wanted !== shown.current) setRot(wanted) }, [wanted])

  // Q and E turn the city anywhere on Home, except while typing or in a dialog.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return
      const k = e.key.toLowerCase()
      if (k !== 'q' && k !== 'e') return
      if (isTypingTarget(e.target as HTMLElement | null) || document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      rotate(k === 'e' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rotate])

  // Wheel zoom needs a non-passive listener.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      set(zoomAt(camRef.current, Math.exp(-e.deltaY * 0.0015), { x: e.clientX - r.left, y: e.clientY - r.top }, { w: r.width, h: r.height }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [set])

  const parallax = !phone && typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches
  const tiltTo = (t: Tilt) => { if (prefersReducedMotion()) return; anim.current.tilt.t = t; kick() }

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
    if (!prev) {
      if (parallax && e.pointerType === 'mouse') {
        const r = root.current!.getBoundingClientRect()
        const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5
        tiltTo({ rx: BASE.rx - ny * 3, ry: nx * 4 })
      }
      return
    }
    const cur = { x: e.clientX, y: e.clientY }
    if (pointers.current.size === 2 && pinch.current) {
      pointers.current.set(e.pointerId, cur)
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      const r = root.current!.getBoundingClientRect()
      moved.current = true
      set(zoomAt(camRef.current, d / pinch.current.d, { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }, view))
      pinch.current.d = d
      return
    }
    const dx = cur.x - prev.x, dy = cur.y - prev.y
    if (!moved.current && Math.hypot(dx, dy) < 5) return
    if (!moved.current) { moved.current = true; try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ignore */ } }
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
    <div
      className={`lm${phone ? ' is-phone' : ''}${focus ? ' has-focus' : ''}`} ref={root} data-testid="lifemap" data-rotation={rot} data-phase={light.phase}
      style={{ '--night': light.night } as CSSProperties}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={() => parallax && tiltTo(BASE)} onKeyDown={key}
    >
      <div className="lm-sky" aria-hidden="true" />
      <div className="lm-stage" ref={stage} aria-hidden="true">
        <svg className="lm-svg" width={view.w} height={view.h} focusable="false" data-hover={hover ?? undefined}>
          <g ref={camG}>
            <g ref={swingG}>
              <CityScene map={map} selected={focus} windows={light.windows} rising={rising} />
            </g>
          </g>
        </svg>
      </div>
      <div className="lm-fog" aria-hidden="true" />
      <div className="lm-motes" ref={motes} aria-hidden="true">
        {MOTES.map(([x, y, delay, dur], i) => <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }} />)}
      </div>

      <div className="lm-viewport" tabIndex={0} role="group" aria-label="Life map. Arrow keys pan, plus and minus zoom, zero fits the city, Q and E rotate it, Escape clears the focus.">
        {ready && map.districts.map((d) => {
          const on = focus === d.id || hover === d.id
          return (
            <button
              key={d.id} type="button" className={`lm-hit${focus === d.id ? ' is-selected' : ''}${on ? ' is-on' : ''}${d.beacon ? ' has-beacon' : ''}`} data-district={d.id}
              ref={(el) => { if (el) hits.current.set(d.id, el); else hits.current.delete(d.id) }}
              style={hitBox(d, camRef.current, view, tiltRef.current)}
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

      <div className="lm-zoom" role="group" aria-label="Map view">
        <button type="button" className="lm-zbtn is-rot" onClick={() => rotate(-1)} aria-label="Rotate left" title="Rotate left (Q)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 6.5A4.5 4.5 0 1 1 4 10.5" /><path d="M2.5 3.5v3.2h3.2" /></svg>
        </button>
        <button type="button" className="lm-zbtn is-rot" onClick={() => rotate(1)} aria-label="Rotate right" title="Rotate right (E)">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M11.5 6.5A4.5 4.5 0 1 0 12 10.5" /><path d="M13.5 3.5v3.2h-3.2" /></svg>
        </button>
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
