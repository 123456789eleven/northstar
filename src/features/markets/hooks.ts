// React hooks over the market client. Nothing runs without a key; polling only runs while the tab is visible.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'
import { finnhub, isPlausibleKey, KEY_SETTING, MarketError, maskKey, normalizeSymbol, type MarketStatus, type Quote } from './finnhub'
import { recordQuote } from './history'
import { finnhubStream } from './stream'

export const QUOTE_POLL_MS = 15_000
export const STATUS_POLL_MS = 60_000

/** A quote, optionally refreshed by a live trade since the last poll. */
export type LiveQuote = Quote & { live?: boolean }

const asError = (e: unknown): MarketError => (e instanceof MarketError ? e : new MarketError('Unavailable'))
const isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'

export function useFinnhubKey() {
  // Only a flag and the last 4 characters ever reach React state; the full key stays in the settings table.
  const info = useLiveQuery(async () => {
    const v = (await db.settings.get(KEY_SETTING))?.value
    return typeof v === 'string' && v ? { has: true, last4: v.slice(-4) } : { has: false, last4: '' }
  }, [])
  const setKey = useCallback(async (key: string) => {
    const k = key.trim()
    if (!isPlausibleKey(k)) throw new MarketError('InvalidKey')
    await setSetting(KEY_SETTING, k)
    finnhub.clearCache()
  }, [])
  const clearKey = useCallback(async () => {
    await db.settings.delete(KEY_SETTING)
    finnhub.clearCache()
    finnhubStream.reset()
  }, [])
  return { loading: info === undefined, hasKey: info?.has ?? false, hint: info?.has ? maskKey('xxxx' + info.last4) : '', setKey, clearKey }
}

export interface QuotesState {
  quotes: Record<string, LiveQuote>
  loading: boolean
  error: MarketError | null
  refresh: () => void
}

export function useQuotes(symbols: string[]): QuotesState {
  const { hasKey, loading: keyLoading } = useFinnhubKey()
  const list = useMemo(() => [...new Set(symbols.map(normalizeSymbol).filter((s): s is string => !!s))].sort(), [symbols.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>({})
  const [error, setError] = useState<MarketError | null>(null)
  const [loading, setLoading] = useState(false)
  const tick = useRef(0)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!hasKey || !list.length) return
    let stopped = false
    const run = async () => {
      if (!isVisible()) return
      const id = ++tick.current
      setLoading(true)
      let firstErr: MarketError | null = null
      await Promise.all(list.map(async (s) => {
        try {
          const q = await finnhub.getQuote(s)
          if (stopped) return
          setQuotes((prev) => ({ ...prev, [s]: { ...q, live: prev[s]?.live && prev[s].time > q.time ? prev[s].live : undefined } }))
          void recordQuote(q)
        } catch (e) {
          firstErr ??= asError(e)
        }
      }))
      if (stopped || id !== tick.current) return
      setLoading(false)
      setError(firstErr)
    }
    void run()
    const timer = setInterval(run, QUOTE_POLL_MS)
    const onVis = () => { if (isVisible()) void run() }
    document.addEventListener('visibilitychange', onVis)
    // Live trades overlay the polled quote while the socket is up; if it never opens, polling alone carries on.
    const unsub = finnhubStream.subscribe(list)
    const off = finnhubStream.onTrade((sym, t) => {
      if (stopped || !list.includes(sym)) return
      setQuotes((prev) => {
        const q = prev[sym]
        if (!q || t.time < q.time) return prev
        const change = t.price - q.prevClose
        return { ...prev, [sym]: { ...q, price: t.price, time: t.time, change, changePct: q.prevClose ? (change / q.prevClose) * 100 : 0, live: true } }
      })
    })
    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
      off()
      unsub()
    }
  }, [hasKey, keyLoading, list, nonce])

  const refresh = useCallback(() => { finnhub.clearCache(); setNonce((n) => n + 1) }, [])
  return { quotes: hasKey ? quotes : {}, loading: loading || keyLoading, error: !hasKey && !keyLoading ? new MarketError('NoKey') : error, refresh }
}

export function useQuote(symbol: string) {
  const { quotes, loading, error, refresh } = useQuotes(useMemo(() => [symbol], [symbol]))
  return { quote: quotes[normalizeSymbol(symbol) ?? ''] as LiveQuote | undefined, loading, error, refresh }
}

export function useMarketStatus() {
  const { hasKey } = useFinnhubKey()
  const [status, setStatus] = useState<MarketStatus | null>(null)
  const [error, setError] = useState<MarketError | null>(null)
  useEffect(() => {
    if (!hasKey) return
    let stopped = false
    const run = async () => {
      if (!isVisible()) return
      try {
        const s = await finnhub.getMarketStatus()
        if (!stopped) { setStatus(s); setError(null) }
      } catch (e) {
        if (!stopped) setError(asError(e))
      }
    }
    void run()
    const t = setInterval(run, STATUS_POLL_MS)
    return () => { stopped = true; clearInterval(t) }
  }, [hasKey])
  return { status: hasKey ? status : null, error }
}
