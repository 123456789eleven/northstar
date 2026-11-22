// Droplet sheet (LIQUID_V2.md motion #4, council motion.html C). FLIP from the control that opened it: the full sheet starts
// clipped to the trigger (clip-path inset with a round) and translated onto it, then the top rises on a quicker spring than
// the sides widen, so it reads as a drop pulling up. A trigger wider than the sheet (the full-width More row) just rises.
// Backdrop blur is off while it morphs and comes back at rest; at rest no transform or clip is held (a held transform would
// trap nested modals). Only one droplet at a time; a second sheet, no trigger or reduced motion keep the CSS entrance.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { addSystem, Spring, wake } from './liquidSpring'
import { prefersReducedMotion } from './motion'

export interface Rect { left: number; top: number; width: number; height: number }
export interface DropStart { tx: number; ty: number; l: number; r: number; b: number; rad: number }

let lastPress: { el: Element; at: number } | null = null
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { if (e.target instanceof Element) lastPress = { el: e.target, at: performance.now() } }, true)
}
let openDrops = 0

/** The control that opened the sheet: the one just pressed, else the focused one (keyboard). */
function pickTrigger(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const pressed = lastPress && performance.now() - lastPress.at < 1500 ? lastPress.el.closest<HTMLElement>('button, a, [role="button"]') : null
  const el = pressed ?? (document.activeElement as HTMLElement | null)
  return el && el !== document.body ? el : null
}

const visible = (r: Rect) => r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.top + r.height > 0 && r.left < window.innerWidth && r.left + r.width > 0

/** Where the clipped sheet starts so its visible part sits exactly on the trigger (pure, tested). */
export function dropStart(s: Rect, t: Rect): DropStart {
  const vw = Math.min(t.width, s.width), vh = Math.min(t.height, s.height)
  const l = (s.width - vw) / 2
  return { tx: t.left + t.width / 2 - vw / 2 - (s.left + l), ty: t.top - s.top, l, r: l, b: s.height - vh, rad: Math.min(vh / 2, 24) }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const cl = (x: number) => Math.max(0, Math.min(1, x))

/** Clip and transform for progress v (vertical, leads) and h (horizontal, follows); pure. */
export function dropFrame(d: DropStart, v: number, h: number, rEnd: number, vel = 0) {
  const vc = cl(v), hc = cl(h)
  const st = Math.max(-0.04, Math.min(0.04, -vel * 0.006)) // tall and thin while rising fast, never more than 4%
  return {
    clip: `inset(0px ${lerp(d.r, 0, hc)}px ${lerp(d.b, 0, vc)}px ${lerp(d.l, 0, hc)}px round ${lerp(d.rad, rEnd, Math.min(vc, hc))}px)`,
    transform: `translate3d(${lerp(d.tx, 0, h)}px,${lerp(d.ty, 0, v)}px,0) scale(${1 - st * 0.5},${1 + st})`,
    content: cl((Math.min(v, h) - 0.55) / 0.35),
    lift: (1 - vc) * 12,
    scrim: vc,
  }
}

export function useDroplet(sheet: RefObject<HTMLElement | null>, backdrop: RefObject<HTMLElement | null>, onClose: () => void) {
  const [trigger] = useState(pickTrigger)
  const done = useRef(onClose)
  useEffect(() => { done.current = onClose })
  const ctl = useRef<{ close: () => void } | null>(null)

  useLayoutEffect(() => {
    const el = sheet.current, back = backdrop.current
    if (!el || !back || !trigger || openDrops > 0 || prefersReducedMotion() || typeof window === 'undefined') return
    el.classList.add('is-drop', 'is-morphing')
    back.classList.add('is-drop')
    let s: Rect = el.getBoundingClientRect()
    const t0 = trigger.getBoundingClientRect()
    if (!visible(t0) || !visible(s)) { el.classList.remove('is-drop', 'is-morphing'); back.classList.remove('is-drop'); return }
    openDrops++
    const rEnd = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20
    const kids = [...el.children] as HTMLElement[]
    el.style.transformOrigin = '50% 100%'
    let d = dropStart(s, t0)
    let open = true, settled = false, finished = false
    const V = new Spring(0, { k: 230, z: 0.72 }, 0.001), H = new Spring(0, { k: 200, z: 0.82 }, 0.001)
    const clear = () => {
      el.style.clipPath = ''; el.style.transform = ''
      for (const k of kids) { k.style.opacity = ''; k.style.transform = '' }
      el.classList.remove('is-morphing')
    }
    const render = () => {
      if (settled) return
      const f = dropFrame(d, V.x, H.x, rEnd, V.v)
      el.style.clipPath = f.clip
      el.style.transform = f.transform
      for (const k of kids) { k.style.opacity = String(f.content); k.style.transform = `translate3d(0,${f.lift}px,0)` }
      back.style.opacity = String(f.scrim)
      trigger.style.opacity = String(open ? (V.x < 0.12 ? 1 - V.x / 0.12 : 0) : cl(1 - V.x / 0.12))
      if (open && V.rest && H.rest) { settled = true; clear(); back.style.opacity = '' }
      if (!open && !finished && V.x < 0.03 && H.x < 0.08) finish()
    }
    const remove = addSystem({ springs: [V, H], render })
    const finish = () => { if (finished) return; finished = true; done.current() }
    V.to(1); H.to(1, { k: 150, z: 0.84 })
    render() // the first frame (still on the trigger) lands before paint
    wake()
    let safety = 0
    ctl.current = {
      close() {
        if (!open) return
        open = false
        back.classList.add('is-leaving')
        if (settled) { s = el.getBoundingClientRect(); settled = false; el.classList.add('is-morphing') }
        const t = trigger.isConnected ? trigger.getBoundingClientRect() : null
        // back into the trigger when it is still on screen, else a small drop falling out of the bottom
        d = dropStart(s, t && visible(t) ? t : { left: s.left + s.width / 2 - 60, top: window.innerHeight + 8, width: 120, height: 44 })
        H.to(0, { k: 380, z: 0.9 }); V.to(0, { k: 300, z: 0.95 })
        wake()
        safety = window.setTimeout(finish, 700)
      },
    }
    return () => {
      remove(); window.clearTimeout(safety); openDrops--
      trigger.style.opacity = ''
      ctl.current = null
    }
  }, [sheet, backdrop, trigger])

  return useCallback((fallback: () => void) => { if (ctl.current) ctl.current.close(); else fallback() }, [])
}
