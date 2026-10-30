// Pure sorting for the Today page. A task appears in exactly one section.
import type { Task } from '../../db'
import { MAX_FOCUS, byDue, byUrgency } from '../tasks/taskActions'

export interface TodayView {
  /** Pinned for today (open, or done today). */
  focus: Task[]
  /** Shown only when nothing is pinned: top tasks by urgency. */
  suggestions: Task[]
  /** Overdue and due-today open tasks that are not already listed above. */
  due: Task[]
  /** Completed today that were due today or earlier and are not already listed above. */
  done: Task[]
  overdueCount: number
  dueTodayCount: number
  doneTodayCount: number
  openCount: number
}

export function buildTodayView(tasks: Task[], d: string): TodayView {
  const open = tasks.filter((t) => t.status === 'open')
  const doneToday = tasks.filter((t) => t.status === 'done' && t.doneAt?.slice(0, 10) === d)
  const focus = tasks.filter((t) => t.focusDate === d && (t.status === 'open' || doneToday.includes(t))).sort(byUrgency)
  const suggestions = focus.length ? [] : [...open].sort(byUrgency).slice(0, MAX_FOCUS)
  const shown = new Set([...focus, ...suggestions].map((t) => t.id))
  const overdue = open.filter((t) => t.due && t.due < d).sort(byDue)
  const dueToday = open.filter((t) => t.due === d).sort(byDue)
  return {
    focus,
    suggestions,
    due: [...overdue, ...dueToday].filter((t) => !shown.has(t.id)),
    done: doneToday.filter((t) => t.due && t.due <= d && !shown.has(t.id)),
    overdueCount: overdue.length,
    dueTodayCount: dueToday.length,
    doneTodayCount: doneToday.length,
    openCount: open.length,
  }
}
