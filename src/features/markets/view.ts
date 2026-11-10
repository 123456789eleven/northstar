// View-model logic for the Markets tab. Pure: no I/O, no React. Formatting, sorting, tick direction, freshness
// labels, range positions and screen matching all live here so they can be tested without a DOM.
import type { HoldingInput } from './portfolio'

export const MAX_WATCHLIST = 50
export const COMMON_SYMBOLS = ['VTI', 'VOO', 'QQQ'] as const
export const TARGETS_KEY = 'markets.targets'
export const SCREENS_KEY = 'markets.screens'
export const ORDER_KEY = 'markets.order'

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const DASH = '—'

// ---- Formatting -------------------------------------------------------------------------------------------------
export const fmtPrice = (n: number | undefined): string =>
  fin(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n >= 1 ? 2 : 4 }) : DASH
export const fmtMoney = (n: number | undefined): string =>
  fin(n) ? `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : DASH
export const fmtSignedMoney = (n: number | undefined): string =>
  fin(n) ? `${n > 0 ? '+' : n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : DASH
/** Percent figure already in percent units (1.234 -> "+1.23%"). */
export const fmtPct = (pct: number | undefined, signed = true): string => {
  if (!fin(pct)) return DASH
  const r = Math.round(pct * 100) / 100
  return `${signed && r > 0 ? '+' : r < 0 ? '-' : ''}${Math.abs(r).toFixed(2)}%`
}
/** A fraction (0.25) as percent text ("25.0%"). */
export const fmtWeight = (f: number | undefined): string => (fin(f) ? `${(f * 100).toFixed(1)}%` : DASH)
/** Finnhub market cap is in millions of dollars. */
export function fmtMarketCap(millions: number | undefined): string {
  if (!fin(millions) || millions <= 0) return DASH
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`
  if (millions >= 1000) return `$${(millions / 1000).toFixed(1)}B`
  return `$${Math.round(millions)}M`
}
export const fmtRatio = (n: number | undefined, d = 2): string => (fin(n) ? n.toFixed(d) : DASH)
/** Finnhub dividend yield is already in percent units. */
export const fmtYield = (n: number | undefined): string => (fin(n) ? `${n.toFixed(2)}%` : DASH)

export type Direction = 'up' | 'down' | 'flat'
export const direction = (n: number | undefined): Direction => (!fin(n) || n === 0 ? 'flat' : n > 0 ? 'up' : 'down')
/** Tick colour trigger: null when nothing changed (or no previous price). */
export const tickDirection = (prev: number | undefined, next: number | undefined): 'up' | 'down' | null =>
  fin(prev) && fin(next) && prev !== next ? (next > prev ? 'up' : 'down') : null

// ---- Freshness --------------------------------------------------------------------------------------------------
export function ageLabel(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s} s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.floor(h / 24)} d ago`
}

export interface FreshnessInput {
  now: number
  /** Last time a quote was fetched successfully (ms), or undefined when never. */
  fetchedAt?: number
  marketOpen?: boolean
  offline?: boolean
  hasKey: boolean
}
export interface Freshness { label: string; tone: 'live' | 'delayed' | 'closed' | 'offline' | 'none' }
export const DELAYED_AFTER_MS = 90_000

export function freshness(i: FreshnessInput): Freshness {
  if (!i.hasKey) return { label: 'Live prices off', tone: 'none' }
  if (i.offline) return { label: i.fetchedAt ? `Offline, last price ${ageLabel(i.now - i.fetchedAt)}` : 'Offline', tone: 'offline' }
  if (i.fetchedAt === undefined) return { label: 'Waiting for prices', tone: 'none' }
  if (i.marketOpen === false) return { label: 'Market closed', tone: 'closed' }
  const age = i.now - i.fetchedAt
  if (age > DELAYED_AFTER_MS) return { label: `Delayed, ${ageLabel(age)}`, tone: 'delayed' }
  return { label: `Updated ${ageLabel(age)}`, tone: 'live' }
}

/** Seconds left of a rate-limit back-off that started at `startedAt`. */
export function backoffSeconds(retryAfterMs: number | undefined, startedAt: number, now: number): number {
  return Math.max(0, Math.ceil(((retryAfterMs ?? 30_000) - (now - startedAt)) / 1000))
}

// ---- Ranges -----------------------------------------------------------------------------------------------------
/** 0..1 position of `value` within [low, high]; null when the range is unusable. */
export function rangePosition(value: number | undefined, low: number | undefined, high: number | undefined): number | null {
  if (!fin(value) || !fin(low) || !fin(high) || high <= low) return null
  return Math.min(1, Math.max(0, (value - low) / (high - low)))
}

// ---- Sorting ----------------------------------------------------------------------------------------------------
export interface Row {
  symbol: string
  name?: string
  price?: number
  changePct?: number
  low?: number
  high?: number
  week52Low?: number
  week52High?: number
  pe?: number
  dividendYield?: number
  marketCap?: number
}
export type SortKey = 'order' | 'symbol' | 'price' | 'changePct' | 'week52'
export function sortRows<T extends Row>(rows: T[], key: SortKey, dir: 'asc' | 'desc' = 'asc'): T[] {
  if (key === 'order') return rows
  const val = (r: T): number | string | null =>
    key === 'symbol' ? r.symbol : key === 'price' ? (r.price ?? null) : key === 'changePct' ? (r.changePct ?? null) : rangePosition(r.price, r.week52Low, r.week52High)
  const m = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b)
    if (x === null && y === null) return a.symbol.localeCompare(b.symbol)
    if (x === null) return 1 // unknowns always last
    if (y === null) return -1
    return (typeof x === 'string' ? x.localeCompare(y as string) : x - (y as number)) * m
  })
}

