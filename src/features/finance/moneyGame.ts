// Pure money-game math: budget pace, the monthly boss (stay within the total budget), no-spend days, net worth milestones.
import type { Transaction } from '../../db'
import { isSpending } from './categories'

export type PaceStatus = 'on-track' | 'watch' | 'over'

export interface Pace {
  /** spent / limit (can exceed 1). */
  ratio: number
  /** Share of the month elapsed, where the pace marker sits (0..1). */
  marker: number
  status: PaceStatus
  /** Words, not only color. */
  label: string
}

export const daysInMonthOf = (month: string): number => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Day of month (1-based) that counts as "now" for `month`: today in the current month, the last day for past months, 0 for future months. */
export function dayOfMonthFor(month: string, todayISO: string): number {
  const cur = todayISO.slice(0, 7)
  if (month === cur) return Number(todayISO.slice(8, 10))
  return month < cur ? daysInMonthOf(month) : 0
}

export function budgetPace(spent: number, limit: number, day: number, daysInMonth: number): Pace {
  const ratio = limit > 0 ? spent / limit : 0
  const marker = daysInMonth > 0 ? Math.min(1, Math.max(0, day / daysInMonth)) : 0
  if (limit > 0 && ratio > 1) return { ratio, marker, status: 'over', label: 'Over budget' }
  if (limit > 0 && (ratio >= 0.9 || ratio > marker + 0.1)) return { ratio, marker, status: 'watch', label: ratio >= 0.9 ? 'Nearly used' : 'Ahead of pace' }
  return { ratio, marker, status: 'on-track', label: 'On pace' }
}

export interface Boss {
  /** HP remaining 0..1 (budget remaining). */
  hp: number
  remaining: number
  over: number
  daysLeft: number
  marker: number
  status: 'holding' | 'watch' | 'beaten' | 'won' | 'lost'
  headline: string
}

/** The monthly boss: stay within the total budget. HP = budget remaining. Past months resolve to won/lost. */
export function bossState(totalLimit: number, totalSpent: number, month: string, todayISO: string): Boss | null {
  if (totalLimit <= 0) return null
  const dim = daysInMonthOf(month)
  const day = dayOfMonthFor(month, todayISO)
  const spent = Math.max(0, totalSpent)
  const remaining = Math.max(0, totalLimit - spent)
  const over = Math.max(0, spent - totalLimit)
  const daysLeft = Math.max(0, dim - day)
  const marker = dim ? day / dim : 0
  const hp = Math.max(0, Math.min(1, 1 - spent / totalLimit))
  const past = month < todayISO.slice(0, 7)
  let status: Boss['status']
  if (over > 0) status = past ? 'lost' : 'beaten'
  else if (past) status = 'won'
  else status = spent / totalLimit > marker + 0.1 ? 'watch' : 'holding'
  const headline = over > 0 ? `${Math.round(over).toLocaleString()} over` : 'On budget'
  return { hp, remaining, over, daysLeft, marker, status, headline }
}

export interface NoSpendDay {
  date: string
  day: number
  state: 'nospend' | 'spent' | 'future'
}

/** One entry per day of `month`. A day with no spending transaction is a no-spend day; days after today are `future`. Other months' rows are ignored. */
export function noSpendDays(txs: Transaction[], month: string, todayISO: string): NoSpendDay[] {
  const spentOn = new Set<string>()
  for (const t of txs) if (t.date.startsWith(month) && isSpending(t) && t.amount < 0) spentOn.add(t.date)
  const dim = daysInMonthOf(month)
  return Array.from({ length: dim }, (_, i) => {
    const day = i + 1
    const date = `${month}-${String(day).padStart(2, '0')}`
    const state = date > todayISO ? 'future' : spentOn.has(date) ? 'spent' : 'nospend'
    return { date, day, state }
  })
}

export const noSpendCount = (days: NoSpendDay[]) => days.filter((d) => d.state === 'nospend').length

export interface NetFlag {
  target: number
  reached: boolean
  reachedOn: string | null
  next: boolean
}

export interface NetMilestones {
  flags: NetFlag[]
  high: { date: string; net: number } | null
  toNext: number | null
}

/** Flags at every `step` dollars the net worth line has crossed, plus the next one; and the previous high. */
export function netWorthMilestones(series: { date: string; net: number }[], step = 5000, maxFlags = 8): NetMilestones {
  if (!series.length) return { flags: [], high: null, toNext: null }
  let high = series[0]
  for (const p of series) if (p.net >= high.net) high = p
  const first = series[0].net
  const flags: NetFlag[] = []
  const lo = Math.floor(first / step) + 1
  const hi = Math.floor(high.net / step) + 1
  for (let k = lo; k <= hi; k++) {
    const target = k * step
    const hit = series.find((p) => p.net >= target)
    flags.push({ target, reached: !!hit, reachedOn: hit?.date ?? null, next: false })
  }
  const nx = flags.find((f) => !f.reached)
  if (nx) nx.next = true
  const shown = flags.length > maxFlags ? flags.slice(-maxFlags) : flags
  const now = series[series.length - 1].net
  return { flags: shown, high, toNext: nx ? Math.max(0, nx.target - now) : null }
}
