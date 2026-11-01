// Pure body-weight math. Dates are local YYYY-MM-DD strings; weights are pounds. No DB access.
import type { ISODate } from '../../db'
import { addDays, daysBetween } from '../../lib/dates'

export interface WeightPoint { date: ISODate; weight: number }
export interface AvgPoint extends WeightPoint { avg: number }

export const KCAL_PER_LB = 3500
export const HEALTHY_RATE = 0.75 // lb/week, middle of the 0.5-1.0 lean-gain range
export const FAST_RATE = 1.25

const sortByDate = (w: WeightPoint[]) => [...w].sort((a, b) => a.date.localeCompare(b.date))
const round1 = (n: number) => Math.round(n * 10) / 10

/** Trailing moving average: for each weigh-in, the mean of weigh-ins in the `window` days ending that day. */
export function movingAverage(weights: WeightPoint[], window = 7): AvgPoint[] {
  const s = sortByDate(weights)
  return s.map((p, i) => {
    let sum = 0
    let n = 0
    for (let j = i; j >= 0 && daysBetween(s[j].date, p.date) < window; j--) { sum += s[j].weight; n++ }
    return { ...p, avg: sum / n }
  })
}

/** Mean of weigh-ins in the `window` days ending `end` (inclusive); null when there are none. */
export function averageAt(weights: WeightPoint[], end: ISODate, window = 7): number | null {
  const start = addDays(end, -(window - 1))
  const xs = weights.filter((w) => w.date >= start && w.date <= end)
  return xs.length ? xs.reduce((s, w) => s + w.weight, 0) / xs.length : null
}

/**
 * Weekly rate (lb/week): least-squares slope over weigh-ins in the last `days` days ending `end`.
 * Needs at least 3 weigh-ins spread over 14+ days, otherwise null.
 */
export function weeklyRate(weights: WeightPoint[], end: ISODate, days = 28): number | null {
  const start = addDays(end, -(days - 1))
  const pts = weights.filter((w) => w.date >= start && w.date <= end)
  if (pts.length < 3) return null
  const xs = pts.map((p) => daysBetween(start, p.date))
  if (Math.max(...xs) - Math.min(...xs) < 13) return null
  const n = pts.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = pts.reduce((a, b) => a + b.weight, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (pts[i].weight - my); den += (xs[i] - mx) ** 2 }
  return den === 0 ? null : (num / den) * 7
}

/** Date the goal is reached at `rate` lb/week from `current`; null when not moving toward the goal. Already there: `from`. */
export function projectDate(current: number, goal: number, rate: number | null, from: ISODate): ISODate | null {
  if (current >= goal) return from
  if (rate == null || rate <= 0.01) return null
  return addDays(from, Math.ceil(((goal - current) / rate) * 7))
}

/** Whole weeks to cover `lb` at `rate` lb/week. */
export const weeksToGo = (lb: number, rate: number) => (rate > 0 ? Math.ceil(lb / rate) : null)

/** Targets the 7-day average crosses on the way up: each multiple of 5 above `start`, then the goal itself. */
export function milestoneTargets(start: number, goal: number): number[] {
  const out: number[] = []
  for (let t = (Math.floor(start / 5) + 1) * 5; t < goal; t += 5) out.push(t)
  if (goal > start) out.push(goal)
  return out
}

/** For each milestone target, the first date the 7-day average reached it (null if not yet). */
export function milestoneCrossings(weights: WeightPoint[], start: number, goal: number): { target: number; date: ISODate | null }[] {
  const series = movingAverage(weights)
  return milestoneTargets(start, goal).map((target) => ({ target, date: series.find((p) => p.avg >= target)?.date ?? null }))
}

export type Advice = { tone: 'good' | 'warn' | 'neutral'; text: string }

/** Plain-language read of the trend. `flatDays` = how long the 7-day average has been within ~0.3 lb. */
export function adviceFor(rate: number | null, spanDays: number, flat: boolean): Advice {
  if (rate == null) return { tone: 'neutral', text: spanDays < 14 ? 'Log a few more weigh-ins over two weeks and a trend will appear.' : 'Not enough weigh-ins in the last four weeks to read a trend.' }
  if (rate > FAST_RATE) return { tone: 'warn', text: `Gaining faster than about ${FAST_RATE} lb/week (${round1(rate)} now): more of it may be fat. Consider trimming the surplus by 100-150 kcal.` }
  if (flat || rate < 0.2) return { tone: 'warn', text: 'Flat for 2+ weeks: add roughly 200-300 kcal per day and give it two more weeks.' }
  if (rate < 0.5) return { tone: 'neutral', text: `Gaining ${round1(rate)} lb/week, a little under the 0.5-1.0 target. A small bump of 100-200 kcal would help.` }
  return { tone: 'good', text: `Gaining ${round1(rate)} lb/week, inside the 0.5-1.0 lb/week lean-gain range. Keep going.` }
}

/** True when the 7-day average at `end` is within 0.3 lb of the average 14 days earlier (and data spans 14+ days). */
export function isFlat(weights: WeightPoint[], end: ISODate): boolean {
  const now = averageAt(weights, end)
  const before = averageAt(weights, addDays(end, -14))
  if (now == null || before == null) return false
  return Math.abs(now - before) <= 0.3
}

export interface DailyTargets { maintenance: number; calories: number; protein: number }

export const roundTo = (n: number, step: number) => Math.round(n / step) * step

/** Maintenance estimate = weight x 15 (overridable); calories = maintenance + surplus; protein = 0.8 g per lb unless overridden. */
export function dailyTargets(weight: number, opts: { surplus: number; maintenance?: number; protein?: number }): DailyTargets {
  const maintenance = Math.round(opts.maintenance ?? weight * 15)
  return { maintenance, calories: maintenance + opts.surplus, protein: Math.round(opts.protein ?? weight * 0.8) }
}

/**
 * Maintenance estimated from data: average logged intake minus the energy in the weight change.
 * `intake` = per-day calorie totals (only days with food logged), `rate` = lb/week. Needs 14+ intake days.
 */
export function adaptiveMaintenance(intake: number[], rate: number | null): number | null {
  if (rate == null || intake.length < 14) return null
  const avg = intake.reduce((a, b) => a + b, 0) / intake.length
  return Math.round(avg - (rate * KCAL_PER_LB) / 7)
}
