// Global press squash for .btn .chip .tab-item (docs/redesign/LIQUID_V2.md, Motion #2). One delegated pointerdown listener:
// the control squashes to scale(1.03, .94) from the press point (origin = pointer x, bottom edge) on the press spring, a 120px light
// sits at the press point (liquid.css .is-pressed), and release springs back with overshoot. The transform lives only while the
// spring moves (.is-squash), so a resting control never becomes a containing block. Reduced motion: nothing at all.
import { addSystem, prefersReducedMotion, Spring, SPRINGS } from './spring'

export const PRESS_SELECTOR = '.btn, .chip, .tab-item'
const EPS = 0.0005

type Press = { sx: Spring; sy: Spring; remove: () => void }
const live = new WeakMap<HTMLElement, Press>()

function springsFor(el: HTMLElement): Press {
  const had = live.get(el)
  if (had) return had
  const sx = new Spring(1, SPRINGS.press, EPS), sy = new Spring(1, SPRINGS.press, EPS)
  const p: Press = { sx, sy, remove: () => {} }
  p.remove = addSystem({
    springs: [sx, sy],
    render: () => {
      el.style.setProperty('--sx', sx.x.toFixed(4))
      el.style.setProperty('--sy', sy.x.toFixed(4))
      if (sx.t === 1 && sy.t === 1 && sx.rest && sy.rest) {
        el.classList.remove('is-squash')
        el.style.removeProperty('--sx'); el.style.removeProperty('--sy')
        p.remove(); live.delete(el)
      }
    },
  })
  live.set(el, p)
  return p
}

export function installPress(): () => void {
  if (typeof document === 'undefined') return () => {}
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || prefersReducedMotion()) return
    const el = (e.target as Element | null)?.closest?.(PRESS_SELECTOR) as HTMLElement | null
    if (!el || el.matches(':disabled, [aria-disabled="true"]')) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--px', `${Math.round(e.clientX - r.left)}px`)
    el.style.setProperty('--py', `${Math.round(e.clientY - r.top)}px`)
    el.classList.add('is-pressed', 'is-squash')
    const p = springsFor(el)
    p.sx.to(1.03, SPRINGS.press); p.sy.to(0.94, SPRINGS.press)
    const up = () => {
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      el.classList.remove('is-pressed')
      p.sx.to(1, SPRINGS.release); p.sy.to(1, SPRINGS.release)
    }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  document.addEventListener('pointerdown', down, { passive: true })
  return () => document.removeEventListener('pointerdown', down)
}
