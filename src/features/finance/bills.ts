// Non-monthly bills (pure). A bill spreads one lump payment over the months it covers,
// so a $1,122 six-month premium budgets as $187/mo instead of a 600% overspend.
import type { Budget, ISODate, Transaction } from '../../db'
import { daysBetween, parseISODate, toISODate } from '../../lib/dates'
import { isSpend, merchantKey } from './categories'
import { summarize } from './model'
import { detectRecurring } from './recurring'

export const BILLS_KEY = 'finance.bills'
export const MAX_BILLS = 50
export const MATCH_TOLERANCE = 0.07
export const PRESET_CADENCES = [1, 2, 3, 6, 12]

export interface Bill {
  id: string
  name: string
  amount: number
  /** Months covered by one payment (1-24). */
  everyMonths: number
  lastPaid: ISODate
  category: string
  /** Lowercase substring of the transaction description. */
  matchText?: string
  account?: string
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Versioned envelope; tolerant parse so a bad synced value never breaks the page. */
export function parseBills(raw: unknown): Bill[] {
  const o = raw as { v?: number; items?: unknown } | null
  if (!o || o.v !== 1 || !Array.isArray(o.items)) return []
  const out: Bill[] = []
  for (const b of o.items as Partial<Bill>[]) {
    if (!b || typeof b.id !== 'string' || typeof b.name !== 'string' || typeof b.category !== 'string') continue
    if (typeof b.amount !== 'number' || !(b.amount > 0) || typeof b.everyMonths !== 'number') continue
    if (typeof b.lastPaid !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.lastPaid)) continue
    out.push({
      id: b.id,
      name: b.name,
      amount: b.amount,
      everyMonths: Math.min(24, Math.max(1, Math.round(b.everyMonths))),
      lastPaid: b.lastPaid,
      category: b.category,
      matchText: typeof b.matchText === 'string' && b.matchText.trim() ? b.matchText.trim().toLowerCase() : undefined,
      account: typeof b.account === 'string' && b.account.trim() ? b.account : undefined,
    })
  }
  return out.slice(0, MAX_BILLS)
}
export const serializeBills = (items: Bill[]) => ({ v: 1, items: items.slice(0, MAX_BILLS) })

/** Add n months, clamping to the end of a shorter month (Aug 31 + 6 gives Feb 28 or 29). */
export function addMonthsISO(d: ISODate, n: number): ISODate {
  const [y, m, day] = d.split('-').map(Number)
  const target = new Date(y, m - 1 + n, 1)
  target.setDate(Math.min(day, new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()))
  return toISODate(target)
}

export const monthlyEquivalent = (b: Bill) => round2(b.amount / b.everyMonths)
export const nextDue = (b: Bill): ISODate => addMonthsISO(b.lastPaid, b.everyMonths)
export const daysToDue = (b: Bill, today: ISODate) => daysBetween(today, nextDue(b))

/** Whole months from `from` to `to` (a month counts once its day-of-month is reached, clamped to month end). */
export function monthsElapsed(from: ISODate, to: ISODate): number {
  if (to <= from) return 0
  const a = parseISODate(from)
  const z = parseISODate(to)
  let n = (z.getFullYear() - a.getFullYear()) * 12 + z.getMonth() - a.getMonth()
  if (addMonthsISO(from, n) > to) n--
  return Math.max(0, n)
}

/** Set aside so far: monthly share x whole months since last paid, never more than the bill. */
export function accrued(b: Bill, today: ISODate): number {
  return round2(Math.min(b.amount, monthlyEquivalent(b) * monthsElapsed(b.lastPaid, today)))
}

/** Same category, and the description contains matchText or the amount is within 7% of the bill. */
export function matchesBill(b: Bill, t: Transaction): boolean {
  if (t.amount >= 0 || t.category !== b.category) return false
  if (b.matchText && t.description.toLowerCase().includes(b.matchText)) return true
  return Math.abs(Math.abs(t.amount) - b.amount) <= b.amount * MATCH_TOLERANCE
}

export interface BillInfo {
  /** Total monthly set-aside for bills in this category. */
  monthly: number
  bills: Bill[]
}

/**
 * Budget "spent" per category for one month. Lump payments that match a bill are removed and the bill's
 * monthly share is committed in every month instead. Cash-basis totals elsewhere use summarize() unchanged.
 */
