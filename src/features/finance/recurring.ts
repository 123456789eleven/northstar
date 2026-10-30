// Recurring-charge detection (pure). Same merchant, amounts within 10%, regular spacing.
import type { ISODate, Transaction } from '../../db'
import { addDays, daysBetween, toISODate } from '../../lib/dates'
import { isSpend, merchantKey } from './categories'

export type Cadence = 'weekly' | 'monthly' | 'yearly'

export interface Recurring {
  merchant: string
  amount: number
  cadence: Cadence
  count: number
  last: ISODate
  next: ISODate
  /** Typical monthly cost (weekly x 52/12, yearly / 12). */
  monthly: number
}

const WINDOWS: Record<Cadence, [number, number, number]> = { weekly: [6, 8, 7], monthly: [26, 35, 30], yearly: [350, 380, 365] }
const MIN_COUNT: Record<Cadence, number> = { weekly: 4, monthly: 3, yearly: 2 }

function addMonth(d: ISODate): ISODate {
  const [y, m, day] = d.split('-').map(Number)
  const dt = new Date(y, m, 1)
  dt.setDate(Math.min(day, new Date(y, m + 1, 0).getDate()))
  return toISODate(dt)
}

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

function cadenceOf(dates: ISODate[]): Cadence | null {
  const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d))
  if (!gaps.length) return null
  for (const c of ['weekly', 'monthly', 'yearly'] as Cadence[]) {
    const [lo, hi] = WINDOWS[c]
    const ok = gaps.filter((g) => g >= lo && g <= hi).length
    if (dates.length >= MIN_COUNT[c] && ok / gaps.length >= 0.7) return c
  }
  return null
}

/** `today` drops series that have clearly stopped (no charge for 1.6 cycles). */
export function detectRecurring(txs: Transaction[], today: ISODate): Recurring[] {
  const byMerchant = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!isSpend(t)) continue
    const k = merchantKey(t.description)
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), t])
  }
  const out: Recurring[] = []
  for (const [merchant, list] of byMerchant) {
    // Cluster by amount: a group extends while the next amount is within 10% of the group's first.
    const sorted = [...list].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount))
    const groups: Transaction[][] = []
    for (const t of sorted) {
      const g = groups.at(-1)
      if (g && Math.abs(t.amount) <= Math.abs(g[0].amount) * 1.1) g.push(t)
      else groups.push([t])
    }
    for (const g of groups) {
      // Two charges on one day (or within 3 days) are one cycle, not two.
      const dates = [...new Set(g.map((t) => t.date))].sort()
      const cycle = dates.filter((d, i) => i === 0 || daysBetween(dates[i - 1], d) > 3)
      const cadence = cadenceOf(cycle)
      if (!cadence) continue
      const last = cycle.at(-1)!
      const [, , step] = WINDOWS[cadence]
      if (daysBetween(last, today) > step * 1.6) continue
      const amount = Math.round(median(g.map((t) => Math.abs(t.amount))) * 100) / 100
      const monthly = cadence === 'monthly' ? amount : cadence === 'weekly' ? (amount * 52) / 12 : amount / 12
      out.push({ merchant, amount, cadence, count: cycle.length, last, next: cadence === 'monthly' ? addMonth(last) : addDays(last, step), monthly: Math.round(monthly * 100) / 100 })
    }
  }
  return out.sort((a, b) => b.monthly - a.monthly)
}

export const monthlyTotal = (r: Recurring[]) => Math.round(r.reduce((s, x) => s + x.monthly, 0) * 100) / 100
