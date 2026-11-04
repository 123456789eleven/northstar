// Pure quest-log math: season (quarter) bounds, boss HP, checkpoint flags and the one-line "Next step".
// Everything is derived from the goal, its linked tasks and its auto-metric; nothing is stored.
import type { Goal, ISODate, Task } from '../../db'
import { addDays, daysBetween } from '../../lib/dates'
import type { MetricData, MetricResult } from '../progress/metrics'
import { goalProgress, progressLabel } from './progress'

export const WEIGHT_FLAG_STEP = 5

/** First and last day of the calendar quarter containing `day`. */
export function quarterRange(day: ISODate): { start: ISODate; end: ISODate } {
  const y = Number(day.slice(0, 4))
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3)
  const startMonth = q * 3 + 1
  const nextStart = startMonth + 3 > 12 ? `${y + 1}-01-01` : `${y}-${String(startMonth + 3).padStart(2, '0')}-01`
  return { start: `${y}-${String(startMonth).padStart(2, '0')}-01`, end: addDays(nextStart, -1) }
}

/** Whole days left in the quarter after `day` (0 on its last day). */
export const daysLeftInQuarter = (day: ISODate): number => Math.max(0, daysBetween(day, quarterRange(day).end))

export interface BossHp {
  basis: 'metric' | 'milestones' | 'tasks' | 'none'
  /** 0..1 of the goal done. */
  progress: number
  /** 0..1 remaining (the boss's HP). */
  hp: number
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0)

/** HP = what is left. Uses the linked metric when it has data, else milestone completion, else linked tasks. */
export function bossHp(goal: Goal, tasks: Task[], metric?: MetricResult | null): BossHp {
  if (goal.status === 'done') return { basis: metric?.hasData ? 'metric' : 'milestones', progress: 1, hp: 0 }
  if (metric?.hasData) {
    const progress = clamp01(metric.pct / 100)
    return { basis: 'metric', progress, hp: 1 - progress }
  }
  const p = goalProgress(goal, tasks)
  if (p.basis === 'none') return { basis: 'none', progress: 0, hp: 1 }
  const progress = clamp01(p.pct / 100)
  return { basis: p.basis, progress, hp: 1 - progress }
}

export interface Checkpoint {
  /** 0..100 along the path from start to finish. */
  pos: number
  label: string
  reached: boolean
}

/** Starting weight the same way computeMetric derives it. */
export function weightStart(d: Pick<MetricData, 'weights' | 'startWeight' | 'today'>): number | null {
  if (d.startWeight != null) return d.startWeight
  const rows = d.weights.filter((w) => w.date <= d.today && Number.isFinite(w.weight)).sort((a, b) => a.date.localeCompare(b.date))
  return rows.length ? rows[0].weight : null
}

/** One flag every `step` lb between start and target (the target itself is the last flag). */
export function weightCheckpoints(start: number, target: number, current: number | null, step = WEIGHT_FLAG_STEP): Checkpoint[] {
  const span = Math.abs(target - start)
  if (!(span > 0) || !(step > 0)) return []
  const dir = target >= start ? 1 : -1
  const out: Checkpoint[] = []
  for (let k = 1; k * step < span - 1e-9; k++) {
    const v = start + dir * k * step
    out.push({ pos: ((k * step) / span) * 100, label: String(Math.round(v * 10) / 10), reached: current != null && (dir > 0 ? current >= v : current <= v) })
  }
  out.push({ pos: 100, label: String(Math.round(target * 10) / 10), reached: current != null && (dir > 0 ? current >= target : current <= target) })
  return out
}

/** Milestones as evenly spaced flags; the last one sits at the finish. */
export function milestoneCheckpoints(goal: Goal): Checkpoint[] {
  const n = goal.milestones.length
  return goal.milestones.map((m, i) => ({ pos: ((i + 1) / n) * 100, label: m.title, reached: m.done }))
}

/** Flags for a boss: weight goals use the metric (+5 lb steps), everything else its milestones. */
export function bossCheckpoints(goal: Goal, metric: MetricResult | null | undefined, data?: Pick<MetricData, 'weights' | 'startWeight' | 'today'>): Checkpoint[] {
  if (goal.metric?.source === 'weight' && metric?.hasData && data) {
    const start = weightStart(data)
    if (start != null) return weightCheckpoints(start, goal.metric.target, metric.value)
  }
  return milestoneCheckpoints(goal)
}

export interface NextStep {
  kind: 'milestone' | 'task' | 'link-metric' | 'add-milestone' | 'done'
  text: string
  taskId?: number
}

/** Deterministic: next unchecked milestone, else the oldest open linked task, else a nudge to link a metric. */
export function nextStep(goal: Goal, tasks: Task[]): NextStep {
  if (goal.status === 'done') return { kind: 'done', text: 'Goal complete.' }
  const ms = goal.milestones.find((m) => !m.done)
  if (ms) return { kind: 'milestone', text: ms.title }
  const open = tasks
    .filter((t) => t.goalId === goal.id && t.status === 'open')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.id ?? 0) - (b.id ?? 0))
  if (open.length) return { kind: 'task', text: open[0].title, taskId: open[0].id }
  if (!goal.metric || goal.metric.source === 'manual') return { kind: 'link-metric', text: 'Link a metric so this tracks itself, or add a milestone.' }
  return { kind: 'add-milestone', text: 'Keep logging; the metric updates itself.' }
}

/** Active quarter goals, soonest target date first, at most `max`. */
export function pickBosses(goals: Goal[], max = 3): Goal[] {
  return goals
    .filter((g) => g.status === 'active' && g.horizon === 'quarter')
    .sort((a, b) => (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.createdAt.localeCompare(b.createdAt))
    .slice(0, max)
}

export interface ExampleBoss {
  title: string
  area: Goal['area']
  why: string
  milestones: string[]
  targetDate: ISODate
}

/** Fictional starter bosses for the empty state; adopting one creates a real quarter goal. */
export function exampleBosses(day: ISODate): ExampleBoss[] {
  const end = quarterRange(day).end
  return [
    { title: 'Run a 5K without stopping', area: 'health', why: 'Build a steady cardio base.', milestones: ['Run 1 mile', 'Run 2 miles', 'Run 3 miles', 'Run the 5K'], targetDate: end },
    { title: 'Build a $1,000 buffer', area: 'finance', why: 'A cushion that makes the month calmer.', milestones: ['Save $250', 'Save $500', 'Save $750', 'Save $1,000'], targetDate: end },
  ]
}

/** The live number on a boss: the metric reading, "No data yet" for a linked metric without data, else milestone/task progress. */
export function bossNumber(goal: Goal, tasks: Task[], metric: MetricResult | null | undefined): string {
  if (metric?.hasData) return metric.label
  if (goal.metric && goal.metric.source !== 'manual' && metric && !metric.hasData) return 'No data yet'
  return progressLabel(goalProgress(goal, tasks))
}
