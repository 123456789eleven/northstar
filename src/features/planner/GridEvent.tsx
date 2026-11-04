// One event on the hour grid. Local time blocks can be dragged to move (also across days in the week grid) and resized from
// the bottom handle; everything else (including Google events) is a plain button that opens its editor.
import { useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import type { CalendarEvent, ISODate } from '../../db'
import { isGoogleEvent } from '../gcal/help'
import { fmtTime, timeLabel, type Placed } from './layout'
import { blockMeta, snap } from './timeBlock'

export interface BlockOps {
  conflicts: Set<number>
  onMove: (e: CalendarEvent, date: ISODate, startMin: number) => void
  onResize: (e: CalendarEvent, endMin: number) => void
  onDropTask: (date: ISODate, startMin: number, taskId: number) => void
}

type Drag = { mode: 'move' | 'resize'; dy: number; active: boolean }

export function GridEvent({ p, top, height, pxPerHour, ops, onOpen }: {
  p: Placed; top: number; height: number; pxPerHour: number; ops: BlockOps; onOpen: (e: CalendarEvent) => void
}) {
  const meta = blockMeta(p.event)
  const movable = !!meta && !p.continued
  const origin = useRef<{ x: number; y: number; mode: 'move' | 'resize' } | null>(null)
  const justDragged = useRef(false)
  const [drag, setDrag] = useState<Drag | null>(null)
  const conflict = p.event.id != null && ops.conflicts.has(p.event.id)

  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    if (!movable || e.button !== 0) return
    const onHandle = (e.target as HTMLElement).classList.contains('pl-resize')
    origin.current = { x: e.clientX, y: e.clientY, mode: onHandle ? 'resize' : 'move' }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
  }
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const o = origin.current
    if (!o) return
    const dy = e.clientY - o.y
    const active = Math.abs(dy) > 4 || Math.abs(e.clientX - o.x) > 4 || (drag?.active ?? false)
    setDrag({ mode: o.mode, dy, active })
  }
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    const o = origin.current
    origin.current = null
    if (!o || !drag?.active) { setDrag(null); return }
    justDragged.current = true
    const dMin = (drag.dy / pxPerHour) * 60
    if (o.mode === 'resize') ops.onResize(p.event, snap(p.end + dMin))
    else {
      const col = document.elementsFromPoint(e.clientX, e.clientY).find((el) => (el as HTMLElement).dataset.colDate) as HTMLElement | undefined
      ops.onMove(p.event, (col?.dataset.colDate as ISODate | undefined) ?? p.event.date, snap(p.start + dMin))
    }
    setDrag(null)
  }
  const style: CSSProperties = {
    top, height, left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 3px)`,
    ...(drag?.active && drag.mode === 'move' ? { transform: `translateY(${drag.dy}px)`, zIndex: 3 } : {}),
    ...(drag?.active && drag.mode === 'resize' ? { height: Math.max(22, height + drag.dy) } : {}),
  }
  const kind = meta?.kind === 'training' ? 'training' : meta ? 'task-block' : ''
  return (
    <button
      type="button"
      className={`pl-ev ${meta ? 'block' : ''} ${kind} ${conflict ? 'conflict' : ''} ${drag?.active ? 'dragging' : ''}`}
      style={style}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => { origin.current = null; setDrag(null) }}
      onClick={() => { if (justDragged.current) { justDragged.current = false; return } onOpen(p.event) }}
    >
      <span className="pl-ev-title">{p.event.title}{isGoogleEvent(p.event) && <span className="gcal-src" title="Imported from Google Calendar">Google</span>}</span>
      <small>{p.continued ? `Until ${fmtTime(p.end)}` : timeLabel(p.event)}{meta?.kind === 'training' ? ' · Training' : ''}{conflict ? ' · Overlaps' : ''}</small>
      {movable && <span className="pl-resize" aria-hidden />}
    </button>
  )
}
