// Three focus slots shared by Today and Tasks. Same data as the pin button on every task row (task.focusDate === today).
import './aura.css'
import { useState } from 'react'
import type { Task } from '../../db'
import { MAX_FOCUS, byUrgency, togglePin } from './taskActions'
import { useTaskToggle } from './useTaskToggle'
import { PinIcon } from './TaskRow'

function Slot({ task, onEdit }: { task: Task; onEdit?: (t: Task) => void }) {
  const { done, completing, leaving, toggle } = useTaskToggle(task)
  return (
    <li className={`focus-slot is-filled ${done ? 'done' : ''} ${completing ? 'completing' : ''} ${leaving ? 'leaving' : ''}`}>
      <label className="check-hit">
        <input type="checkbox" className="check" checked={done} onChange={() => void toggle()} aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`} />
      </label>
      <button type="button" className="focus-slot-title" onClick={() => onEdit?.(task)} disabled={!onEdit}>{task.title}</button>
      {!done && (
        <button type="button" className="icon-btn on" aria-label={`Unpin ${task.title} from focus`} title="Unpin from focus" aria-pressed="true" onClick={() => void togglePin(task)}>
          <PinIcon />
        </button>
      )}
    </li>
  )
}

export function FocusBar({ tasks, d, onEdit, bare = false }: { tasks: Task[]; d: string; onEdit?: (t: Task) => void; bare?: boolean }) {
  const [picking, setPicking] = useState(false)
  const doneToday = (t: Task) => t.status === 'done' && t.doneAt?.slice(0, 10) === d
  const pinned = tasks.filter((t) => t.focusDate === d && (t.status === 'open' || doneToday(t))).sort(byUrgency)
  const openPinned = pinned.filter((t) => t.status === 'open').length
  const candidates = tasks.filter((t) => t.status === 'open' && t.focusDate !== d).sort(byUrgency).slice(0, 6)
  const free = Math.max(0, MAX_FOCUS - openPinned)
  const empties = Math.max(0, MAX_FOCUS - pinned.length)
  const pin = async (t: Task) => {
    await togglePin(t)
    if (free <= 1) setPicking(false)
  }
  return (
    <section className={bare ? 'focus-bar' : 'card focus-bar'} aria-label="Focus">
      <header className="focus-head">
        <h2 className="focus-title">Focus</h2>
        <span className="faint mono">{openPinned} of {MAX_FOCUS} open</span>
      </header>
      <ul className="focus-slots">
        {pinned.map((t) => <Slot key={t.id} task={t} onEdit={onEdit} />)}
        {Array.from({ length: empties }, (_, i) => (
          <li key={`e${i}`} className="focus-slot is-empty">
            {i === 0 ? (
              <button type="button" className="focus-add" aria-expanded={picking} onClick={() => setPicking((v) => !v)} disabled={candidates.length === 0}>
                {candidates.length === 0 ? 'Add a task to pin it here' : 'Pin a task'}
              </button>
            ) : (
              <span className="focus-open">Open slot</span>
            )}
          </li>
        ))}
      </ul>
      {picking && candidates.length > 0 && free > 0 && (
        <div className="focus-pick" role="group" aria-label="Pick a task to pin">
          {candidates.map((t) => (
            <button key={t.id} type="button" className="focus-pick-item" onClick={() => void pin(t)}>
              <PinIcon /><span>{t.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
