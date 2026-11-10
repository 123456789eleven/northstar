// Gathers everything the Markets tab shows: watchlist, holdings, live quotes, saved closes, company info and settings.
// Only the exports of this folder and the existing Dexie tables are used. Symbols are the only thing sent out.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting, type Holding, type WatchlistItem } from '../../db'
import { finnhub, MarketError, normalizeSymbol, type Metrics, type Profile } from './finnhub'
import { useFinnhubKey, useMarketStatus, useQuotes, type LiveQuote } from './hooks'
import { summarize } from './portfolio'
import { applyOrder, ORDER_KEY, portfolioSeries, readScreens, readTargets, SCREENS_KEY, TARGETS_KEY, type Row, type SavedScreen } from './view'

export interface Info { profile?: Profile; metrics?: Metrics }
export interface WatchRow extends Row {
  item: WatchlistItem
  quote?: LiveQuote
  info?: Info
  /** True when the price shown is a saved close rather than a live quote. */
  stored: boolean
  exchange?: string
  industry?: string
  beta?: number
  eps?: number
}

const CUTOFF_DAYS = 400

export function useMarketsData() {
  const key = useFinnhubKey()
  const watchlist = useLiveQuery(() => db.watchlist.toArray(), [])
  const holdings = useLiveQuery(() => db.holdings.toArray(), [])
  const contributions = useLiveQuery(() => db.contributions.toArray(), [])
  const bars = useLiveQuery(async () => {
    const d = new Date()
    d.setDate(d.getDate() - CUTOFF_DAYS)
    const from = d.toISOString().slice(0, 10)
    return (await db.priceHistory.toArray()).filter((b) => b.date >= from)
  }, [])
  const settings = useLiveQuery(async () => {
    const [t, o, s] = await db.settings.bulkGet([TARGETS_KEY, ORDER_KEY, SCREENS_KEY])
    return { targets: readTargets(t?.value), order: Array.isArray(o?.value) ? (o!.value as unknown[]).filter((x): x is string => typeof x === 'string') : [], screens: readScreens(s?.value) }
  }, [])

  const heldTickers = useMemo(() => [...new Set((holdings ?? []).map((h) => normalizeSymbol(h.ticker)).filter((s): s is string => !!s))], [holdings])
  const watchSymbols = useMemo(() => (watchlist ?? []).map((w) => w.symbol), [watchlist])
  const symbols = useMemo(() => [...new Set([...watchSymbols, ...heldTickers])], [watchSymbols, heldTickers])

  const { quotes, loading, error, refresh } = useQuotes(symbols)
  const { status, error: statusError } = useMarketStatus()

  // Company info: one profile + one metrics call per watchlist symbol, cached by the client (24 h / 1 h). Sequential so
  // quotes stay ahead in the shared queue. Stops at the first account-level failure.
  const [info, setInfo] = useState<Record<string, Info>>({})
  const asked = useRef(new Set<string>())
  const infoKey = watchSymbols.join(',')
  useEffect(() => {
    if (!key.hasKey || !watchSymbols.length) return
    let stopped = false
    void (async () => {
      for (const s of watchSymbols) {
        if (stopped) return
        if (asked.current.has(s)) continue
        asked.current.add(s)
        const next: Info = {}
        try {
          next.profile = await finnhub.getProfile(s)
          next.metrics = await finnhub.getMetrics(s)
        } catch (e) {
          if (e instanceof MarketError && ['InvalidKey', 'RateLimited', 'Offline'].includes(e.code)) { asked.current.delete(s); return }
        }
        if (!stopped) setInfo((p) => ({ ...p, [s]: { ...p[s], ...next } }))
      }
    })()
    return () => { stopped = true }
  }, [key.hasKey, infoKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!key.hasKey) asked.current.clear() }, [key.hasKey])

  const lastClose = useMemo(() => {
    const m: Record<string, number> = {}
    const at: Record<string, string> = {}
    for (const b of bars ?? []) if (!at[b.symbol] || b.date > at[b.symbol]) { at[b.symbol] = b.date; m[b.symbol] = b.close }
    return m
  }, [bars])
  const barMap = useMemo(() => {
    const m: Record<string, Record<string, number>> = {}
    for (const b of bars ?? []) (m[b.symbol] ??= {})[b.date] = b.close
    return m
  }, [bars])

  const rows: WatchRow[] = useMemo(() => {
    const list = (watchlist ?? []).map((item): WatchRow => {
      const q = quotes[item.symbol]
      const i = info[item.symbol]
      const price = q?.price ?? lastClose[item.symbol]
      return {
        item, quote: q, info: i, stored: !q && price !== undefined,
        symbol: item.symbol, name: i?.profile?.name, exchange: i?.profile?.exchange, industry: i?.profile?.industry,
        price, changePct: q?.changePct, low: q?.low || undefined, high: q?.high || undefined,
        week52Low: i?.metrics?.week52Low, week52High: i?.metrics?.week52High, pe: i?.metrics?.peTTM, eps: i?.metrics?.epsTTM, beta: i?.metrics?.beta,
        dividendYield: i?.metrics?.dividendYield, marketCap: i?.metrics?.marketCap ?? i?.profile?.marketCap,
      }
    })
    return applyOrder(list, settings?.order ?? [])
  }, [watchlist, quotes, info, lastClose, settings?.order])

  const prices = useMemo(() => Object.fromEntries(Object.entries(quotes).map(([s, q]) => [s, q.price])), [quotes])
  const prevClose = useMemo(() => Object.fromEntries(Object.entries(quotes).map(([s, q]) => [s, q.prevClose])), [quotes])
  // Fall back to the last saved close for held tickers with no live quote, then to the holding's stored price.
  const fallbackPrices = useMemo(() => ({ ...lastClose, ...prices }), [lastClose, prices])
  const portfolio = useMemo(() => summarize((holdings ?? []) as Holding[], fallbackPrices, prevClose), [holdings, fallbackPrices, prevClose])
  const series = useMemo(() => portfolioSeries(holdings ?? [], barMap), [holdings, barMap])

  const fetchedAt = useMemo(() => Object.values(quotes).reduce<number | undefined>((m, q) => (m === undefined || q.fetchedAt > m ? q.fetchedAt : m), undefined), [quotes])

  return {
    key, loading: watchlist === undefined || holdings === undefined, quotesLoading: loading, error, refresh, status, statusError,
    watchlist: watchlist ?? [], holdings: holdings ?? [], contributions: contributions ?? [], rows, quotes, portfolio, series, barMap, fetchedAt,
    targets: settings?.targets ?? {}, order: settings?.order ?? [], screens: settings?.screens ?? ([] as SavedScreen[]),
    heldTickers, hasLive: Object.keys(quotes).length > 0,
  }
}

export type MarketsData = ReturnType<typeof useMarketsData>

export const saveTargets = (t: Record<string, number>) => setSetting(TARGETS_KEY, t)
export const saveOrder = (o: string[]) => setSetting(ORDER_KEY, o)
export const saveScreens = (s: SavedScreen[]) => setSetting(SCREENS_KEY, s)
