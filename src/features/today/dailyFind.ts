// "Daily find": one factual sentence computed from data the app already holds. Pure and deterministic: the same data on the
// same day always gives the same sentence. Returns null when nothing can be said honestly (the line is then hidden).
import type { Budget, ISODate, Meal, Transaction } from '../../db'
import { addDays, daysBetween, startOfWeek } from '../../lib/dates'

export interface FindInput {
  /** Timestamps (ISO) of logged workouts. */
  workouts: string[]
  meals: Pick<Meal, 'date' | 'protein'>[]
  transactions: Pick<Transaction, 'date' | 'amount' | 'category'>[]
  budgets: Pick<Budget, 'category' | 'monthlyLimit'>[]
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export function workoutsFind(workouts: string[], d: ISODate): string | null {
  const thisWeek = startOfWeek(d)
  const lastWeek = addDays(thisWeek, -7)
  const day = (iso: string) => iso.slice(0, 10)
  const a = workouts.filter((w) => day(w) >= thisWeek && day(w) <= d).length
  const b = workouts.filter((w) => day(w) >= lastWeek && day(w) < thisWeek).length
  if (a === 0) return null
  return b > 0 ? `${plural(a, 'workout')} logged this week, ${b} last week.` : `${plural(a, 'workout')} logged this week.`
}

export function proteinFind(meals: FindInput['meals'], d: ISODate): string | null {
  const days = (from: ISODate, to: ISODate) =>
    new Set(meals.filter((m) => m.date >= from && m.date <= to && (m.protein ?? 0) > 0).map((m) => m.date)).size
  const a = days(addDays(d, -6), d)
  const b = days(addDays(d, -13), addDays(d, -7))
  if (a === 0) return null
  return b > 0
    ? `Protein logged on ${a} of the last 7 days, ${b} the week before.`
    : `Protein logged on ${a} of the last 7 days.`
}

export function spendFind(txs: FindInput['transactions'], budgets: FindInput['budgets'], d: ISODate): string | null {
  const limits = new Map(budgets.filter((b) => b.monthlyLimit > 0).map((b) => [b.category, b.monthlyLimit]))
  if (limits.size === 0) return null
  const month = d.slice(0, 7)
  let spent = 0
  for (const t of txs) if (t.date.slice(0, 7) === month && t.date <= d && t.amount < 0 && limits.has(t.category)) spent += -t.amount
  const total = [...limits.values()].reduce((s, n) => s + n, 0)
  if (spent === 0) return null
  const dim = daysBetween(`${month}-01`, nextMonthStart(month))
  const spentPct = Math.round((spent / total) * 100)
  const monthPct = Math.round((Number(d.slice(8, 10)) / dim) * 100)
  return `Budgeted spending is at ${spentPct}% of the month's limits, with ${monthPct}% of the month gone.`
}

function nextMonthStart(month: string): ISODate {
  const [y, m] = month.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

const dayOfYear = (d: ISODate) => daysBetween(`${d.slice(0, 4)}-01-01`, d)

/** The sentences that can be said today, rotated by day of year so the line changes daily but never flickers. */
export function dailyFind(input: FindInput, d: ISODate): string | null {
  const all = [workoutsFind(input.workouts, d), proteinFind(input.meals, d), spendFind(input.transactions, input.budgets, d)].filter((s): s is string => !!s)
  return all.length ? all[dayOfYear(d) % all.length] : null
}
