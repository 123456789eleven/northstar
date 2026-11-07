// Pure: what fed each area's ring this week. Counts come from the same dated actions the engine already derives.
import type { ISODate } from '../../db'
import { addDays } from '../../lib/dates'
import { SKILLS, type SkillId } from './types'

export interface WeekAction { kind: string; skill: SkillId; date: ISODate }
export interface AreaInput { kind: string; label: string; count: number }
export interface AreaWeek {
  id: SkillId
  label: string
  /** Days this week with at least one counted action. */
  days: number
  /** 0..1 of the weekly day target. */
  value: number
  inputs: AreaInput[]
  /** Total counted actions this week. */
  total: number
}

const NOUN: Record<string, [string, string]> = {
  'weigh-in': ['weigh-in', 'weigh-ins'], 'calories-met': ['calorie target met', 'calorie targets met'], 'protein-met': ['protein target met', 'protein targets met'],
  workout: ['workout', 'workouts'], meal: ['meal logged', 'meals logged'], 'budget-day': ['day on budget', 'days on budget'],
  categorize: ['transaction sorted', 'transactions sorted'], import: ['import', 'imports'], 'net-worth': ['balance update', 'balance updates'],
  journal: ['journal entry', 'journal entries'], learning: ['study session', 'study sessions'], focus: ['focus session', 'focus sessions'],
  win: ['win', 'wins'], review: ['weekly recap', 'weekly recaps'], milestone: ['goal milestone', 'goal milestones'], 'goal-done': ['goal finished', 'goals finished'],
  contact: ['person contacted', 'people contacted'], task: ['task done', 'tasks done'], habit: ['routine check-in', 'routine check-ins'],
}
/** Day and week clear bonuses are not inputs: they restate other actions. */
const SKIP = new Set(['day-clear', 'week-clear'])

export const noun = (kind: string, n: number) => (NOUN[kind] ?? [kind, kind])[n === 1 ? 0 : 1]

export function areaWeek(actions: WeekAction[], weekStart: ISODate, target: number): AreaWeek[] {
  const end = addDays(weekStart, 6)
  const t = Math.max(1, target)
  return SKILLS.map((a) => {
    const mine = actions.filter((x) => x.skill === a.id && !SKIP.has(x.kind) && x.date >= weekStart && x.date <= end)
    const kinds = new Map<string, number>()
    for (const x of mine) kinds.set(x.kind, (kinds.get(x.kind) ?? 0) + 1)
    const inputs = [...kinds].map(([kind, count]) => ({ kind, count, label: noun(kind, count) })).sort((p, q) => q.count - p.count)
    const days = new Set(mine.map((x) => x.date)).size
    return { id: a.id, label: a.label, days, value: Math.min(1, days / t), inputs, total: mine.length }
  })
}

/** One plain line for an area: "3 weigh-ins, 9 meals logged" or the empty note. */
export function inputLine(a: AreaWeek, max = 3): string {
  if (!a.inputs.length) return 'Nothing counted yet this week'
  return a.inputs.slice(0, max).map((i) => `${i.count} ${i.label}`).join(', ')
}