/** Applies a saved manual order; symbols not in `order` go last in their given order. */
export function applyOrder<T extends { symbol: string }>(items: T[], order: string[]): T[] {
  const idx = new Map(order.map((s, i) => [s, i]))
  return items.map((it, i) => ({ it, i })).sort((a, b) => (idx.get(a.it.symbol) ?? 1e9 + a.i) - (idx.get(b.it.symbol) ?? 1e9 + b.i)).map((x) => x.it)
}
export function moveSymbol(order: string[], symbol: string, delta: -1 | 1): string[] {
  const i = order.indexOf(symbol), j = i + delta
  if (i < 0 || j < 0 || j >= order.length) return order
  const next = [...order]
  const t = next[i]
  next[i] = next[j]
  next[j] = t
  return next
}

// ---- Alerts -----------------------------------------------------------------------------------------------------
export function alertState(price: number | undefined, above?: number, below?: number): 'above' | 'below' | null {
  if (!fin(price)) return null
  if (fin(above) && above > 0 && price >= above) return 'above'
  if (fin(below) && below > 0 && price <= below) return 'below'
  return null
}
/** Parses an optional price field: '' -> undefined; invalid -> 'invalid'. */
export function parseOptionalPrice(s: string): number | undefined | 'invalid' {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 && n < 1e9 ? n : 'invalid'
}

// ---- Screener ---------------------------------------------------------------------------------------------------
export type CapBucket = 'mega' | 'large' | 'mid' | 'small'
export const CAP_LABEL: Record<CapBucket, string> = { mega: 'Mega (200B+)', large: 'Large (10B to 200B)', mid: 'Mid (2B to 10B)', small: 'Small (under 2B)' }
export const capBucket = (millions: number | undefined): CapBucket | null =>
  !fin(millions) || millions <= 0 ? null : millions >= 200_000 ? 'mega' : millions >= 10_000 ? 'large' : millions >= 2000 ? 'mid' : 'small'

export interface Criteria {
  priceMin?: number; priceMax?: number
  changeMin?: number; changeMax?: number
  /** Position within the 52-week range, in percent (0 = at the low, 100 = at the high). */
  posMin?: number; posMax?: number
  peMin?: number; peMax?: number
  yieldMin?: number
  caps?: CapBucket[]
}
export interface SavedScreen { name: string; criteria: Criteria }

