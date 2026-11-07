// Season goal coach note: one plain line derived from real progress against the share of the season already used.
// Pure and deterministic; nothing is stored.
import type { Goal, ISODate } from '../../db'
import { daysBetween } from '../../lib/dates'
import { quarterRange } from './boss'

export type CoachTone = 'met' | 'ahead' | 'on' | 'behind' | 'idle'
export interface CoachNote { tone: CoachTone; text: string }

/** Share (0..1) of the goal's window already used. The window runs from the later of the quarter start and creation to the target date (or quarter end). */
export function expectedShare(goal: Pick<Goal, 'createdAt' | 'targetDate'>, today: ISODate): number {
  const q = quarterRange(today)
  const created = goal.createdAt.slice(0, 10)
  const start = created > q.start && created <= today ? created : q.start
  const end = goal.targetDate && goal.targetDate > start ? goal.targetDate : q.end
  const span = daysBetween(start, end)
  if (span <= 0) return 1
  return Math.min(1, Math.max(0, daysBetween(start, today) / span))
}

const BAND = 0.05

/**
 * `progress` is 0..1. `basis` 'none' means nothing is tracked yet. For weight goals pass `weight` and the note speaks in lb.
 */
export function coachNote(args: {
  goal: Pick<Goal, 'status' | 'createdAt' | 'targetDate'>
  progress: number
  basis: 'metric' | 'milestones' | 'tasks' | 'none'
  today: ISODate
  weight?: { start: number; value: number; target: number }
  /** Milestone count when progress is milestone-based; lets the note speak in milestones. */
  milestones?: number
}): CoachNote {
  const { goal, progress, basis, today, weight, milestones } = args
  if (goal.status === 'done' || progress >= 1) return { tone: 'met', text: 'Goal met.' }
  if (basis === 'none') return { tone: 'idle', text: 'Nothing tracked yet. Add a milestone or link a metric.' }
  const exp = expectedShare(goal, today)
  if (weight && Math.abs(weight.target - weight.start) > 0) {
    const line = weight.start + (weight.target - weight.start) * exp
    const dir = Math.sign(weight.target - weight.start)
    const gap = (weight.value - line) * dir // negative means behind
    const lb = Math.round(Math.abs(gap) * 10) / 10
    if (gap < -0.5) return { tone: 'behind', text: `${lb} lb behind the pace line.` }
    if (gap > 0.5) return { tone: 'ahead', text: `${lb} lb ahead of the pace line.` }
    return { tone: 'on', text: 'On the pace line.' }
  }
  const diff = progress - exp
  const n = milestones && basis === 'milestones' ? Math.max(1, Math.round(Math.abs(diff) * milestones)) : 0
  const unit = `${n} milestone${n === 1 ? '' : 's'}`
  if (diff < -BAND) return { tone: 'behind', text: n ? `${unit} behind pace.` : 'Behind pace.' }
  if (diff > BAND) return { tone: 'ahead', text: n ? `${unit} ahead of pace.` : 'Ahead of pace.' }
  return { tone: 'on', text: 'On pace.' }
}
