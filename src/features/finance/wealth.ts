// Pure wealth scoreboard math: weekly form guide, net worth change and pace, records, savings engine inputs.
// No DB access. Dates are local YYYY-MM-DD strings. Nothing here is advice; it describes what already happened.
import type { Budget, Contribution, ISODate, Transaction } from '../../db'
import { addDays, daysBetween, startOfWeek } from '../../lib/dates'
import { monthlyEquivalent, matchesBill, type Bill } from './bills'
import { isSpend } from './categories'
import { summarize } from './model'

export type Mark = 'W' | 'D' | 'L' | 'none'
export interface WeekForm { start: ISODate; end: ISODate; spent: number; allowance: number; mark: Mark }

/** The rule, shown next to the marks so nothing is a black box. */
export const FORM_RULE =
  'Weeks run Monday to Sunday. Your weekly allowance is your monthly budget (minus the bills you track) times 12, divided by 52. A week is a win when you spend at least 5% under it, a draw when you land within 5% of it, and a loss when you go over. Weeks with no transactions stay blank.'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Monthly discretionary budget: limits above zero, minus the monthly share of tracked bills in budgeted categories. */
export function discretionaryBudget(budgets: Budget[], bills: Bill[]): number {
  const limits = budgets.filter((b) => b.monthlyLimit > 0)
  const cats = new Set(limits.map((b) => b.category))
  const total = limits.reduce((s, b) => s + b.monthlyLimit, 0)
  const billShare = bills.filter((b) => cats.has(b.category)).reduce((s, b) => s + monthlyEquivalent(b), 0)
  return Math.max(0, round2(total - billShare))
}
export const weeklyAllowance = (monthly: number) => round2((monthly * 12) / 52)

/** W when spent <= 95% of allowance, D when above that and <= allowance, L when over. */
export function weekMark(spent: number, allowance: number): Exclude<Mark, 'none'> {
  if (spent > allowance + 1e-9) return 'L'
  if (spent <= allowance * 0.95 + 1e-9) return 'W'
  return 'D'
}

/** Spend in budgeted categories for a date range. Bill payments are excluded (their share is already out of the allowance). */
function weekSpend(txs: Transaction[], cats: Set<string>, bills: Bill[], from: ISODate, to: ISODate) {
  let spent = 0
  let any = false
  for (const t of txs) {
    if (t.date < from || t.date > to) continue
    any = true
    if (!isSpend(t) || !cats.has(t.category)) continue
    if (bills.some((b) => matchesBill(b, t))) continue
    spent -= t.amount
  }
  return { spent: round2(Math.max(0, spent)), any }
}

/** The last `weeks` completed weeks, oldest first. The current, unfinished week is never judged. */
export function formGuide(txs: Transaction[], budgets: Budget[], bills: Bill[], todayISO: ISODate, weeks = 8): WeekForm[] {
  const monthly = discretionaryBudget(budgets, bills)
  const allowance = weeklyAllowance(monthly)
  const cats = new Set(budgets.filter((b) => b.monthlyLimit > 0).map((b) => b.category))
  const thisMonday = startOfWeek(todayISO)
  const out: WeekForm[] = []
  for (let i = weeks; i >= 1; i--) {
    const start = addDays(thisMonday, -7 * i)
    const end = addDays(start, 6)
    const { spent, any } = weekSpend(txs, cats, bills, start, end)
    out.push({ start, end, spent, allowance, mark: !any || allowance <= 0 ? 'none' : weekMark(spent, allowance) })
  }
  return out
}

export const formTally = (f: WeekForm[]) => ({
  w: f.filter((x) => x.mark === 'W').length,
  d: f.filter((x) => x.mark === 'D').length,
  l: f.filter((x) => x.mark === 'L').length,
})

/** Consecutive weeks within budget (W or D). `current` ends at the latest week; `longest` is the best run anywhere in `f`. */
export function underBudgetRuns(f: WeekForm[]): { current: number; longest: number; longestEnd: ISODate | null } {
  let run = 0
  let longest = 0
  let longestEnd: ISODate | null = null
  for (const w of f) {
    if (w.mark === 'W' || w.mark === 'D') {
      run++
      if (run >= longest) { longest = run; longestEnd = w.end }
    } else run = 0
  }
  return { current: run, longest, longestEnd }
}

