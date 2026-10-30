// Pure habit math. Dates are local YYYY-MM-DD strings; weeks start Monday.
import type { ISODate } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'

export interface Streak {
  count: number
  unit: 'day' | 'week'
}

/** Daily habits (7/week) count consecutive days; everything else counts consecutive weeks meeting the target. */
export const isDaily = (perWeek: number) => perWeek >= 7

/** Check-ins from Monday through Sunday of the week containing `date`. */
export function weekCount(dates: Set<ISODate>, date: ISODate): number {
  const start = startOfWeek(date)
  let n = 0
  for (let i = 0; i < 7; i++) if (dates.has(addDays(start, i))) n++
  return n
}

export function weekProgress(dates: Set<ISODate>, today: ISODate, perWeek: number) {
  return { done: weekCount(dates, today), target: perWeek }
}

/** A streak survives until its period is missed: today/this week may still be open. */
export function streak(dates: Set<ISODate>, today: ISODate, perWeek: number): Streak {
  if (isDaily(perWeek)) {
    let d = dates.has(today) ? today : addDays(today, -1)
    let count = 0
    while (dates.has(d)) {
      count++
      d = addDays(d, -1)
    }
    return { count, unit: 'day' }
  }
  const target = Math.max(1, perWeek)
  let w = startOfWeek(today)
  let count = 0
  if (weekCount(dates, w) >= target) count = 1
  w = addDays(w, -7)
  // Cap the walk: no one needs to look back more than ~10 years of weeks.
  for (let i = 0; i < 520 && weekCount(dates, w) >= target; i++) {
    count++
    w = addDays(w, -7)
  }
  return { count, unit: 'week' }
}

export const STREAK_MILESTONES: Record<Streak['unit'], number[]> = { day: [7, 30, 100], week: [4, 12, 26] }

/** The milestone this streak count has just reached, if any. */
export function milestoneFor(s: Streak): number | null {
  return STREAK_MILESTONES[s.unit].includes(s.count) ? s.count : null
}

export interface HeatCell {
  date: ISODate
  done: boolean
  future: boolean
}

/** `weeks` columns (oldest first), each Monday..Sunday, the last being the current week. */
export function heatGrid(dates: Set<ISODate>, today: ISODate, weeks = 12): HeatCell[][] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d)
      return { date, done: dates.has(date), future: date > today }
    }),
  )
}

/** The last 7 days ending today, oldest first. */
export const lastDays = (today: ISODate, n = 7): ISODate[] => Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)))

export const PER_WEEK_PRESETS = [
  { value: 7, label: 'Daily' },
  { value: 5, label: '5x a week' },
  { value: 3, label: '3x a week' },
  { value: 1, label: 'Weekly' },
]

export const perWeekLabel = (n: number) => PER_WEEK_PRESETS.find((p) => p.value === n)?.label ?? `${n}x a week`
