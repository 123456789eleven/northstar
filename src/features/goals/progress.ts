import type { Goal, Task } from '../../db'

export interface GoalProgress {
  pct: number
  done: number
  total: number
  basis: 'milestones' | 'tasks' | 'none'
}

/** Milestones done/total; falls back to linked tasks done/total. */
export function goalProgress(goal: Goal, tasks: Task[]): GoalProgress {
  if (goal.status === 'done') return { pct: 100, done: 1, total: 1, basis: goal.milestones.length ? 'milestones' : 'none' }
  if (goal.milestones.length) {
    const done = goal.milestones.filter((m) => m.done).length
    return { pct: (done / goal.milestones.length) * 100, done, total: goal.milestones.length, basis: 'milestones' }
  }
  const linked = tasks.filter((t) => t.goalId === goal.id)
  if (linked.length) {
    const done = linked.filter((t) => t.status === 'done').length
    return { pct: (done / linked.length) * 100, done, total: linked.length, basis: 'tasks' }
  }
  return { pct: 0, done: 0, total: 0, basis: 'none' }
}

export function progressLabel(p: GoalProgress): string {
  if (p.basis === 'milestones') return `${p.done}/${p.total} milestones`
  if (p.basis === 'tasks') return `${p.done}/${p.total} tasks`
  return 'No milestones yet'
}

export const HORIZON_LABEL: Record<Goal['horizon'], string> = { life: 'Life', year: 'Year', quarter: 'Quarter' }
export const CHILD_HORIZON: Record<Goal['horizon'], Goal['horizon'] | undefined> = { life: 'year', year: 'quarter', quarter: undefined }

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto && window.isSecureContext
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
