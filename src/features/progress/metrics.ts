// Auto-metrics for goals and the weekly review (pure: data in, plain objects out; no NaN, no divide by zero).
import type { BalanceSnapshot, Budget, Goal, GoalMetric, Habit, HabitLog, ISODate, LifeEvent, Meal, StudySession, Transaction, WeightEntry } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'
import { budgetSpend, type Bill } from '../finance/bills'
import { netWorthSeries } from '../finance/model'

export type MetricSource = Exclude<GoalMetric['source'], 'manual'>

export const SOURCE_LABEL: Record<MetricSource, string> = {
  weight: 'Weight',
  'protein-days': 'Protein target days',
  'calorie-days': 'Calorie target days',
  workouts: 'Workouts',
  'study-minutes': 'Study minutes',
  'under-budget': 'Under budget',
  'net-worth': 'Net worth',
}

export const SOURCE_UNIT: Record<MetricSource, string> = {
  weight: 'lb',
  'protein-days': 'days',
  'calorie-days': 'days',
  workouts: 'workouts',
  'study-minutes': 'min',
  'under-budget': '%',
  'net-worth': '$',
}

export interface MetricData {
  today: ISODate
  weights: WeightEntry[]
  meals: Meal[]
  targets: { calories?: number; protein?: number }
  /** Starting weight from Body settings; falls back to the earliest weigh-in. */
  startWeight?: number
  habits: Habit[]
  habitLogs: HabitLog[]
  events: LifeEvent[]
  studySessions: StudySession[]
  transactions: Transaction[]
  budgets: Budget[]
  bills: Bill[]
  balances: BalanceSnapshot[]
}

export const emptyMetricData = (today: ISODate): MetricData => ({
  today, weights: [], meals: [], targets: {}, habits: [], habitLogs: [], events: [], studySessions: [], transactions: [], budgets: [], bills: [], balances: [],
})

export interface MetricResult {
  source: MetricSource
  hasData: boolean
  /** Current value in the source's unit (null when there is no data). */
  value: number | null
  target: number
  /** 0-100, always finite. */
  pct: number
  met: boolean
  /** "142.6 of 165 lb" */
  label: string
  /** Tiny trend note, or '' when there is nothing honest to say. */
  note: string
}

