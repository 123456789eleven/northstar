// Liquid segmented thumb (LIQUID_V2.md motion #3) for a row of tabs: the thumb springs (snappy) to the selected tab and
// squashes with the distance it travels, scale(1 + s, 1 - 0.45 s) with s <= 0.18, settling in one damped overshoot.
// Reduced motion: it snaps and crossfades. Transform only.
import { useLayoutEffect, useRef, type RefObject } from 'react'
import { addSystem, crossfade, Spring, SPRINGS, wake } from '../lib/spring'
import { prefersReducedMotion } from './motion'

/** Squash for a thumb stretch value (pure, tested). */
export function squash(s: number) {
  const c = Math.max(-0.06, Math.min(0.18, s))
  return { sx: 1 + c, sy: 1 - c * 0.45 }
}

export function useThumb(row: RefObject<HTMLElement | null>, thumb: RefObject<HTMLElement | null>, selector: string, index: number) {
  const st = useRef<{ X: Spring; S: Spring; w: number; shown: boolean } | null>(null)
  useLayoutEffect(() => {
    const el = thumb.current
    if (!el) return
    const s = { X: new Spring(0, SPRINGS.snappy, 0.05), S: new Spring(0, { k: 500, z: 0.55 }, 0.0005), w: 0, shown: false }
    st.current = s
    const remove = addSystem({
      springs: [s.X, s.S],
      render() { const q = squash(s.S.x); el.style.transform = `translate3d(${s.X.x}px,0,0) scale(${q.sx},${q.sy})` },
    })
    return () => { remove(); st.current = null }
  }, [thumb])
  useLayoutEffect(() => {
    const s = st.current, el = thumb.current, host = row.current
    const tab = host?.querySelectorAll<HTMLElement>(selector)[index]
    if (!s || !el || !host || !tab) return
    const place = (animate: boolean) => {
      const x = tab.offsetLeft
      el.style.width = `${tab.offsetWidth}px`; el.style.height = `${tab.offsetHeight}px`; el.style.top = `${tab.offsetTop}px`
      const reduced = prefersReducedMotion()
      if (!animate || !s.shown || reduced) {
        s.X.snap(x); s.S.snap(0)
        if (reduced && animate && s.shown) crossfade(el, 0.3, 1)
      } else {
        const dist = Math.abs(x - s.X.x) / Math.max(1, tab.offsetWidth)
        s.S.v += Math.min(1.6, dist * 0.9)
        s.S.to(0); s.X.to(x, SPRINGS.snappy)
      }
      s.shown = true
      const q = squash(s.S.x)
      el.style.transform = `translate3d(${s.X.x}px,0,0) scale(${q.sx},${q.sy})`
      wake()
    }
    place(true)
    if (typeof ResizeObserver === 'undefined') return
    let first = true // the observer reports once on observe; that is not a resize
    const ro = new ResizeObserver(() => { if (first) { first = false; return } place(false) })
    ro.observe(host)
    return () => ro.disconnect()
  }, [row, thumb, selector, index])
}
