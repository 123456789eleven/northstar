// Pure grouping and selection for the Tasks queue (no DB). Open tasks only; completed ones are listed separately.
import type { Task } from '../../db'
import { addDays } from '../../lib/dates'
import { byDue } from './taskActions'

export type GroupKey = 'overdue' | 'today' | 'week' | 'later' | 'none'
export interface TaskGroup { key: GroupKey; label: string; tasks: Task[]; tone?: 'warn' }

export function groupOpenTasks(tasks: Task[], d: string): TaskGroup[] {
  const open = tasks.filter((t) => t.status === 'open').sort(byDue)
  const wk = addDays(d, 7)
  const groups: TaskGroup[] = [
    { key: 'overdue', label: 'Overdue', tone: 'warn', tasks: open.filter((t) => t.due && t.due < d) },
    { key: 'today', label: 'Today', tasks: open.filter((t) => t.due === d) },
    { key: 'week', label: 'Next 7 days', tasks: open.filter((t) => t.due && t.due > d && t.due <= wk) },
    { key: 'later', label: 'Later', tasks: open.filter((t) => t.due && t.due > wk) },
    {
      key: 'none',
      label: 'No date',
      tasks: open.filter((t) => !t.due).sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt)),
    },
  ]
  return groups.filter((g) => g.tasks.length > 0)
}

/** Task ids in the order the queue shows them. */
export const queueOrder = (groups: TaskGroup[]): number[] => groups.flatMap((g) => g.tasks.map((t) => t.id!))

/** Move the active id by +1/-1, clamped. Falls back to the first item when nothing (or a vanished id) is active. */
export function stepSelection(order: number[], active: number | null, dir: 1 | -1): number | null {
  if (order.length === 0) return null
  const i = active == null ? -1 : order.indexOf(active)
  if (i < 0) return order[0]
  return order[Math.max(0, Math.min(order.length - 1, i + dir))]
}

/** After a task leaves the queue, which id should be active: the one now in its slot, else the previous. */
export function selectionAfterRemoval(before: number[], removed: number, after: number[]): number | null {
  const i = before.indexOf(removed)
  const rest = before.filter((id) => id !== removed && after.includes(id))
  return rest[Math.min(i, rest.length - 1)] ?? null
}