const clamp = (n: number, lo = 0, hi = 100) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo)
const round1 = (n: number) => Math.round(n * 10) / 10
const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(round1(n)))
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${fmt(Math.abs(n))}`

export const WORKOUT_RE = /lift|workout|gym|train/i

export function defaultWindow(source: MetricSource): NonNullable<GoalMetric['window']> {
  return source === 'under-budget' ? 'month' : 'week'
}

/** Inclusive range for the window ending on `today`; `prior` is the previous full window (null for 'goal'). */
export function windowRange(window: NonNullable<GoalMetric['window']>, today: ISODate, since?: ISODate): { from: ISODate; to: ISODate; prior: { from: ISODate; to: ISODate } | null } {
  if (window === 'week') {
    const from = startOfWeek(today)
    return { from, to: today, prior: { from: addDays(from, -7), to: addDays(from, -1) } }
  }
  if (window === 'month') {
    const from = `${today.slice(0, 7)}-01`
    const prevEnd = addDays(from, -1)
    return { from, to: today, prior: { from: `${prevEnd.slice(0, 7)}-01`, to: prevEnd } }
  }
  return { from: since && since <= today ? since : today, to: today, prior: null }
}

const inRange = (d: ISODate, from: ISODate, to: ISODate) => d >= from && d <= to

/** Average of weigh-ins in the 7 days ending `end`; null when none. */
export function weightAverage(weights: WeightEntry[], end: ISODate): number | null {
  const from = addDays(end, -6)
  const rows = weights.filter((w) => inRange(w.date, from, end) && Number.isFinite(w.weight))
  return rows.length ? rows.reduce((s, w) => s + w.weight, 0) / rows.length : null
}

/** Latest 7-day average: the 7 days ending on the most recent weigh-in on or before `today`. */
function latestWeightAverage(weights: WeightEntry[], today: ISODate): { avg: number; end: ISODate } | null {
  const upto = weights.filter((w) => w.date <= today)
  if (!upto.length) return null
  const end = upto.reduce((m, w) => (w.date > m ? w.date : m), upto[0].date)
  const avg = weightAverage(upto, end)
  return avg == null ? null : { avg, end }
}

/** Distinct days in [from,to] whose summed meals reach >=95% of the target. */
export function daysMeetingTarget(meals: Meal[], key: 'protein' | 'calories', target: number | undefined, from: ISODate, to: ISODate): number {
  if (!target || target <= 0) return 0
  const byDay = new Map<string, number>()
  for (const m of meals) if (inRange(m.date, from, to)) byDay.set(m.date, (byDay.get(m.date) ?? 0) + (m[key] ?? 0))
  let n = 0
  for (const v of byDay.values()) if (v >= target * 0.95) n++
  return n
}

/** Distinct days with a workout: lift/workout habit check-ins, else workout-like timeline events. */
export function workoutDays(d: Pick<MetricData, 'habits' | 'habitLogs' | 'events'>, from: ISODate, to: ISODate): number {
  const ids = new Set(d.habits.filter((h) => !h.archived && h.id != null && WORKOUT_RE.test(h.name)).map((h) => h.id))
  const days = new Set<string>()
  if (ids.size) {
    for (const l of d.habitLogs) if (ids.has(l.habitId) && inRange(l.date, from, to)) days.add(l.date)
    return days.size
  }
  for (const e of d.events) {
    if (e.kind.startsWith('goal.') || !(WORKOUT_RE.test(e.kind) || WORKOUT_RE.test(e.title))) continue
    const day = e.at.slice(0, 10)
    if (inRange(day, from, to)) days.add(day)
  }
  return days.size
}

export const studyMinutes = (s: StudySession[], from: ISODate, to: ISODate) => s.filter((x) => inRange(x.date, from, to)).reduce((t, x) => t + (x.minutes || 0), 0)

export interface BudgetMonth { spent: number; limit: number; categories: number }

/** Spending vs budgets for the month containing `anyDay`: only budgeted categories, bill set-aside applied. */
export function budgetMonth(d: Pick<MetricData, 'transactions' | 'budgets' | 'bills'>, anyDay: ISODate, upTo?: ISODate): BudgetMonth {
  const m = anyDay.slice(0, 7)
  const txs = d.transactions.filter((t) => t.date.slice(0, 7) === m && (!upTo || t.date <= upTo))
  const { spent } = budgetSpend(txs, d.bills)
  let s = 0
  let limit = 0
  let categories = 0
  for (const b of d.budgets) {
    if (!(b.monthlyLimit > 0)) continue
    limit += b.monthlyLimit
    s += spent.get(b.category) ?? 0
    categories++
  }
  return { spent: s, limit, categories }
}

const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

function countResult(source: MetricSource, count: number, m: GoalMetric, windowName: string, prior: number | null, hasData: boolean, noun: string): MetricResult {
  const target = m.target > 0 ? m.target : 0
  const wlabel = windowName === 'goal' ? 'so far' : `this ${windowName}`
  return {
    source,
    hasData,
    value: hasData ? count : null,
    target,
    pct: clamp(ratio(count, target) * 100),
    met: hasData && target > 0 && count >= target,
    label: hasData ? `${count} of ${target} ${noun} ${wlabel}` : '',
    note: hasData && prior != null ? `Last ${windowName}: ${prior}` : '',
  }
}

const NO_DATA = (source: MetricSource, target: number): MetricResult => ({ source, hasData: false, value: null, target, pct: 0, met: false, label: '', note: '' })

/** Current value and percent complete for one goal metric. `since` = the goal's creation date (for window 'goal'). */
export function computeMetric(metric: GoalMetric, d: MetricData, since?: ISODate): MetricResult | null {
  if (metric.source === 'manual') return null
  const source = metric.source
  const target = Number.isFinite(metric.target) ? metric.target : 0
  const win = metric.window ?? defaultWindow(source)
  const r = windowRange(win, d.today, since)

  switch (source) {
    case 'weight': {
      const cur = latestWeightAverage(d.weights, d.today)
      if (!cur) return NO_DATA(source, target)
      const sorted = [...d.weights].filter((w) => w.date <= d.today).sort((a, b) => a.date.localeCompare(b.date))
      const start = d.startWeight ?? sorted[0].weight
      const dir = metric.direction ?? (target >= start ? 'up' : 'down')
      const span = dir === 'up' ? target - start : start - target
      const moved = dir === 'up' ? cur.avg - start : start - cur.avg
      const met = dir === 'up' ? cur.avg >= target : cur.avg <= target
      const prev = weightAverage(d.weights, addDays(cur.end, -7))
      const delta = prev == null ? null : round1(cur.avg - prev)
      return {
        source, hasData: true, value: round1(cur.avg), target,
        pct: met ? 100 : span > 0 ? clamp((moved / span) * 100) : 0,
        met,
        label: `${fmt(round1(cur.avg))} of ${fmt(target)} lb`,
        note: delta == null ? '7-day average' : `${signed(delta)} lb vs the 7 days before`,
      }
    }
    case 'protein-days':
    case 'calorie-days': {
      const key = source === 'protein-days' ? 'protein' : 'calories'
      const t = d.targets[key]
      if (!t || t <= 0) return NO_DATA(source, target)
      const hasData = d.meals.some((m) => inRange(m.date, r.from, r.to))
      const count = daysMeetingTarget(d.meals, key, t, r.from, r.to)
      const prior = r.prior ? daysMeetingTarget(d.meals, key, t, r.prior.from, r.prior.to) : null
      return countResult(source, count, metric, win, prior, hasData, 'days')
    }
    case 'workouts': {
      const count = workoutDays(d, r.from, r.to)
      const hasData = count > 0 || d.habits.some((h) => !h.archived && WORKOUT_RE.test(h.name))
      const prior = r.prior ? workoutDays(d, r.prior.from, r.prior.to) : null
      return countResult(source, count, metric, win, prior, hasData, 'workouts')
    }
    case 'study-minutes': {
      const hasData = d.studySessions.length > 0
      const count = studyMinutes(d.studySessions, r.from, r.to)
      const prior = r.prior ? studyMinutes(d.studySessions, r.prior.from, r.prior.to) : null
      const res = countResult(source, count, metric, win, prior, hasData, 'min')
      return res
    }
    case 'under-budget': {
      const b = budgetMonth(d, d.today)
      const cap = (b.limit * (target > 0 ? target : 100)) / 100
      if (b.categories === 0 || cap <= 0) return NO_DATA(source, target)
      const under = b.spent <= cap
      const monthEnd = addDays(`${addMonthStart(d.today)}`, -1)
      return {
        source, hasData: true, value: Math.round(b.spent), target,
        pct: under ? 100 : clamp(ratio(cap, b.spent) * 100),
        // Only counts as reached once the month is over, so mid-month it cannot "complete" early.
        met: under && d.today >= monthEnd,
        label: `${money0(b.spent)} of ${money0(cap)} budget`,
        note: under ? `${money0(cap - b.spent)} left this month` : `${money0(b.spent - cap)} over this month`,
      }
    }
    case 'net-worth': {
      const series = netWorthSeries(d.balances.filter((s) => s.date <= d.today))
      if (!series.length) return NO_DATA(source, target)
      const first = series[0].net
      const cur = series[series.length - 1].net
      const dir = metric.direction ?? (target >= first ? 'up' : 'down')
      const span = dir === 'up' ? target - first : first - target
      const moved = dir === 'up' ? cur - first : first - cur
      const met = dir === 'up' ? cur >= target : cur <= target
      const prev = series.length > 1 ? series[series.length - 2].net : null
      return {
        source, hasData: true, value: Math.round(cur), target,
        pct: met ? 100 : span > 0 ? clamp((moved / span) * 100) : 0,
        met,
        label: `${money0(cur)} of ${money0(target)}`,
        note: prev == null ? '' : `${cur - prev >= 0 ? '+' : '-'}${money0(Math.abs(cur - prev))} since the last snapshot`,
      }
    }
  }
}

/** First day of the month after `day`, as YYYY-MM-01. */
function addMonthStart(day: ISODate): ISODate {
  const [y, m] = day.split('-').map(Number)
  const ny = m === 12 ? y + 1 : y
  const nm = m === 12 ? 1 : m + 1
  return `${ny}-${String(nm).padStart(2, '0')}-01`
}

/** Metric result for a goal, using its creation date for window 'goal'. */
export function goalMetric(goal: Goal, d: MetricData): MetricResult | null {
  return goal.metric ? computeMetric(goal.metric, d, goal.createdAt.slice(0, 10)) : null
}

export interface LinkSuggestion { goalId: number; title: string; metric: GoalMetric; summary: string }

const firstNumber = (s: string) => {
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/)
  return m ? Number(m[1]) : null
}

/** Match unlinked goals to a metric by title keywords. Suggestions only; the owner taps to link. */
export function suggestLinks(goals: Goal[], opts: { bodyGoal?: number } = {}): LinkSuggestion[] {
  const out: LinkSuggestion[] = []
  for (const g of goals) {
    if (g.id == null || g.metric || g.status !== 'active') continue
    const t = g.title
    const make = (metric: GoalMetric, summary: string) => out.push({ goalId: g.id!, title: t, metric, summary })
    const n = firstNumber(t)
    if (/protein/i.test(t)) {
      const days = /(\d)\s*(days?|x|times)/i.exec(t)
      make({ source: 'protein-days', target: days ? Number(days[1]) : n && n <= 7 ? n : 6, window: 'week' }, 'Protein target days')
    } else if (/calorie/i.test(t)) {
      const days = /(\d)\s*(days?|x|times)/i.exec(t)
      make({ source: 'calorie-days', target: days ? Number(days[1]) : n && n <= 7 ? n : 6, window: 'week' }, 'Calorie target days')
    } else if (WORKOUT_RE.test(t) && /(\d+)\s*(times|x|days|sessions|workouts)/i.test(t)) {
      make({ source: 'workouts', target: Number(/(\d+)\s*(times|x|days|sessions|workouts)/i.exec(t)![1]), window: 'week' }, 'Workouts per week')
    } else if (/\b(lbs?|pounds?)\b|\bweight\b/i.test(t)) {
      const abs = n != null && n >= 80 ? n : opts.bodyGoal
      if (abs) make({ source: 'weight', target: abs, window: 'goal' }, `Weight, target ${abs} lb`)
    } else if (/\b(study|learn)/i.test(t) && /(\d+)\s*(h|hours?|min)/i.test(t)) {
      const m = /(\d+)\s*(h|hours?|min)/i.exec(t)!
      make({ source: 'study-minutes', target: /^h/i.test(m[2]) ? Number(m[1]) * 60 : Number(m[1]), window: 'week' }, 'Study minutes per week')
    } else if (/\bbudget\b|spending/i.test(t)) {
      make({ source: 'under-budget', target: 100, window: 'month' }, 'Stay under budget')
    } else if (/net worth/i.test(t) && n != null && n >= 100) {
      make({ source: 'net-worth', target: n, window: 'goal' }, `Net worth, target ${money0(n)}`)
    }
  }
  return out
}
