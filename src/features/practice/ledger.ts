// Pure paper-account maths for the Practice tab: realized fills, equity curve, day change, undo safety, trade stats.
import type { PaperTrade, PriceBar } from '../../db'
import { applyTrade, computePaper, emptyState, type PaperState } from '../markets/paper'
import { round2 } from '../markets/portfolio'

const order = (trades: PaperTrade[]) => [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
const norm = (t: PaperTrade): PaperTrade => ({ ...t, symbol: t.symbol.toUpperCase() })

export interface Fill { tradeId?: number; symbol: string; date: string; qty: number; price: number; avgCost: number; gain: number; gainPct: number }

/** One row per sell that could be replayed: what it realized against the average cost at that moment. */
export function fills(trades: PaperTrade[], startCash: number): Fill[] {
  let s: PaperState = emptyState(startCash)
  const out: Fill[] = []
  for (const raw of order(trades)) {
    const t = norm(raw)
    try {
      const avg = s.positions.get(t.symbol)?.avgCost ?? 0
      s = applyTrade(s, t)
      if (t.side === 'sell') {
        const gain = round2((t.price - avg) * t.qty)
        out.push({ tradeId: t.id, symbol: t.symbol, date: t.date, qty: t.qty, price: t.price, avgCost: avg, gain, gainPct: avg ? ((t.price - avg) / avg) * 100 : 0 })
      }
    } catch { /* skipped trades are reported by computePaper */ }
  }
  return out
}

export interface TradeStats { count: number; wins: number; losses: number; winRate: number | null; avgWin: number | null; avgLoss: number | null; best: Fill | null; worst: Fill | null; net: number; payoff: number | null }

export function tradeStats(f: Fill[]): TradeStats {
  const wins = f.filter((x) => x.gain > 0), losses = f.filter((x) => x.gain < 0)
  const mean = (a: Fill[]) => (a.length ? round2(a.reduce((n, x) => n + x.gain, 0) / a.length) : null)
  const avgWin = mean(wins), avgLoss = mean(losses)
  const decided = wins.length + losses.length
  return {
    count: f.length, wins: wins.length, losses: losses.length,
    winRate: decided ? wins.length / decided : null,
    avgWin, avgLoss,
    best: f.length ? f.reduce((a, b) => (b.gain > a.gain ? b : a)) : null,
    worst: f.length ? f.reduce((a, b) => (b.gain < a.gain ? b : a)) : null,
    net: round2(f.reduce((n, x) => n + x.gain, 0)),
    payoff: avgWin !== null && avgLoss !== null && avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : null,
  }
}

/** Price for each symbol: live quote, else the latest recorded close, else the latest trade price. */
export function lastKnownPrices(trades: PaperTrade[], bars: PriceBar[], quotes: Record<string, number> = {}): Record<string, number> {
  const out: Record<string, number> = {}
  for (const t of order(trades)) if (t.price > 0) out[t.symbol.toUpperCase()] = t.price
  const latest: Record<string, string> = {}
  for (const b of bars) {
    if (b.close > 0 && (!latest[b.symbol] || b.date >= latest[b.symbol])) { out[b.symbol] = b.close; latest[b.symbol] = b.date }
  }
  for (const [s, p] of Object.entries(quotes)) if (Number.isFinite(p) && p > 0) out[s.toUpperCase()] = p
  return out
}

export interface EquityPoint { date: string; equity: number }

/**
 * Equity at the end of each day that has a trade or a recorded price, from the first trade to `through`.
 * A symbol is valued at its latest recorded close on or before that day, else its latest trade price. Never invented.
 */
export function equityCurve(trades: PaperTrade[], startCash: number, bars: PriceBar[], through: string, live: Record<string, number> = {}): EquityPoint[] {
  const ts = order(trades)
  if (!ts.length) return []
  const first = ts[0].date
  const dates = new Set<string>(ts.map((t) => t.date))
  for (const b of bars) if (b.date >= first && b.date <= through) dates.add(b.date)
  dates.add(through)
  const sorted = [...dates].filter((d) => d >= first && d <= through).sort()
  const bySym = new Map<string, PriceBar[]>()
  for (const b of bars) bySym.set(b.symbol, [...(bySym.get(b.symbol) ?? []), b])
  for (const a of bySym.values()) a.sort((x, y) => x.date.localeCompare(y.date))
  return sorted.map((date) => {
    const upto = ts.filter((t) => t.date <= date)
    const prices: Record<string, number> = {}
    for (const t of upto) prices[t.symbol.toUpperCase()] = t.price
    for (const [sym, arr] of bySym) {
      let c: number | undefined
      for (const b of arr) { if (b.date <= date) c = b.close; else break }
      if (c) prices[sym] = c
    }
    if (date === through) Object.assign(prices, live)
    return { date, equity: computePaper(upto, startCash, prices).equity }
  })
}

/** Equity now minus equity at the end of the previous recorded day (the start cash when nothing came before today). */
export function dayChange(curve: EquityPoint[], equityNow: number, today: string, startCash: number): number {
  const prev = [...curve].reverse().find((p) => p.date < today)
  return round2(equityNow - (prev ? prev.equity : startCash))
}

/** True when removing this trade leaves every other trade valid (no oversell, no negative cash). */
export function canRemoveTrade(trades: PaperTrade[], id: number, startCash: number): boolean {
  const before = computePaper(trades, startCash).skipped
  const after = computePaper(trades.filter((t) => t.id !== id), startCash).skipped
  return after.length <= before.filter((t) => t.id !== id).length
}
