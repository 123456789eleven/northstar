// Weekly streak: active days per week (Monday start) against a target, with rest tokens that cover missed days.
// A missed week resets weeksInRow to 0; it never touches XP or levels.
import type { ISODate } from '../../../db'
import { addDays, startOfWeek } from '../../../lib/dates'
import type { StreakState } from '../types'

export const REST_TOKENS_PER_WEEK = 2

export interface MetWeek {
  weekOf: ISODate
  /** Day the target was reached (for the clear bonus). */
  date: ISODate
}

export interface StreakResult extends StreakState {
  metWeeks: MetWeek[]
}

interface WeekEval { met: boolean; count: number; covered: ISODate[]; dots: boolean[]; date: ISODate }

function evalWeek(active: Set<ISODate>, weekOf: ISODate, today: ISODate, target: number): WeekEval {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekOf, i))
  const isCurrent = today >= weekOf && today <= days[6]
  const act = days.map((d) => active.has(d))
  const count = act.filter(Boolean).length
  const missed = days.filter((d, i) => !act[i] && d < today)
  let cover: number
  if (isCurrent) {
    const remaining = days.filter((d, i) => d >= today && !act[i]).length
    cover = Math.min(REST_TOKENS_PER_WEEK, missed.length, Math.max(0, target - count - remaining))
  } else {
    cover = Math.min(REST_TOKENS_PER_WEEK, missed.length, Math.max(0, target - count))
  }
  const covered = missed.slice(0, cover)
  const dots = days.map((d, i) => act[i] || covered.includes(d))
  const met = count + cover >= target
  let date = isCurrent ? today : days[6]
  if (count >= target) {
    let n = 0
    for (let i = 0; i < 7; i++) if (act[i] && ++n === target) { date = days[i]; break }
  }
  return { met, count, covered, dots, date }
}

export function computeStreak(active: Set<ISODate>, today: ISODate, weekTarget: number): StreakResult {
  const target = Math.min(7, Math.max(1, Math.round(Number.isFinite(weekTarget) ? weekTarget : 5)))
  const thisWeek = startOfWeek(today)
  const cur = evalWeek(active, thisWeek, today, target)
  const metWeeks: MetWeek[] = []
  let first: ISODate | undefined
  for (const d of active) if (d <= today && (!first || d < first)) first = d

  let run = 0
  if (first) {
    for (let w = startOfWeek(first); w < thisWeek; w = addDays(w, 7)) {
      const e = evalWeek(active, w, today, target)
      if (e.met) { run++; metWeeks.push({ weekOf: w, date: e.date }) } else run = 0
    }
  }
  if (cur.met) { run++; metWeeks.push({ weekOf: thisWeek, date: cur.date }) }
  return {
    target,
    daysThisWeek: cur.count + cur.covered.length,
    weekDots: cur.dots,
    restTokens: REST_TOKENS_PER_WEEK - cur.covered.length,
    weeksInRow: run,
    metWeeks,
  }
}