const within = (v: number | undefined, min?: number, max?: number): boolean => {
  if (!fin(min) && !fin(max)) return true
  if (!fin(v)) return false // a criterion on a figure we do not have is not a match
  return (!fin(min) || v >= min) && (!fin(max) || v <= max)
}
export function matchesScreen(r: Row, c: Criteria): boolean {
  const pos = rangePosition(r.price, r.week52Low, r.week52High)
  const cap = capBucket(r.marketCap)
  return (
    within(r.price, c.priceMin, c.priceMax) &&
    within(r.changePct, c.changeMin, c.changeMax) &&
    within(pos === null ? undefined : pos * 100, c.posMin, c.posMax) &&
    within(r.pe, c.peMin, c.peMax) &&
    within(r.dividendYield, c.yieldMin, undefined) &&
    (!c.caps?.length || (cap !== null && c.caps.includes(cap)))
  )
}
export const runScreen = <T extends Row>(rows: T[], c: Criteria): T[] => rows.filter((r) => matchesScreen(r, c))
export const criteriaCount = (c: Criteria): number =>
  [c.priceMin, c.priceMax, c.changeMin, c.changeMax, c.posMin, c.posMax, c.peMin, c.peMax, c.yieldMin].filter(fin).length + (c.caps?.length ? 1 : 0)
/** Parses a numeric criteria field; '' -> undefined, junk -> undefined. */
export function numField(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : undefined
}
/** Defensive read of saved screens from settings. */
export function readScreens(v: unknown): SavedScreen[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is SavedScreen => !!s && typeof s.name === 'string' && !!s.criteria && typeof s.criteria === 'object')
    .map((s) => ({ name: s.name.slice(0, 40), criteria: s.criteria }))
    .slice(0, 20)
}

// ---- Targets ----------------------------------------------------------------------------------------------------
/** Reads `markets.targets` ({ TICKER: fraction }) defensively. */
export function readTargets(v: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [k, n] of Object.entries(v as Record<string, unknown>)) if (fin(n) && n >= 0 && n <= 1) out[k.toUpperCase()] = n
  }
  return out
}
/** "25" or "25%" -> 0.25; '' -> undefined (clear); invalid -> 'invalid'. */
export function parseTargetPct(s: string): number | undefined | 'invalid' {
  const t = s.trim().replace(/%$/, '')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : 'invalid'
}
export const targetsTotal = (t: Record<string, number>): number => Object.values(t).reduce((s, n) => s + n, 0)
/** "+3.2 pts" / "-1.0 pts" for a drift fraction. */
export const fmtDrift = (d: number): string => `${d > 0.0005 ? '+' : d < -0.0005 ? '-' : ''}${Math.abs(d * 100).toFixed(1)} pts`

// ---- Series -----------------------------------------------------------------------------------------------------
/** SVG path for a tiny sparkline. Returns '' for fewer than 2 points. */
export function sparkPath(values: number[], w: number, h: number, pad = 2): string {
  if (values.length < 2) return ''
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  return values.map((v, i) => `${i ? 'L' : 'M'}${(pad + (i / (values.length - 1)) * (w - pad * 2)).toFixed(1)},${(h - pad - ((v - lo) / span) * (h - pad * 2)).toFixed(1)}`).join('')
}

/**
 * Portfolio value per day from recorded closes. Only days on which every held ticker has a bar are used; nothing is
 * filled in. `bars` maps ticker -> date -> close.
 */
export function portfolioSeries(holdings: HoldingInput[], bars: Record<string, Record<string, number>>): { date: string; value: number }[] {
  const shares = new Map<string, number>()
  for (const h of holdings) {
    const t = h.ticker.trim().toUpperCase()
    if (t && fin(h.shares) && h.shares > 0) shares.set(t, (shares.get(t) ?? 0) + h.shares)
  }
  if (!shares.size) return []
  const tickers = [...shares.keys()]
  const dates = new Set<string>()
  for (const t of tickers) for (const d of Object.keys(bars[t] ?? {})) dates.add(d)
  return [...dates]
    .sort()
    .filter((d) => tickers.every((t) => fin(bars[t]?.[d])))
    .map((date) => ({ date, value: tickers.reduce((s, t) => s + shares.get(t)! * bars[t][date], 0) }))
}

/** Local YYYY-MM-DD range for "last 7 days" news. */
export function newsWindow(now: Date, days = 7): { from: string; to: string } {
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const from = new Date(now)
  from.setDate(from.getDate() - days)
  return { from: f(from), to: f(now) }
}

/** Test helper: copy in this tab must never read as advice. */
export const ADVICE_WORDS = /\b(buy|sell|recommend\w*|outperform|underperform)\b/i
export const ADVICE_NOTE = 'Information, not advice.'
