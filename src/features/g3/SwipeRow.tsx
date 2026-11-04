// Swipe-left row for touch screens. Dragging left past the threshold commits the action (delete, categorize...).
// The row never hides the only way to do something: callers keep a visible button for mouse and keyboard users.
import { useRef, type CSSProperties, type ReactNode } from 'react'
import './g3.css'

const THRESHOLD = 76
const MAX = 120

export default function SwipeRow({ children, onCommit, label, tone = 'warn', disabled = false }: {
  children: ReactNode
  onCommit: () => void
  /** Word shown behind the row while dragging. */
  label: string
  tone?: 'warn' | 'accent'
  disabled?: boolean
}) {
  const row = useRef<HTMLDivElement>(null)
  const start = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null)

  const setX = (x: number, animate: boolean) => {
    const el = row.current
    if (!el) return
    el.style.transition = animate ? '' : 'none'
    el.style.transform = x ? `translateX(${x}px)` : ''
    el.parentElement?.style.setProperty('--sw', String(Math.min(1, Math.abs(x) / THRESHOLD)))
  }

  return (
    <div className={`swipe swipe-${tone}`} style={{ '--sw': 0 } as CSSProperties}>
      <div className="swipe-back" aria-hidden>{label}</div>
      <div
        ref={row}
        className="swipe-front"
        onPointerDown={(e) => {
          if (disabled || e.pointerType === 'mouse') return
          start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false }
        }}
        onPointerMove={(e) => {
          const s = start.current
          if (!s) return
          const dx = e.clientX - s.x
          const dy = e.clientY - s.y
          if (!s.active) {
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { start.current = null; return }
            if (dx < -10 && Math.abs(dx) > Math.abs(dy)) { s.active = true; row.current?.setPointerCapture(s.id) } else return
          }
          setX(Math.max(-MAX, Math.min(0, dx)), false)
        }}
        onPointerUp={(e) => {
          const s = start.current
          start.current = null
          if (!s?.active) return
          const dx = e.clientX - s.x
          setX(0, true)
          if (dx <= -THRESHOLD) onCommit()
        }}
        onPointerCancel={() => { start.current = null; setX(0, true) }}
      >
        {children}
      </div>
    </div>
  )
}