/** Every completed week since the first transaction (capped at 260), for records. */
export function fullForm(txs: Transaction[], budgets: Budget[], bills: Bill[], todayISO: ISODate): WeekForm[] {
  if (!txs.length) return []
  const first = txs.reduce((m, t) => (t.date < m ? t.date : m), txs[0].date)
  const weeks = Math.min(260, Math.max(0, Math.floor(daysBetween(startOfWeek(first), startOfWeek(todayISO)) / 7)))
  return formGuide(txs, budgets, bills, todayISO, weeks)
}

/* ---------- Month ghost: cumulative spending by day ---------- */
export interface Ghost { cur: number[]; last: number[] | null; best: number[] | null; bestMonth: string | null; curTotal: number; lastAtDay: number | null; day: number }
const lastDayOf = (month: string) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()

/** Cumulative spending per day of a month, index 0 = day 1, stopping at `upToDay`. */
export function cumulativeSpend(txs: Transaction[], month: string, upToDay: number): number[] {
  const per = new Array<number>(lastDayOf(month)).fill(0)
  for (const t of txs) if (t.date.startsWith(month) && isSpend(t)) per[Number(t.date.slice(8, 10)) - 1] -= t.amount
  const out: number[] = []
  let run = 0
  for (let i = 0; i < Math.min(upToDay, per.length); i++) { run += per[i]; out.push(round2(run)) }
  return out
}
const prevMonth = (m: string) => { const y = Number(m.slice(0, 4)); const mo = Number(m.slice(5, 7)); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}` }

/** This month so far against last month and your lowest-spending complete month (it needs income, so empty months never win). */
export function monthGhost(txs: Transaction[], todayISO: ISODate): Ghost {
  const month = todayISO.slice(0, 7)
  const day = Number(todayISO.slice(8, 10))
  const cur = cumulativeSpend(txs, month, day)
  const lm = prevMonth(month)
  const hasLast = txs.some((t) => t.date.startsWith(lm))
  const last = hasLast ? cumulativeSpend(txs, lm, lastDayOf(lm)) : null
  const months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].filter((m) => m < month)
  let best: string | null = null
  let bestSpend = Infinity
  for (const m of months) {
    const s = summarize(txs.filter((t) => t.date.startsWith(m)))
    if (s.income > 0 && s.spending > 0 && s.spending < bestSpend) { bestSpend = s.spending; best = m }
  }
  const bestSeries = best ? cumulativeSpend(txs, best, lastDayOf(best)) : null
  return { cur, last, best: bestSeries, bestMonth: best, curTotal: cur.at(-1) ?? 0, lastAtDay: last ? (last[Math.min(day, last.length) - 1] ?? null) : null, day }
}

/* ---------- Net worth ---------- */
export interface NetPoint { date: ISODate; net: number }

/** Change since the latest point on or before `days` ago. Null when history does not reach back that far. */
export function changeOver(series: NetPoint[], days: number, todayISO: ISODate): number | null {
  if (!series.length) return null
  const cutoff = addDays(todayISO, -days)
  let base: NetPoint | null = null
  for (const p of series) if (p.date <= cutoff) base = p
  if (!base) return null
  return Math.round(series[series.length - 1].net - base.net)
}

/** Milestone spacing that fits the size of the number: $1k early, then $5k, $10k, and wider as it grows. */
export function autoStep(top: number): number {
  const t = Math.max(0, top)
  if (t < 5000) return 1000
  if (t < 50000) return 5000
  if (t < 250000) return 10000
  if (t < 1000000) return 50000
  return 100000
}

/** True only when the latest point is strictly above every earlier one (a record that was actually set). */
export function isNewHigh(series: NetPoint[]): boolean {
  if (series.length < 2) return false
  const last = series[series.length - 1].net
  return series.slice(0, -1).every((p) => p.net < last)
}

export type Pace =
  | { state: 'ok'; perWeek: number; weeks: number; days: number }
  | { state: 'thin' }
  | { state: 'flat' }

/** Weeks to cover `toGo` at the growth of the last 120 days. Needs two updates at least 14 days apart; says so otherwise. */
export function paceToNext(series: NetPoint[], toGo: number): Pace {
  if (series.length < 2) return { state: 'thin' }
  const lastP = series[series.length - 1]
  const from = addDays(lastP.date, -120)
  const inWin = series.filter((p) => p.date >= from)
  const first = inWin[0]
  const days = daysBetween(first.date, lastP.date)
  if (inWin.length < 2 || days < 14) return { state: 'thin' }
  const perWeek = ((lastP.net - first.net) / days) * 7
  if (perWeek <= 0) return { state: 'flat' }
  return { state: 'ok', perWeek: Math.round(perWeek), weeks: Math.max(1, Math.ceil(toGo / perWeek)), days }
}

export function paceText(p: Pace, toGo: number, target: string, fmt: (n: number) => string): string {
  if (p.state === 'thin') return `${fmt(toGo)} to ${target}. Not enough history to estimate a pace yet; two updates a few weeks apart will do it.`
  if (p.state === 'flat') return `${fmt(toGo)} to ${target}. Net worth has not grown over the last stretch, so there is no pace to project.`
  const w = p.weeks > 520 ? 'more than 10 years' : p.weeks >= 104 ? `about ${Math.round(p.weeks / 52)} years` : `about ${p.weeks} ${p.weeks === 1 ? 'week' : 'weeks'}`
  return `${fmt(toGo)} to ${target}, ${w} at your recent pace of ${fmt(p.perWeek)} a week.`
}

/* ---------- Records ---------- */
export function bestSavingMonth(txs: Transaction[], todayISO: ISODate): { month: string; net: number } | null {
  const cur = todayISO.slice(0, 7)
  let best: { month: string; net: number } | null = null
  for (const m of new Set(txs.map((t) => t.date.slice(0, 7)))) {
    if (m >= cur) continue
    const s = summarize(txs.filter((t) => t.date.startsWith(m)))
    if (s.income > 0 && s.net > 0 && (!best || s.net > best.net)) best = { month: m, net: Math.round(s.net) }
  }
  return best
}

export function biggestJump(series: NetPoint[]): { amount: number; date: ISODate } | null {
  let best: { amount: number; date: ISODate } | null = null
  for (let i = 1; i < series.length; i++) {
    const d = series[i].net - series[i - 1].net
    if (d > 0 && (!best || d > best.amount)) best = { amount: Math.round(d), date: series[i].date }
  }
  return best
}

export function highestPoint(series: NetPoint[]): { value: number; date: ISODate } | null {
  let best: { value: number; date: ISODate } | null = null
  for (const p of series) if (p.net > 0 && (!best || p.net >= best.value)) best = { value: Math.round(p.net), date: p.date }
  return best
}

/** Combined value of the given account names over time, each account's latest balance carried forward at every snapshot date. */
export function accountsPath(snaps: { date: ISODate; name: string; balance: number; id?: number }[], names: Set<string>): NetPoint[] {
  const rows = snaps.filter((b) => names.has(b.name)).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  const carry = new Map<string, number>()
  const path: NetPoint[] = []
  rows.forEach((b, i) => {
    carry.set(b.name, b.balance)
    if (rows[i + 1]?.date === b.date) return
    path.push({ date: b.date, net: [...carry.values()].reduce((x, y) => x + y, 0) })
  })
  return path
}

/* ---------- Savings engine ---------- */
export interface Surplus { income: number; spending: number; bills: number; surplus: number; months: number }

/** Average of the last three complete months with data: income, spending outside tracked bills, tracked bills, and what is left. */
export function monthlySurplus(txs: Transaction[], bills: Bill[], todayISO: ISODate): Surplus | null {
  const cur = todayISO.slice(0, 7)
  const months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].filter((m) => m < cur).sort().slice(-3)
  if (!months.length) return null
  let income = 0
  let spending = 0
  for (const m of months) {
    const mt = txs.filter((t) => t.date.startsWith(m))
    income += summarize(mt).income
    spending += summarize(mt.filter((t) => !(t.amount < 0 && bills.some((b) => matchesBill(b, t))))).spending
  }
  const n = months.length
  const billsMonthly = round2(bills.reduce((s, b) => s + monthlyEquivalent(b), 0))
  const inc = round2(income / n)
  const sp = round2(spending / n)
  return { income: inc, spending: sp, bills: billsMonthly, surplus: round2(inc - sp - billsMonthly), months: n }
}

/** Contributions over the last 90 days as a monthly figure (withdrawals ignored). */
export function monthlyContribution(rows: Contribution[], todayISO: ISODate): number {
  const from = addDays(todayISO, -90)
  const sum = rows.filter((c) => c.kind === 'contribution' && c.date > from && c.date <= todayISO).reduce((s, c) => s + c.amount, 0)
  return round2(sum / 3)
}
