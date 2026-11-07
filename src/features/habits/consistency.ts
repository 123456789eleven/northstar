// Consistency grid and weekly summary for the Habits hero. No streaks, no loss language: empty days are simply empty,
// and every week allows one grace day before it stops counting as on target.
import type { ISODate } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'

export interface GridDay { date: ISODate; count: number; level: 0 | 1 | 2 | 3; future: boolean; today: boolean }

export const GRACE_DAYS = 1

/** `weeks` columns (oldest first), each Monday..Sunday. Level is the share of active habits checked that day. */
export function consistencyGrid(byHabit: Map<number, Set<ISODate>>, activeIds: number[], today: ISODate, weeks = 12): GridDay[][] {
  const first = addDays(startOfWeek(today), -7 * (weeks - 1))
  const n = Math.max(1, activeIds.length)
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d)
      const count = activeIds.reduce((s, id) => s + (byHabit.get(id)?.has(date) ? 1 : 0), 0)
      const share = count / n
      const level = (count === 0 ? 0 : share <= 1 / 3 ? 1 : share <= 2 / 3 ? 2 : 3) as GridDay['level']
      return { date, count, level, future: date > today, today: date === today }
    }),
  )
}

export interface WeekTotals { done: number; target: number }

/** Check-ins against weekly targets for the week starting `weekStart`. Over-target habits are capped so one habit cannot cover another. */
export function weekTotals(byHabit: Map<number, Set<ISODate>>, habits: { id: number; perWeek: number }[], weekStart: ISODate): WeekTotals {
  let done = 0
  let target = 0
  for (const h of habits) {
    const t = Math.max(1, Math.min(7, h.perWeek))
    let c = 0
    for (let i = 0; i < 7; i++) if (byHabit.get(h.id)?.has(addDays(weekStart, i))) c++
    done += Math.min(c, t)
    target += t
  }
  return { done, target }
}

/** Completed weeks (not the current one) that landed within the grace allowance of target, out of the last `weeks`. */
export function weeksOnTarget(byHabit: Map<number, Set<ISODate>>, habits: { id: number; perWeek: number }[], today: ISODate, weeks = 12): { on: number; of: number } {
  if (!habits.length) return { on: 0, of: 0 }
  const thisWeek = startOfWeek(today)
  let on = 0
  for (let i = 1; i <= weeks; i++) {
    const t = weekTotals(byHabit, habits, addDays(thisWeek, -7 * i))
    if (t.done >= t.target - GRACE_DAYS) on++
  }
  return { on, of: weeks }
}
