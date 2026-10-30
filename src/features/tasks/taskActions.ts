// Task mutations shared by Tasks, Today and QuickCapture.
import { db, logEvent, type Task } from '../../db'
import { nextRecurrence } from '../../lib/capture'
import { addDays, today } from '../../lib/dates'

export const MAX_FOCUS = 3

export async function completeTask(t: Task) {
  if (t.id == null) return
  const now = new Date().toISOString()
  await db.transaction('rw', db.tasks, db.events, async () => {
    await db.tasks.update(t.id!, { status: 'done', doneAt: now })
    await logEvent({ area: 'tasks', kind: 'task.done', title: t.title, refTable: 'tasks', refId: t.id })
    const anchor = t.recurrence === 'monthly' ? (t.recurDay ?? (t.due ? Number(t.due.slice(8, 10)) : undefined)) : undefined
    const next = nextRecurrence(t.due, t.recurrence, today(), anchor)
    if (next) {
      await db.tasks.add({
        title: t.title,
        notes: t.notes,
        due: next,
        priority: t.priority,
        status: 'open',
        recurrence: t.recurrence,
        recurDay: anchor,
        goalId: t.goalId,
        createdAt: now,
      })
    }
  })
}

/** Undo a completion: reopen, drop its timeline event, and remove the recurrence it spawned. */
export async function reopenTask(t: Task) {
  if (t.id == null) return
  await db.transaction('rw', db.tasks, db.events, async () => {
    await db.tasks.update(t.id!, { status: 'open', doneAt: undefined })
    const evs = await db.events.where('area').equals('tasks').filter((e) => e.refTable === 'tasks' && e.refId === t.id && e.kind === 'task.done').toArray()
    const last = evs.sort((a, b) => b.at.localeCompare(a.at))[0]
    if (last?.id != null) await db.events.delete(last.id)
    if (t.recurrence !== 'none' && t.doneAt) {
      const spawned = await db.tasks
        .where('status')
        .equals('open')
        .filter((x) => x.id !== t.id && x.title === t.title && x.recurrence === t.recurrence && x.createdAt >= t.doneAt!)
        .first()
      if (spawned?.id != null) await db.tasks.delete(spawned.id)
    }
  })
}

export function toggleDone(t: Task) {
  return t.status === 'done' ? reopenTask(t) : completeTask(t)
}

/** Returns false if today's focus is already full. */
export async function togglePin(t: Task): Promise<boolean> {
  if (t.id == null) return false
  const d = today()
  if (t.focusDate === d) {
    await db.tasks.update(t.id, { focusDate: undefined })
    return true
  }
  const pinned = await db.tasks.where('focusDate').equals(d).filter((x) => x.status === 'open').count()
  if (pinned >= MAX_FOCUS) return false
  await db.tasks.update(t.id, { focusDate: d })
  return true
}

export const isPinned = (t: Task) => t.focusDate === today()

/** Ordering for "what should I do next": overdue/today first, then priority, then due date. */
export function byUrgency(a: Task, b: Task) {
  const d = today()
  const soon = (t: Task) => (t.due && t.due <= d ? 0 : t.due && t.due <= addDays(d, 2) ? 1 : 2)
  return soon(a) - soon(b) || a.priority - b.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.createdAt.localeCompare(b.createdAt)
}

export function byDue(a: Task, b: Task) {
  return (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.priority - b.priority || a.createdAt.localeCompare(b.createdAt)
}

export function addTask(c: Pick<Task, 'title' | 'due' | 'priority' | 'recurrence' | 'goalId'>) {
  return db.tasks.add({ ...c, status: 'open', createdAt: new Date().toISOString() })
}
