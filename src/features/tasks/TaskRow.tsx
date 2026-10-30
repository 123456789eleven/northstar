import { db, type Task } from '../../db'
import { relativeDay, today } from '../../lib/dates'
import { useToast } from '../../components/toastContext'
import { isPinned, reopenTask, completeTask, togglePin } from './taskActions'

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
  const toast = useToast()
  const done = task.status === 'done'
  const overdue = !done && !!task.due && task.due < today()
  const pinned = isPinned(task)
  async function toggle() {
    if (done) {
      await reopenTask(task)
      return
    }
    await completeTask(task)
    toast({ message: `Completed "${task.title}"`, undo: async () => { const fresh = await db.tasks.get(task.id!); if (fresh) await reopenTask(fresh) } })
  }
  return (
    <div className={`task-row ${done ? 'done' : ''} ${selected ? 'selected' : ''}`} data-task-id={task.id}>
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
            {task.priority === 1 && <span className="prio-high">High</span>}
            {task.priority === 3 && <span>Low</span>}
            {task.recurrence !== 'none' && <span>{REC[task.recurrence]}</span>}
            {goalTitle && <span>{goalTitle}</span>}
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
}
