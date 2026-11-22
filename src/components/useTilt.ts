// Hero panel light (LIQUID_V2.md motion #6): with a fine pointer the panel tilts up to 3 degrees toward the cursor on a gentle
// spring and its specular highlight (a `.lq-spec` child) slides under the pointer. Touch gets a slow CSS drift instead (no JS);
// reduced motion gets neither. Transform only; the panel returns flat when the pointer leaves.
import { useEffect, type RefObject } from 'react'
import { addSystem, Spring, SPRING, wake } from './liquidSpring'
import { prefersReducedMotion } from './motion'

export const MAX_TILT = 3

/** Tilt in degrees for a pointer at (u, v) in -0.5..0.5 of the panel (pure, tested). */
export function tiltFor(u: number, v: number, max = MAX_TILT) {
  const c = (x: number) => Math.max(-0.5, Math.min(0.5, x))
  return { ry: c(u) * 2 * max, rx: -c(v) * 2 * max }
}

export function useTilt(ref: RefObject<HTMLElement | null>, on = true) {
  useEffect(() => {
    const el = ref.current
    if (!el || !on || typeof window === 'undefined' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return
    const spec = el.querySelector<HTMLElement>('.lq-spec')
    const rx = new Spring(0, SPRING.gentle, 0.01), ry = new Spring(0, SPRING.gentle, 0.01)
    const mx = new Spring(-40, SPRING.gentle, 0.2), my = new Spring(-50, SPRING.gentle, 0.2)
    const remove = addSystem({
      springs: [rx, ry, mx, my],
      render() {
        const flat = Math.abs(rx.x) < 0.02 && Math.abs(ry.x) < 0.02 && rx.t === 0 && ry.t === 0
        el.style.transform = flat ? '' : `perspective(900px) rotateX(${rx.x}deg) rotateY(${ry.x}deg)`
        if (spec) spec.style.transform = `translate3d(${mx.x}px,${my.x}px,0)`
      },
    })
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || prefersReducedMotion()) return
      const r = el.getBoundingClientRect()
      const u = (e.clientX - r.left) / r.width - 0.5, v = (e.clientY - r.top) / r.height - 0.5
      const t = tiltFor(u, v)
      rx.to(t.rx); ry.to(t.ry)
      // the 300px light disc is centred on the pointer
      mx.to(e.clientX - r.left - 150 + 90); my.to(e.clientY - r.top - 150 + 90)
      wake()
    }
    const leave = () => { rx.to(0); ry.to(0); mx.to(-40); my.to(-50); wake() }
    el.addEventListener('pointermove', move, { passive: true })
    el.addEventListener('pointerleave', leave)
    return () => { remove(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); el.style.transform = '' }
  }, [ref, on])
}
