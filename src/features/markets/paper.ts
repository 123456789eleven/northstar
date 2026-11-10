// Paper trading: simulated trades only. Pure position math, plus small DB helpers. Nothing here talks to a broker.
import { db, getSetting, setSetting, type PaperTrade } from '../../db'
import { round2 } from './portfolio'

export const START_CASH_KEY = 'paper.startCash'
export const DEFAULT_START_CASH = 100_000
const QTY_DP = 1e6
const roundQty = (n: number) => Math.round(n * QTY_DP) / QTY_DP

export interface PaperPosition { symbol: string; qty: number; avgCost: number; realized: number }
export interface PaperState { cash: number; positions: Map<string, PaperPosition>; realized: number }

export const emptyState = (startCash: number): PaperState => ({ cash: round2(startCash), positions: new Map(), realized: 0 })

/** Returns a plain-language reason the trade cannot be made, or null when it is fine. */
export function checkTrade(state: PaperState, t: Pick<PaperTrade, 'symbol' | 'side' | 'qty' | 'price'>): string | null {
  if (!t.symbol.trim()) return 'Enter a symbol.'
  if (!Number.isFinite(t.qty) || t.qty <= 0) return 'Quantity must be more than zero.'
  if (!Number.isFinite(t.price) || t.price <= 0) return 'Price must be more than zero.'
  const pos = state.positions.get(t.symbol)
  if (t.side === 'sell') return !pos || roundQty(pos.qty) < roundQty(t.qty) ? `You only hold ${pos ? roundQty(pos.qty) : 0} of ${t.symbol} in this account.` : null
  return round2(t.qty * t.price) > state.cash + 0.001 ? 'Not enough paper cash for that buy.' : null
}

/** Applies one trade (weighted-average cost). Throws on an invalid trade; call checkTrade first for the message. */
export function applyTrade(state: PaperState, t: Pick<PaperTrade, 'symbol' | 'side' | 'qty' | 'price'>): PaperState {
  const why = checkTrade(state, t)
  if (why) throw new Error(why)
  const positions = new Map(state.positions)
  const gross = round2(t.qty * t.price)
  const pos = positions.get(t.symbol) ?? { symbol: t.symbol, qty: 0, avgCost: 0, realized: 0 }
  if (t.side === 'buy') {
    const qty = roundQty(pos.qty + t.qty)
    positions.set(t.symbol, { ...pos, qty, avgCost: (pos.qty * pos.avgCost + t.qty * t.price) / qty })
    return { ...state, cash: round2(state.cash - gross), positions }
  }
  const gain = round2((t.price - pos.avgCost) * t.qty)
  const qty = roundQty(pos.qty - t.qty)
  if (qty === 0) positions.delete(t.symbol)
  else positions.set(t.symbol, { ...pos, qty })
  // Keep realized P/L per symbol even after the position closes.
  return { cash: round2(state.cash + gross), positions, realized: round2(state.realized + gain) }
}

export interface PaperSummary {
  cash: number
  positions: (PaperPosition & { price?: number; value?: number; unrealized?: number })[]
  realized: number
  unrealized: number
  equity: number
  /** Trades that could not be replayed (for example a back-dated sell with nothing held yet). */
  skipped: PaperTrade[]
}

/** Replays trades in date order (then id) and values open positions at `prices` (falls back to average cost). */
export function computePaper(trades: PaperTrade[], startCash: number, prices: Record<string, number> = {}): PaperSummary {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  let state = emptyState(startCash)
  const skipped: PaperTrade[] = []
  for (const t of ordered) {
    try {
      state = applyTrade(state, { ...t, symbol: t.symbol.toUpperCase() })
    } catch {
      skipped.push(t)
    }
  }
  let unrealized = 0, held = 0
  const positions = [...state.positions.values()]
    .map((p) => {
      const price = prices[p.symbol]
      const ok = typeof price === 'number' && Number.isFinite(price) && price > 0
      const value = round2(p.qty * (ok ? price : p.avgCost))
      const u = ok ? round2((price - p.avgCost) * p.qty) : 0
      unrealized += u
      held += value
      return { ...p, avgCost: round2(p.avgCost), price: ok ? price : undefined, value, unrealized: u }
    })
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return { cash: state.cash, positions, realized: state.realized, unrealized: round2(unrealized), equity: round2(state.cash + held), skipped }
}

export const getStartCash = async () => {
  const v = await getSetting<number>(START_CASH_KEY, DEFAULT_START_CASH)
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_START_CASH
}
export const setStartCash = (n: number) => setSetting(START_CASH_KEY, n)

/** Validates against the stored history, then saves. Resolves with an error message or the new id. */
export async function addPaperTrade(t: Omit<PaperTrade, 'id'>): Promise<{ ok: true; id: number } | { ok: false; reason: string }> {
  const symbol = t.symbol.trim().toUpperCase()
  return db.transaction('rw', db.paperTrades, db.settings, async () => {
    const all = await db.paperTrades.toArray()
    const next = { ...t, symbol }
    // Replay with the new trade included so a back-dated trade cannot break a later one.
    const sim = computePaper([...all, { ...next, id: Number.MAX_SAFE_INTEGER }], await getStartCash())
    const bad = sim.skipped.find((s) => s.id === Number.MAX_SAFE_INTEGER) ?? sim.skipped[0]
    if (bad) {
      const before = replay(all.filter((x) => x.date <= next.date), await getStartCash())
      return { ok: false as const, reason: checkTrade(before, next) ?? 'That trade would break a later trade in your history.' }
    }
    const id = (await db.paperTrades.add(next)) as number
    return { ok: true as const, id }
  })
}

function replay(trades: PaperTrade[], startCash: number): PaperState {
  let s = emptyState(startCash)
  for (const t of [...trades].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))) {
    try { s = applyTrade(s, t) } catch { /* skipped */ }
  }
  return s
}

export const deletePaperTrade = (id: number) => db.paperTrades.delete(id)
