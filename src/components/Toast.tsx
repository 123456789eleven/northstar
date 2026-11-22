// ToastProvider: up to three toasts stacked from the bottom, newest at the bottom, in one role="status" region. 4s default,
// 8s when it carries Undo or an action; only the newest toast keeps its buttons (a newer message supersedes the older action,
// as before when it replaced it). Liquid v2: the shapes sit on one goo-filtered layer, so a new toast splits off the one
// showing and a dismissed one is absorbed by its neighbour; the text is on its own unfiltered layer and stays crisp.
// Reduced motion: no goo, 160 ms crossfades.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastOpts } from './toastContext'
import { prefersReducedMotion } from './motion'
import { addSystem, crossfade, Spring, SPRING, wake, type SpringSystem } from './liquidSpring'
import { stackOffsets, trimStack } from './toastStack'
import './liquid-chrome.css'

interface Item extends ToastOpts { id: number; dying: boolean }

interface Anim { y: Spring; sx: Spring; sy: Spring; o: Spring; sys: SpringSystem; remove: () => void; born: boolean }

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Item[]>([])
  const timers = useRef(new Map<number, number>())
  const seq = useRef(0)
  const textEls = useRef(new Map<number, HTMLDivElement>())
  const shapeEls = useRef(new Map<number, HTMLElement>())
  const anims = useRef(new Map<number, Anim>())
  const [reduced] = useState(prefersReducedMotion)

  const kill = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setList((l) => l.map((t) => (t.id === id ? { ...t, dying: true } : t)))
  }, [])
  const drop = useCallback((id: number) => {
    anims.current.get(id)?.remove()
    anims.current.delete(id)
    setList((l) => l.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((o: ToastOpts) => {
    const id = ++seq.current
    setList((l) => trimStack([{ ...o, id, dying: false }, ...l]))
    timers.current.set(id, window.setTimeout(() => kill(id), o.ms ?? (o.undo || o.action ? 8000 : 4000)))
  }, [kill])
  useEffect(() => () => { for (const t of timers.current.values()) window.clearTimeout(t) }, [])

  // Lay out after every change: measure each live toast, size its shape, spring it to its slot.
  useLayoutEffect(() => {
    const live = list.filter((t) => !t.dying)
    const heights = live.map((t) => textEls.current.get(t.id)?.offsetHeight ?? 44)
    const ys = stackOffsets(heights)
    const firstAlone = live.length === 1 && list.length === 1
    for (const t of list) {
      const tx = textEls.current.get(t.id), sh = shapeEls.current.get(t.id)
      if (!tx || !sh) continue
      let a = anims.current.get(t.id)
      if (!a) {
        const y = new Spring(0, SPRING.smooth, 0.05), sx = new Spring(0.9, SPRING.snappy, 0.001), sy = new Spring(0.5, SPRING.snappy, 0.001), o = new Spring(0, SPRING.smooth, 0.002)
        const id = t.id
        const fresh: Anim = { y, sx, sy, o, born: false, remove: () => {}, sys: {
          springs: [y, sx, sy, o],
          render() {
            sh.style.transform = `translate3d(0,${-fresh.y.x}px,0) scale(${fresh.sx.x},${fresh.sy.x})`
            tx.style.transform = `translate3d(0,${-fresh.y.x}px,0)`
            tx.style.opacity = String(Math.max(0, Math.min(1, fresh.o.x)))
            if (anims.current.get(id) === fresh && fresh.y.rest && fresh.sy.rest && fresh.o.rest && fresh.o.t <= 0) drop(id)
          },
        } }
        fresh.remove = addSystem(fresh.sys)
        anims.current.set(t.id, fresh)
        a = fresh
      }
      a.sys.dirty = true
      sh.style.width = `${tx.offsetWidth}px`
      sh.style.height = `${tx.offsetHeight}px`
      const i = live.indexOf(t)
      if (!t.dying) {
        if (!a.born) {
          a.born = true
          if (reduced) { a.sx.snap(1); a.sy.snap(1); a.o.snap(1); a.y.snap(ys[i]); crossfade(tx); crossfade(sh) }
          else {
            if (firstAlone) { a.y.snap(-18); a.sx.snap(0.16); a.sy.snap(0.6) } // the first one rises as a small drop
            a.sx.to(1, { k: 240, z: 0.78 }); a.sy.to(1, SPRING.snappy); a.y.to(ys[i], SPRING.smooth)
            window.setTimeout(() => a.o.to(1, SPRING.smooth), 120)
          }
        } else if (reduced) a.y.snap(ys[i])
        else a.y.to(ys[i], SPRING.smooth)
      } else if (a.o.t > 0) {
        // absorbed by the neighbour that takes its place, or falls away when it was alone
        const idx = list.indexOf(t)
        const nb = list.slice(0, idx).reverse().find((x) => !x.dying) ?? list.slice(idx + 1).find((x) => !x.dying)
        if (reduced) {
          a.o.snap(0); a.sy.snap(0.3)
          crossfade(sh, 1, 0)
          window.setTimeout(() => drop(t.id), 160)
          continue
        }
        a.o.to(-0.2, { k: 1400, z: 1 })
        const nbY = nb ? ys[live.indexOf(nb)] : -22
        a.y.to(nbY, SPRING.smooth); a.sx.to(nb ? 0.7 : 0.12, SPRING.smooth); a.sy.to(nb ? 0.25 : 0.3, SPRING.smooth)
      }
    }
    wake()
  }, [list, reduced, drop])

  const newest = list.find((t) => !t.dying)?.id
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={`toast-host is-liquid${reduced ? ' is-plain' : ''}`} role="status" aria-live="polite">
        <svg className="toast-defs" aria-hidden="true" focusable="false">
          <filter id="ns-goo-toast" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4" result="b" />
            <feColorMatrix in="b" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 20 -9" result="m" />
            <feOffset in="m" dy="1" result="m2" />
            <feComposite in="m" in2="m2" operator="out" result="top" />
            <feFlood floodColor="#141924" floodOpacity="0.96" /><feComposite in2="m" operator="in" result="fill" />
            <feFlood floodColor="#ffffff" floodOpacity="0.08" /><feComposite in2="top" operator="in" result="catch" />
            <feGaussianBlur in="m" stdDeviation="10" result="sb" /><feOffset in="sb" dy="10" result="so" />
            <feFlood floodColor="#000000" floodOpacity="0.55" /><feComposite in2="so" operator="in" result="shadow" />
            <feMerge><feMergeNode in="shadow" /><feMergeNode in="fill" /><feMergeNode in="catch" /></feMerge>
          </filter>
        </svg>
        <div className="toast-shapes" aria-hidden="true">
          {list.map((t) => <i key={t.id} ref={(el) => { if (el) shapeEls.current.set(t.id, el); else shapeEls.current.delete(t.id) }} />)}
        </div>
        {list.map((t) => {
          const acts = !t.dying && t.id === newest
          return (
            <div
              key={t.id} ref={(el) => { if (el) textEls.current.set(t.id, el); else textEls.current.delete(t.id) }}
              className={`toast${t.dying ? ' is-dying' : ''}`} aria-hidden={t.dying || undefined} style={{ opacity: 0 }}
            >
              <span className="toast-msg">{t.message}</span>
              {acts && t.action && (
                <button className="btn btn-ghost btn-sm toast-act" onClick={() => { void t.action?.run(); kill(t.id) }}>{t.action.label}</button>
              )}
              {acts && t.undo && (
                <button className="btn btn-ghost btn-sm" onClick={() => { void t.undo?.(); kill(t.id) }}>Undo</button>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
