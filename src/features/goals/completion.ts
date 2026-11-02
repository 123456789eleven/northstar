// What to suggest after a goal or milestone completes. Pure, so the toast copy is tested, not eyeballed.
import type { Goal } from '../../db'
import { CHILD_HORIZON, HORIZON_LABEL } from './progress'

export type NextStep =
  | { kind: 'sibling'; text: string }
  | { kind: 'add-child'; text: string; parent: Goal }
  | { kind: 'none'; text: string }

const byTarget = (a: Goal, b: Goal) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.createdAt.localeCompare(b.createdAt)

/** After `goal` is done: point at the next open goal beside it, or offer to plan the next one under its parent. */
export function nextStepAfterGoal(goal: Goal, all: Goal[]): NextStep {
  const open = all.filter((g) => g.id !== goal.id && g.status === 'active')
  const parent = goal.parentId != null ? all.find((g) => g.id === goal.parentId && g.status === 'active') : undefined
  const siblings = open.filter((g) => (parent ? g.parentId === parent.id : g.parentId == null && g.horizon === goal.horizon)).sort(byTarget)
  if (siblings.length) return { kind: 'sibling', text: `Next: ${siblings[0].title}` }
  if (parent) return { kind: 'add-child', text: `Nothing else open under ${parent.title}.`, parent }
  return { kind: 'none', text: goal.horizon === 'life' ? 'Set the next direction when you are ready.' : 'On your Achievements wall.' }
}

/** After a milestone is checked: progress so far and the next open milestone, or the cue to finish the goal. */
export function nextStepAfterMilestone(goal: Goal, msId: string): { text: string; allDone: boolean } {
  const ms = goal.milestones.map((m) => (m.id === msId ? { ...m, done: true } : m))
  const done = ms.filter((m) => m.done).length
  const next = ms.find((m) => !m.done)
  if (!next) return { text: `All ${ms.length} milestones done for ${goal.title}.`, allDone: true }
  return { text: `${done} of ${ms.length} milestones. Next: ${next.title}`, allDone: false }
}

export const childLabel = (parent: Goal) => {
  const h = CHILD_HORIZON[parent.horizon]
  return h ? `Add ${HORIZON_LABEL[h].toLowerCase()} goal` : 'Add a goal'
}
