// Shared finance data hooks + aggregations.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db, type BalanceSnapshot, type Transaction } from '../../db'
import { allRules, isIncome, isSpending, merchantKey, RULES_KEY, type Rule } from './categories'

export interface ImportRecord {
  id: string
  at: string
  file: string
  added: number
  skipped: number
  errors: number
}
export const IMPORTS_KEY = 'finance.imports'

const NO_RULES: Rule[] = []

export function useUserRules(): Rule[] {
  return useLiveQuery(async () => (await db.settings.get(RULES_KEY))?.value as Rule[] | undefined, []) ?? NO_RULES
}

export function useRules() {
  const user = useUserRules()
  return useMemo(() => ({ user, all: allRules(user) }), [user])
}

const NO_IMPORTS: ImportRecord[] = []

export function useImports(): ImportRecord[] {
  return useLiveQuery(async () => (await db.settings.get(IMPORTS_KEY))?.value as ImportRecord[] | undefined, []) ?? NO_IMPORTS
}

/** YYYY-MM arithmetic. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string, short = false) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, short ? { month: 'short' } : { month: 'long', year: 'numeric' })
}

export function monthRange(month: string): [string, string] {
  return [`${month}-01`, `${month}-31`]
}

export function useMonthTx(month: string) {
  const [a, b] = monthRange(month)
  return useLiveQuery(() => db.transactions.where('date').between(a, b, true, true).toArray(), [a, b])
}

export interface MonthSummary {
  income: number
  spending: number
  net: number
  savingsRate: number | null
  byCategory: Map<string, number>
}

export function summarize(txs: Transaction[]): MonthSummary {
  let income = 0
  let spending = 0
  const byCategory = new Map<string, number>()
  for (const t of txs) {
    if (isIncome(t)) income += t.amount
    else if (isSpending(t)) {
      spending -= t.amount
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) - t.amount)
    }
  }
  const net = income - spending
  return { income, spending, net, savingsRate: income > 0 ? net / income : null, byCategory }
}

export function topMerchants(txs: Transaction[], n = 6) {
  const m = new Map<string, { total: number; count: number }>()
  for (const t of txs) {
    if (!isSpending(t) || t.amount >= 0) continue
    const k = merchantKey(t.description)
    const cur = m.get(k) ?? { total: 0, count: 0 }
    cur.total -= t.amount
    cur.count++
    m.set(k, cur)
  }
  return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, n)
}

/** Net worth after each snapshot date, carrying each account's latest balance forward. */
export function netWorthSeries(snaps: BalanceSnapshot[]) {
  const sorted = [...snaps].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  const latest = new Map<string, BalanceSnapshot>()
  const out: { date: string; assets: number; liabilities: number; net: number }[] = []
  for (let i = 0; i < sorted.length; i++) {
    latest.set(sorted[i].name, sorted[i])
    if (i + 1 < sorted.length && sorted[i + 1].date === sorted[i].date) continue
    let assets = 0
    let liabilities = 0
    for (const s of latest.values()) {
      if (s.kind === 'asset') assets += s.balance
      else liabilities += s.balance
    }
    out.push({ date: sorted[i].date, assets, liabilities, net: assets - liabilities })
  }
  return out
}

export const pct = (n: number) => `${Math.round(n * 100)}%`

export const compactMoney = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', notation: Math.abs(n) >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 0 })

/** Always two decimals, so amounts in a column line up ($1,380.00, not $1,380). */
export const moneyExact = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
