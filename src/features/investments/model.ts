// Pure investment math. Dates are local YYYY-MM-DD strings. No DB access.
import type { BalanceSnapshot, Contribution, Holding, ISODate } from '../../db'
import { daysBetween } from '../../lib/dates'

export const STALE_DAYS = 7
export const DEFAULT_IRA_LIMIT = 7500

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d
export const round2 = (n: number) => round(n, 2)

/** Shares implied by a balance and a price, rounded to 3 decimals; null when either is unusable. */
export function sharesFromBalance(balance: number, price: number): number | null {
  if (!Number.isFinite(balance) || !Number.isFinite(price) || balance < 0 || price <= 0) return null
  return round(balance / price, 3)
}

export const holdingValue = (h: Pick<Holding, 'shares' | 'price'>): number | null =>
  h.shares != null && h.price != null ? round2(h.shares * h.price) : null

/** Gain/loss vs cost basis; null unless value and a positive cost basis are known. */
export function holdingGain(h: Pick<Holding, 'shares' | 'price' | 'costBasis'>): { amount: number; pct: number } | null {
  const v = holdingValue(h)
  if (v == null || h.costBasis == null || h.costBasis <= 0) return null
  return { amount: round2(v - h.costBasis), pct: round((v - h.costBasis) / h.costBasis, 4) }
}

export function priceAgeDays(priceDate: ISODate | undefined, now: ISODate): number | null {
  return priceDate ? daysBetween(priceDate, now) : null
}
export const isStale = (priceDate: ISODate | undefined, now: ISODate): boolean => {
  const a = priceAgeDays(priceDate, now)
  return a == null || a > STALE_DAYS
}

/** Contributions in a calendar year (withdrawals do not reduce IRA room). Omit account for all. */
export function ytdContributions(rows: Contribution[], year: number, account?: string): number {
  let sum = 0
  for (const c of rows) {
    if (account != null && c.account !== account) continue
    if (c.date.slice(0, 4) !== String(year)) continue
    if (c.kind === 'contribution') sum += c.amount
  }
  return round2(sum)
}

/** Lifetime net contributed (contributions minus withdrawals). */
export function contributedToDate(rows: Contribution[], account: string, upTo?: ISODate): number {
  let sum = 0
  for (const c of rows) {
    if (c.account !== account || (upTo && c.date > upTo)) continue
    sum += c.kind === 'withdrawal' ? -c.amount : c.amount
  }
  return round2(sum)
}

export const remainingRoom = (limit: number, contributed: number) => Math.max(0, round2(limit - contributed))

/** Calendar months left in the year including the current one (Nov 1 -> 2, Dec 31 -> 1). */
export function monthsLeft(now: ISODate): number {
  return 12 - Number(now.slice(5, 7)) + 1
}

/** Even monthly amount to reach the limit by Dec 31, counting the current month. 0 when already maxed. */
export function monthlyToMax(limit: number, contributed: number, now: ISODate): number {
  const room = remainingRoom(limit, contributed)
  return room === 0 ? 0 : Math.ceil((room / monthsLeft(now)) * 100) / 100
}

export interface ImportCandidate { key: string; date: ISODate; amount: number; description: string }

const IRA_RE = /roth|ira|schwab/i
/** Negative transactions that look like IRA funding and are not already recorded (same date and amount). */
export function importCandidates(
  txns: { id?: number; date: ISODate; amount: number; description: string }[],
  recorded: Contribution[],
): ImportCandidate[] {
  const have = new Set(recorded.map((c) => `${c.date}|${round2(c.amount)}`))
  return txns
    .filter((t) => t.amount < 0 && IRA_RE.test(t.description) && !have.has(`${t.date}|${round2(-t.amount)}`))
    .map((t) => ({ key: String(t.id ?? `${t.date}|${t.amount}|${t.description}`), date: t.date, amount: round2(-t.amount), description: t.description }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** Allocation shares (0-1) by value; holdings without a value are skipped. */
export function allocation(hs: Holding[]): { ticker: string; value: number; share: number }[] {
  const byTicker = new Map<string, number>()
  for (const h of hs) {
    const v = holdingValue(h)
    if (v != null && v > 0) byTicker.set(h.ticker, (byTicker.get(h.ticker) ?? 0) + v)
  }
  const total = [...byTicker.values()].reduce((a, b) => a + b, 0)
  return [...byTicker].map(([ticker, value]) => ({ ticker, value, share: total ? value / total : 0 })).sort((a, b) => b.value - a.value)
}

/** One point per month (last snapshot of that month) for an account. */
export function monthlySeries(snaps: BalanceSnapshot[], account: string): { date: ISODate; value: number }[] {
  const byMonth = new Map<string, BalanceSnapshot>()
  for (const s of snaps.filter((x) => x.name === account).sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) byMonth.set(s.date.slice(0, 7), s)
  return [...byMonth.values()].map((s) => ({ date: s.date, value: s.balance }))
}

/** Hypothetical only: value after `years` of monthly contributions at a user-typed annual rate (%). */
export function whatIf(start: number, monthly: number, annualPct: number, years: number): number {
  const r = annualPct / 100 / 12
  let v = start
  for (let i = 0; i < Math.round(years * 12); i++) v = v * (1 + r) + monthly
  return round2(v)
}
