// Portfolio math from holdings (shares x price, total cost basis). Pure: no I/O. All money rounded to cents.
export const round2 = (n: number) => Math.round((n + Number.EPSILON * Math.sign(n)) * 100) / 100

export interface HoldingInput { ticker: string; shares?: number; price?: number; costBasis?: number }
export interface Position {
  ticker: string
  shares: number
  price: number
  value: number
  /** Total cost basis, when every lot of this ticker has one. */
  costBasis?: number
  unrealized?: number
  unrealizedPct?: number
  dayChange?: number
  weight: number
}
export interface PortfolioSummary {
  positions: Position[]
  totalValue: number
  /** Cost basis of the positions that have one, and the matching value (so P/L compares like with like). */
  costBasis: number
  valueWithBasis: number
  unrealized: number
  unrealizedPct: number
  dayChange: number
  dayChangePct: number
}

const fin = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)

/**
 * `prices`: latest price per ticker (overrides a holding's saved price). `prevClose`: previous close per ticker,
 * for the day change. Holdings of the same ticker (across accounts) are combined. Holdings with no usable
 * shares or price are left out.
 */
export function summarize(holdings: HoldingInput[], prices: Record<string, number> = {}, prevClose: Record<string, number> = {}): PortfolioSummary {
  const by = new Map<string, { shares: number; price: number; cost: number; hasCost: boolean; allCost: boolean }>()
  for (const h of holdings) {
    const t = h.ticker.trim().toUpperCase()
    const price = fin(prices[t]) ? prices[t] : h.price
    if (!t || !fin(h.shares) || h.shares <= 0 || !fin(price) || price < 0) continue
    const e = by.get(t) ?? { shares: 0, price, cost: 0, hasCost: false, allCost: true }
    e.shares += h.shares
    e.price = price
    if (fin(h.costBasis)) { e.cost += h.costBasis; e.hasCost = true } else e.allCost = false
    by.set(t, e)
  }
  const raw = [...by.entries()].map(([ticker, e]) => ({ ticker, ...e, value: e.shares * e.price }))
  const total = raw.reduce((s, r) => s + r.value, 0)
  let basis = 0, withBasis = 0, day = 0, dayBase = 0
  const positions: Position[] = raw
    .map((r) => {
      const known = r.hasCost && r.allCost
      const p: Position = { ticker: r.ticker, shares: r.shares, price: r.price, value: round2(r.value), weight: total > 0 ? r.value / total : 0 }
      if (known) {
        p.costBasis = round2(r.cost)
        p.unrealized = round2(r.value - r.cost)
        p.unrealizedPct = r.cost > 0 ? (r.value - r.cost) / r.cost : undefined as never
        basis += r.cost
        withBasis += r.value
      }
      const pc = prevClose[r.ticker]
      if (fin(pc) && pc > 0) {
        p.dayChange = round2((r.price - pc) * r.shares)
        day += (r.price - pc) * r.shares
        dayBase += pc * r.shares
      }
      return p
    })
    .sort((a, b) => b.value - a.value)
  return {
    positions,
    totalValue: round2(total),
    costBasis: round2(basis),
    valueWithBasis: round2(withBasis),
    unrealized: round2(withBasis - basis),
    unrealizedPct: basis > 0 ? (withBasis - basis) / basis : 0,
    dayChange: round2(day),
    dayChangePct: dayBase > 0 ? day / dayBase : 0,
  }
}

/** Allocation by ticker, largest first. Weights are fractions that sum to 1 (or all 0 when empty). */
export const allocation = (positions: Position[]) => positions.map((p) => ({ ticker: p.ticker, value: p.value, weight: p.weight })).sort((a, b) => b.value - a.value)

export interface Drift { ticker: string; weight: number; target: number; drift: number }
/** Weight minus target weight (fractions, 0.25 = 25%). Includes targets not held (weight 0) and holdings with no target (target 0). */
export function weightDrift(positions: Position[], targets: Record<string, number>): Drift[] {
  const w = new Map(positions.map((p) => [p.ticker, p.weight]))
  const tickers = new Set([...w.keys(), ...Object.keys(targets).map((t) => t.toUpperCase())])
  const norm = Object.fromEntries(Object.entries(targets).map(([k, v]) => [k.toUpperCase(), v]))
  return [...tickers]
    .map((ticker) => {
      const weight = w.get(ticker) ?? 0
      const target = fin(norm[ticker]) ? norm[ticker] : 0
      return { ticker, weight, target, drift: weight - target }
    })
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift))
}

/** Splits today's value into what you put in and what it grew. Withdrawals reduce the amount put in. */
export function contributionVsGrowth(contributions: { amount: number; kind: 'contribution' | 'withdrawal' }[], value: number) {
  const contributed = round2(contributions.reduce((s, c) => s + (c.kind === 'withdrawal' ? -c.amount : c.amount), 0))
  const growth = round2(value - contributed)
  return { contributed, growth, value: round2(value), growthPct: contributed > 0 ? growth / contributed : 0 }
}
