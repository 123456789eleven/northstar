import { useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { Task } from '../../db'
import { relativeDay, today } from '../../lib/dates'
import { isPinned, togglePin } from './taskActions'
import { useTaskToggle } from './useTaskToggle'
import { useMedia, PHONE_QUERY } from '../../components/useMedia'
import { haptic } from '../../lib/haptics'
import './aura.css'
import { idle, isSwiping, pull, swipeReduce, THRESHOLD, type SwipeEvent, type SwipeState } from './swipe'

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 4h6l-1 6 3 3H7l3-3z" />
      <path d="M12 16v5" />
    </svg>
  )
}

const REC: Record<Task['recurrence'], string> = { none: '', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

export function TaskRow({
  task,
  goalTitle,
  onEdit,
  showPin = true,
  onPinFull,
  selected = false,
}: {
  task: Task
  goalTitle?: string
  onEdit?: (t: Task) => void
  showPin?: boolean
  onPinFull?: () => void
  selected?: boolean
}) {
  const { done, completing, leaving, toggle } = useTaskToggle(task)
  const phone = useMedia(PHONE_QUERY)
  const wrap = phone && task.status === 'open'
  const canSwipe = wrap && !completing
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const st = useRef<SwipeState>(idle)
  const swallow = useRef(false)
  const overdue = !done && !!task.due && task.due < today()
  const pinned = isPinned(task)

  const feed = (e: SwipeEvent, el?: HTMLElement, id?: number) => {
    const was = st.current
    const next = swipeReduce(was, e)
    st.current = next
    if (isSwiping(next)) {
      if (!isSwiping(was)) {
        setDragging(true)
        try { if (el && id != null) el.setPointerCapture(id) } catch { /* synthetic pointers have no capture */ }
      }
      if (next.armed !== (isSwiping(was) && was.armed)) haptic('tick')
      setDx(next.dx)
    }
    if (next.phase === 'done') { swallow.current = true; setDragging(false); setDx(0); void toggle() }
    else if (next.phase === 'cancelled' || next.phase === 'scroll') {
      if (isSwiping(was)) swallow.current = true
      setDragging(false)
      setDx(0)
    }
  }
  const handlers = canSwipe
    ? {
        onPointerDown: (e: RPointerEvent<HTMLDivElement>) => { swallow.current = false; feed({ type: 'down', x: e.clientX, y: e.clientY }) },
        onPointerMove: (e: RPointerEvent<HTMLDivElement>) => feed({ type: 'move', x: e.clientX, y: e.clientY }, e.currentTarget, e.pointerId),
        onPointerUp: () => feed({ type: 'up' }),
        onPointerCancel: () => feed({ type: 'cancel' }),
        onClickCapture: (e: React.MouseEvent) => { if (swallow.current) { e.stopPropagation(); e.preventDefault(); swallow.current = false } },
      }
    : {}

  const shift = pull(dx)
  const armed = dx >= THRESHOLD
  const row = (
    <div
      className={`task-row ${done ? 'done' : ''} ${completing ? 'completing' : ''} ${leaving ? 'leaving' : ''} ${selected ? 'selected' : ''} ${canSwipe ? 'swipeable' : ''} ${dragging ? 'dragging' : ''}`}
      data-task-id={task.id}
      data-focus-id={task.id}
      style={dx > 0 ? { transform: `translateX(${shift}px)` } : undefined}
      {...handlers}
    >
      <span className={`task-flag ${task.priority === 1 && !done ? 'p1' : ''}`} aria-hidden />
      <label className="check-hit">
        <input
          type="checkbox"
          className="check"
          checked={done}
          onChange={() => void toggle()}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        />
      </label>
      <button className="task-main" onClick={() => onEdit?.(task)} disabled={!onEdit} style={{ cursor: onEdit ? 'pointer' : 'default' }}>
        <span className="task-title">{task.title}</span>
        {(task.due || task.priority !== 2 || task.recurrence !== 'none' || goalTitle) && (
          <span className="task-meta">
            {task.due && <span className={overdue ? 'overdue' : ''}>{relativeDay(task.due)}</span>}
            {task.priority === 1 && <span className="prio-high chip-prio">High</span>}
            {task.priority === 3 && <span>Low</span>}
            {task.recurrence !== 'none' && <span>{REC[task.recurrence]}</span>}
            {goalTitle && <span className="chip-goal">{goalTitle}</span>}
          </span>
        )}
      </button>
      {showPin && !done && (
        <button
          className={`icon-btn ${pinned ? 'on' : ''}`}
          title={pinned ? "Unpin from today's focus" : "Pin to today's focus"}
          aria-label={pinned ? "Unpin from today's focus" : "Pin to today's focus"}
          aria-pressed={pinned}
          onClick={async () => {
            const ok = await togglePin(task)
            if (!ok) onPinFull?.()
          }}
        >
          <PinIcon />
        </button>
      )}
    </div>
  )
  if (!wrap) return row
  return (
    <div className={`task-swipe ${armed ? 'armed' : ''}`}>
      <div className="swipe-under" aria-hidden style={{ opacity: Math.min(1, dx / THRESHOLD) }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        <span>Done</span>
      </div>
      {row}
    </div>
  )
}
