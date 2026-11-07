import type { Goal, Task } from '../../db'
import { bossHp, weightStart } from './boss'
import { coachNote } from './coach'
import type { MetricData, MetricResult } from '../progress/metrics'

/** Coach note for a goal, using pounds for weight goals. Shared by the Goals page and the Plan hub. */
export function goalCoach(goal: Goal, tasks: Task[], metric: MetricResult | null, data: MetricData | undefined, today: string) {
  const hp = bossHp(goal, tasks, metric)
  const start = goal.metric?.source === 'weight' && metric?.hasData && data ? weightStart(data) : null
  const weight = start != null && metric?.value != null ? { start, value: metric.value, target: goal.metric!.target } : undefined
  return { hp, note: coachNote({ goal, progress: hp.progress, basis: hp.basis, today, weight, milestones: goal.milestones.length }) }
}