export function budgetSpend(txs: Transaction[], bills: Bill[]): { spent: Map<string, number>; billInfo: Map<string, BillInfo> } {
  const spent = new Map(summarize(txs).byCategory)
  const billInfo = new Map<string, BillInfo>()
  for (const b of bills) {
    const info = billInfo.get(b.category) ?? { monthly: 0, bills: [] }
    info.monthly = round2(info.monthly + monthlyEquivalent(b))
    info.bills.push(b)
    billInfo.set(b.category, info)
  }
  for (const t of txs) {
    if (!isSpend(t)) continue
    const b = billInfo.get(t.category)?.bills.find((x) => matchesBill(x, t))
    if (b) spent.set(t.category, (spent.get(t.category) ?? 0) + t.amount)
  }
  for (const [c, info] of billInfo) spent.set(c, round2((spent.get(c) ?? 0) + info.monthly))
  return { spent, billInfo }
}

export interface BillSuggestion {
  key: string
  name: string
  amount: number
  everyMonths: number
  lastPaid: ISODate
  category: string
  matchText: string
  reason: string
  /** True when the cadence is a guess (a single large charge): the owner should confirm it. */
  confirm: boolean
}

const monthGap = (a: ISODate, b: ISODate) => {
  const n = monthsElapsed(a, b)
  return n + (daysBetween(addMonthsISO(a, n), b) > 15 ? 1 : 0)
}
const label = (k: string) => k.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

export function detectBillSuggestions(txs: Transaction[], budgets: Budget[], bills: Bill[], today: ISODate): BillSuggestion[] {
  const limit = new Map(budgets.map((b) => [b.category, b.monthlyLimit]))
  const covered = (category: string, amount: number, key: string) =>
    bills.some((b) => b.category === category && (Math.abs(b.amount - amount) <= b.amount * MATCH_TOLERANCE || (!!b.matchText && key.includes(b.matchText))))
  const out: BillSuggestion[] = []
  const seen = new Set<string>()
  const push = (s: BillSuggestion) => {
    if (seen.has(s.key) || covered(s.category, s.amount, s.matchText)) return
    seen.add(s.key)
    out.push(s)
  }
  const byMerchant = new Map<string, Transaction[]>()
  for (const t of txs) {
    if (!isSpend(t)) continue
    const k = merchantKey(t.description)
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), t])
  }
  // Every 12 months: reuse the shared recurring detector.
  for (const r of detectRecurring(txs, today)) {
    if (r.cadence !== 'yearly') continue
    const last = byMerchant.get(r.merchant)?.filter((t) => t.date === r.last).at(-1)
    if (!last) continue
    push({ key: `${r.merchant}-12`, name: label(r.merchant), amount: r.amount, everyMonths: 12, lastPaid: r.last, category: last.category, matchText: r.merchant.toLowerCase(), reason: 'Repeats every 12 months', confirm: false })
  }
  for (const [merchant, list] of byMerchant) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted.at(-1)!
    const amt = Math.abs(latest.amount)
    const same = sorted.filter((t) => Math.abs(Math.abs(t.amount) - amt) <= amt * 0.1)
    const dates = [...new Set(same.map((t) => t.date))]
    // Every 3 or 6 months: consecutive charges that far apart.
    if (dates.length >= 2) {
      const gaps = dates.slice(1).map((d, i) => monthGap(dates[i], d))
      const g = gaps.at(-1)!
      if ((g === 3 || g === 6) && gaps.every((x) => x === g) && daysBetween(latest.date, today) <= (g + 2) * 31) {
        push({ key: `${merchant}-${g}`, name: label(merchant), amount: amt, everyMonths: g, lastPaid: latest.date, category: latest.category, matchText: merchant.toLowerCase(), reason: `Repeats every ${g} months`, confirm: false })
        continue
      }
    }
    // One charge far above its category's monthly budget.
    const cap = limit.get(latest.category)
    // Only categories where lump payments are normal; a card payment or a shopping splurge is not a bill.
    if (cap && cap > 0 && BILL_CATEGORIES.has(latest.category) && amt > cap * 3 && daysBetween(latest.date, today) <= 366) {
      push({ key: `${merchant}-big`, name: label(merchant), amount: amt, everyMonths: 6, lastPaid: latest.date, category: latest.category, matchText: merchant.toLowerCase(), reason: `One charge is ${Math.round(amt / cap)}x the ${latest.category} monthly budget`, confirm: true })
    }
  }
  return out.slice(0, 6)
}

const BILL_CATEGORIES = new Set(['Insurance', 'Utilities', 'Subscriptions', 'Health', 'Education', 'Housing', 'Transport', 'Travel'])

export const monthlySetAside =(bills: Bill[]) => round2(bills.reduce((s, b) => s + monthlyEquivalent(b), 0))

/** "$1,122 every 6 months" */
export function cadenceText(b: Bill, fmt: (n: number) => string) {
  return `${fmt(b.amount)} ${b.everyMonths === 1 ? 'every month' : b.everyMonths === 12 ? 'every year' : `every ${b.everyMonths} months`}`
}
