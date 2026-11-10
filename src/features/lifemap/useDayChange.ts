// Portfolio day change for the map. One shared quote subscription (this hook is used once, in the Home page, so it only runs
// while the map is mounted and visible). With no Finnhub key the symbol list is empty, so no request is ever made.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { useFinnhubKey, useQuotes } from '../markets/hooks'
import { normalizeSymbol } from '../markets/finnhub'
import { summarize } from '../markets/portfolio'

export interface DayChange { amount: number; pct: number; value: number; asOf: number }

export function useDayChange(): DayChange | null {
  const { hasKey } = useFinnhubKey()
  const holdings = useLiveQuery(() => db.holdings.toArray(), [])
  const tickers = useMemo(() => hasKey ? [...new Set((holdings ?? []).map((h) => normalizeSymbol(h.ticker)).filter((s): s is string => !!s))] : [], [hasKey, holdings])
  const { quotes } = useQuotes(tickers)
  return useMemo(() => {
    if (!hasKey || !holdings) return null
    const prices: Record<string, number> = {}
    const prev: Record<string, number> = {}
    let asOf = 0
    for (const [s, q] of Object.entries(quotes)) { prices[s] = q.price; prev[s] = q.prevClose; asOf = Math.max(asOf, q.fetchedAt, q.live ? q.time : 0) }
    if (!asOf) return null
    const sum = summarize(holdings.map((h) => ({ ticker: h.ticker, shares: h.shares, price: h.price, costBasis: h.costBasis })), prices, prev)
    return sum.positions.length ? { amount: sum.dayChange, pct: sum.dayChangePct, value: sum.totalValue, asOf } : null
  }, [hasKey, holdings, quotes])
}

export function freshness(asOf: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - asOf) / 1000))
  if (s < 60) return 'updated just now'
  const m = Math.round(s / 60)
  return m < 60 ? `updated ${m} min ago` : `updated ${Math.round(m / 60)} h ago`
}
