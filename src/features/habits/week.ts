// Pure weekly-ring math for habits. Dates are local YYYY-MM-DD; weeks run Monday to Sunday.
// All arithmetic is on calendar days (addDays), so DST weeks with a 23 or 25 hour day still have exactly 7 days.
import type { ISODate } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'
import { isDaily, weekCount } from './stats'

export interface WeekDay {
  date: ISODate
  on: boolean
  today: boolean
  future: boolean
}

export interface WeekRing {
  done: number
  target: number
  /** 0..1, capped: the ring never overfills. */
  pct: number
  exceeded: boolean
  /** Monday..Sunday of the week containing `today`. */
  days: WeekDay[]
}

export function weekRing(dates: Set<ISODate>, today: ISODate, perWeek: number): WeekRing {
  const start = startOfWeek(today)
  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    return { date, on: dates.has(date), today: date === today, future: date > today }
  })
  const done = days.filter((d) => d.on).length
  const target = Math.max(1, Math.min(7, perWeek))
  return { done, target, pct: Math.min(1, done / target), exceeded: done > target, days }
}

/** Due today: not checked today, and the week's target is still open (daily habits are always due). */
export function isDueToday(dates: Set<ISODate>, today: ISODate, perWeek: number): boolean {
  if (dates.has(today)) return false
  return isDaily(perWeek) || weekCount(dates, today) < perWeek
}

export interface MonthCell {
  date: ISODate
  inMonth: boolean
  done: boolean
  future: boolean
}

/** The calendar month containing `today` as Monday-first week rows; days outside the month are marked. */
export function monthGrid(dates: Set<ISODate>, today: ISODate): MonthCell[][] {
  const first = `${today.slice(0, 7)}-01`
  const start = startOfWeek(first)
  const rows: MonthCell[][] = []
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d)
      return { date, inMonth: date.slice(0, 7) === first.slice(0, 7), done: dates.has(date), future: date > today }
    })
    if (!row.some((c) => c.inMonth)) break
    rows.push(row)
  }
  return rows
}
