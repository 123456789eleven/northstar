// Paper account data for the Practice tab: trades, start cash, recorded prices and live quotes, merged into one summary.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, logEvent, type PaperTrade } from '../../db'
import { today } from '../../lib/dates'
import { getStartCash } from '../markets/paper'
import { computePaper } from '../markets/paper'
import { useQuotes } from '../markets/hooks'
import { dayChange, equityCurve, fills, lastKnownPrices, tradeStats } from './ledger'

export function usePaper() {
  const trades = useLiveQuery(() => db.paperTrades.toArray(), [])
  const startCash = useLiveQuery(getStartCash, [])
  const bars = useLiveQuery(() => db.priceHistory.toArray(), [])
  const symbols = useMemo(() => [...new Set((trades ?? []).map((t) => t.symbol.toUpperCase()))], [trades])
  const { quotes, error, refresh, loading: quotesLoading } = useQuotes(symbols)
  const loading = trades === undefined || startCash === undefined || bars === undefined

  const model = useMemo(() => {
    if (loading) return null
    const live: Record<string, number> = {}
    for (const [s, q] of Object.entries(quotes)) live[s] = q.price
    const prices = lastKnownPrices(trades, bars, live)
    const summary = computePaper(trades, startCash, prices)
    const curve = equityCurve(trades, startCash, bars, today(), live)
    const allFills = fills(trades, startCash)
    const realizedBySymbol: Record<string, number> = {}
    for (const f of allFills) realizedBySymbol[f.symbol] = (realizedBySymbol[f.symbol] ?? 0) + f.gain
    return {
      trades, startCash, summary, curve, fills: allFills, stats: tradeStats(allFills), realizedBySymbol,
      day: dayChange(curve, summary.equity, today(), startCash),
      total: Math.round((summary.equity - startCash) * 100) / 100,
      live: Object.keys(live).length > 0,
    }
  }, [loading, trades, startCash, bars, quotes])

  return { model, loading, quotesError: error, refreshQuotes: refresh, quotesLoading }
}

/** Removes one paper trade and its timeline event together. */
export const removeTrade = (id: number) =>
  db.transaction('rw', db.paperTrades, db.events, async () => {
    await db.paperTrades.delete(id)
    await db.events.filter((e) => e.refTable === 'paperTrades' && e.refId === id).delete()
  })

/** Saves a trade's timeline event. The title carries the side and symbol only, never a note. */
export const logTradeEvent = (t: Pick<PaperTrade, 'side' | 'symbol'>, id: number) =>
  logEvent({ area: 'finance', kind: 'markets.paper-trade', title: `Paper ${t.side === 'buy' ? 'buy' : 'sell'} ${t.symbol}`, refTable: 'paperTrades', refId: id })

/** Clears the account. Returns a restore function for Undo. */
export async function resetAccount(): Promise<() => Promise<void>> {
  const [rows, evs] = await Promise.all([db.paperTrades.toArray(), db.events.filter((e) => e.refTable === 'paperTrades').toArray()])
  await db.transaction('rw', db.paperTrades, db.events, async () => {
    await db.paperTrades.clear()
    await db.events.bulkDelete(evs.map((e) => e.id as number))
  })
  await logEvent({ area: 'finance', kind: 'markets.paper-reset', title: 'Reset paper account' })
  return async () => {
    await db.transaction('rw', db.paperTrades, db.events, async () => {
      await db.paperTrades.bulkAdd(rows)
      await db.events.bulkAdd(evs)
      await db.events.filter((e) => e.kind === 'markets.paper-reset').delete()
    })
  }
}
