// Pure calculators for the Practice tools. Arithmetic on the numbers you enter; not a forecast and not advice.
import { round2 } from '../markets/portfolio'

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/** Parses a plain number field ("1,250" is fine). Empty or non-numeric is an error with a plain message. */
export function parseNum(raw: string, label: string, opts: { min?: number; max?: number; positive?: boolean } = {}): Parsed<number> {
  const s = raw.replace(/[,$\s]/g, '')
  if (!s) return { ok: false, error: `Enter ${label.toLowerCase()}.` }
  const n = Number(s)
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a number.` }
  if (opts.positive && n <= 0) return { ok: false, error: `${label} must be more than zero.` }
  if (opts.min !== undefined && n < opts.min) return { ok: false, error: `${label} must be at least ${opts.min}.` }
  if (opts.max !== undefined && n > opts.max) return { ok: false, error: `${label} must be at most ${opts.max}.` }
  return { ok: true, value: n }
}

export interface PositionSize { direction: 'long' | 'short'; riskPerShare: number; dollarRisk: number; shares: number; wholeShares: number; positionValue: number; pctOfAccount: number; exceedsAccount: boolean }

export function positionSize(i: { account: number; riskPct: number; entry: number; stop: number }): Parsed<PositionSize> {
  const { account, riskPct, entry, stop } = i
  if (![account, riskPct, entry, stop].every(Number.isFinite)) return { ok: false, error: 'Fill in every field with a number.' }
  if (account <= 0) return { ok: false, error: 'Account size must be more than zero.' }
  if (riskPct <= 0 || riskPct > 100) return { ok: false, error: 'Risk per trade must be between 0 and 100 percent.' }
  if (entry <= 0 || stop <= 0) return { ok: false, error: 'Entry and stop must be more than zero.' }
  if (entry === stop) return { ok: false, error: 'Stop must differ from entry, or there is no defined risk.' }
  const riskPerShare = Math.abs(entry - stop)
  const dollarRisk = (account * riskPct) / 100
  const shares = dollarRisk / riskPerShare
  const positionValue = shares * entry
  return {
    ok: true,
    value: {
      direction: stop < entry ? 'long' : 'short', riskPerShare: round2(riskPerShare), dollarRisk: round2(dollarRisk),
      shares: Math.round(shares * 1e4) / 1e4, wholeShares: Math.floor(shares), positionValue: round2(positionValue),
      pctOfAccount: (positionValue / account) * 100, exceedsAccount: positionValue > account,
    },
  }
}

export function parsePrices(raw: string): Parsed<number[]> {
  const parts = raw.split(/[\s,;]+/).filter(Boolean)
  if (parts.length < 2) return { ok: false, error: 'Enter at least two prices, separated by commas.' }
  if (parts.length > 600) return { ok: false, error: 'Use 600 prices or fewer.' }
  const nums = parts.map((p) => Number(p.replace(/^\$/, '')))
  const bad = nums.findIndex((n) => !Number.isFinite(n) || n <= 0)
  return bad >= 0 ? { ok: false, error: `Price ${bad + 1} (${parts[bad]}) is not a number above zero.` } : { ok: true, value: nums }
}

export interface DcaResult { invested: number; shares: number; avgCost: number; finalValue: number; gain: number; gainPct: number; lumpShares: number; lumpValue: number; lumpGain: number }

/** Invest `amount` at each price in turn, versus putting the same total in at the first price. Value is taken at the last price. */
export function dca(amount: number, prices: number[]): Parsed<DcaResult> {
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: 'Amount per period must be more than zero.' }
  if (prices.length < 2 || prices.some((p) => !Number.isFinite(p) || p <= 0)) return { ok: false, error: 'Enter at least two prices above zero.' }
  const shares = prices.reduce((n, p) => n + amount / p, 0)
  const invested = amount * prices.length
  const last = prices[prices.length - 1]
  const finalValue = shares * last
  const lumpShares = invested / prices[0]
  const lumpValue = lumpShares * last
  return {
    ok: true,
    value: {
      invested: round2(invested), shares: Math.round(shares * 1e4) / 1e4, avgCost: round2(invested / shares), finalValue: round2(finalValue),
      gain: round2(finalValue - invested), gainPct: ((finalValue - invested) / invested) * 100,
      lumpShares: Math.round(lumpShares * 1e4) / 1e4, lumpValue: round2(lumpValue), lumpGain: round2(lumpValue - invested),
    },
  }
}

type Pt = { month: number; balance: number; contributed: number }
const yearEnds = <T extends { month: number }>(pts: T[]) => pts.filter((p) => p.month % 12 === 0 || p.month === pts[pts.length - 1].month)
const yr = (m: number) => Math.round((m / 12) * 10) / 10

/** Rows for the contributions-versus-growth split (the start plus each year end). */
export function splitRows(points: Pt[]) {
  return yearEnds(points).map((p) => ({ year: yr(p.month), contributed: p.contributed, growth: round2(Math.max(0, p.balance - p.contributed)), balance: p.balance }))
}

/** Rows for the low / middle / high band chart. */
export function bandRows(low: Pt[], base: Pt[], high: Pt[]) {
  return yearEnds(base).map((p) => ({
    year: yr(p.month), base: p.balance, low: low.find((x) => x.month === p.month)?.balance ?? p.balance, high: high.find((x) => x.month === p.month)?.balance ?? p.balance,
  }))
}
