// Stretch indicator (LIQUID_V2.md motion #1): the lit pill or elevator car is two caps plus a 100px middle. The edge in the
// direction of travel runs on the snappy spring and the trailing edge on the gentle one, so the shape stretches toward the new
// item and then settles; only translate3d and scale move, so the corner radius never distorts. Reduced motion: snap + fade.
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { addSystem, crossfade, Spring, SPRINGS, wake } from '../lib/spring'
import { prefersReducedMotion } from './motion'

export type Axis = 'x' | 'y'
export interface Box { a: number; b: number; c: number; size: number }
export const MID = 100
interface State { A: Spring; B: Spring; C: Spring; size: number; r: number; shown: boolean; reset: unknown; render: () => void }

/** Piece transforms for one frame: caps at each end, the middle scaled between them (pure, tested). */
export function stretchFrame(axis: Axis, a: number, b: number, c: number, r: number) {
  const end = Math.max(b, a + 2 * r)
  const mid = Math.max(0, end - a - 2 * r) / MID
  const at = (p: number) => (axis === 'x' ? `translate3d(${p}px,${c}px,0)` : `translate3d(${c}px,${p}px,0)`)
  return { capA: at(a), capB: at(end - 2 * r), mid: `${at(a + r)} ${axis === 'x' ? 'scaleX' : 'scaleY'}(${mid})` }
}

/** Which edge leads: travelling toward larger coordinates the far edge (b) is snappy and the near edge (a) gentle. */
export function edgePresets(from: number, to: number) {
  return to >= from ? { a: SPRINGS.gentle, b: SPRINGS.snappy } : { a: SPRINGS.snappy, b: SPRINGS.gentle }
}

/**
 * Drives an indicator inside `host` toward `target()` whenever `key` changes; `reset` (e.g. the building) snaps instead.
 * The indicator holds `.lq-cap.a`, `.lq-mid`, `.lq-cap.b`; the radius `r` is half the cross size for a pill.
 */
export function useStretch(host: RefObject<HTMLElement | null>, ind: RefObject<HTMLElement | null>, target: () => HTMLElement | null, axis: Axis, key: unknown, reset: unknown, radius?: number) {
  const st = useRef<State | null>(null)
  const targetRef = useRef(target)
  useLayoutEffect(() => { targetRef.current = target }) // before the placing effect below, so it measures the new target

  const measure = (): Box | null => {
    const h = host.current, el = targetRef.current()
    if (!h || !el) return null
    const hr = h.getBoundingClientRect(), r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) return null
    const sl = h.scrollLeft, stp = h.scrollTop
    return axis === 'x'
      ? { a: r.left - hr.left + sl, b: r.right - hr.left + sl, c: r.top - hr.top + stp, size: r.height }
      : { a: r.top - hr.top + stp, b: r.bottom - hr.top + stp, c: r.left - hr.left + sl, size: r.width }
  }

  useLayoutEffect(() => {
    const node = ind.current
    if (!node) return
    const [capA, mid, capB] = [node.querySelector<HTMLElement>('.lq-cap.a'), node.querySelector<HTMLElement>('.lq-mid'), node.querySelector<HTMLElement>('.lq-cap.b')]
    const s: State = {
      A: new Spring(0, SPRINGS.smooth, 0.05), B: new Spring(0, SPRINGS.smooth, 0.05), C: new Spring(0, SPRINGS.smooth, 0.05), size: 0, r: 0, shown: false, reset: undefined,
      render() {
        const f = stretchFrame(axis, s.A.x, s.B.x, s.C.x, s.r)
        if (capA) capA.style.transform = f.capA
        if (capB) capB.style.transform = f.capB
        if (mid) mid.style.transform = f.mid
      },
    }
    st.current = s
    const remove = addSystem({ springs: [s.A, s.B, s.C], render: s.render })
    return () => { remove(); st.current = null }
  }, [ind, axis])

  const place = (animate: boolean) => {
    const s = st.current, node = ind.current
    if (!s || !node) return
    const box = measure()
    if (!box) { node.style.opacity = '0'; s.shown = false; return }
    const r = radius ?? box.size / 2
    if (r !== s.r || box.size !== s.size) {
      s.r = r; s.size = box.size
      node.style.setProperty('--lq-size', `${box.size}px`)
      node.style.setProperty('--lq-r', `${r}px`)
    }
    const reduced = prefersReducedMotion()
    if (!animate || !s.shown || reduced) {
      s.A.snap(box.a); s.B.snap(box.b); s.C.snap(box.c)
      if (reduced && animate && s.shown) crossfade(node.firstElementChild, 0.2, 1)
    } else {
      const p = edgePresets(s.A.t, box.a)
      s.A.to(box.a, p.a); s.B.to(box.b, p.b); s.C.to(box.c, SPRINGS.smooth)
    }
    node.style.opacity = ''
    s.shown = true
    s.render() // the current frame lands before paint; the loop takes over for motion
    wake()
  }

  useLayoutEffect(() => {
    const s = st.current
    const fresh = !!s && s.reset !== reset
    if (s) s.reset = reset
    place(!fresh)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, reset])

  useEffect(() => {
    const h = host.current
    if (!h || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => place(false))
    ro.observe(h)
    const onFonts = () => place(false)
    document.fonts?.addEventListener?.('loadingdone', onFonts)
    return () => { ro.disconnect(); document.fonts?.removeEventListener?.('loadingdone', onFonts) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])
}
