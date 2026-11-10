// Daily price history, recorded from real quotes only. One row per symbol per day; the day's row always holds the
// latest price seen that day as `close`. Nothing is back-filled or interpolated (candles are a premium endpoint).
import { db, type PriceBar } from '../../db'
import { today } from '../../lib/dates'
import type { Quote } from './finnhub'

const localDate = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Upserts the day's bar from a quote. The bar's date is the quote's own trade date (or today if it has none). */
export async function recordQuote(q: Pick<Quote, 'symbol' | 'price' | 'time' | 'open' | 'high' | 'low'>): Promise<PriceBar | null> {
  if (!Number.isFinite(q.price) || q.price <= 0) return null
  const date = q.time > 0 ? localDate(q.time) : today()
  return db.transaction('rw', db.priceHistory, async () => {
    const existing = await db.priceHistory.where('[symbol+date]').equals([q.symbol, date]).first()
    const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : undefined)
    const hi = Math.max(q.price, pos(q.high) ?? 0, existing?.high ?? 0)
    const lows = [q.price, pos(q.low), existing?.low].filter((n): n is number => n !== undefined)
    const bar: PriceBar = {
      ...(existing ?? {}),
      symbol: q.symbol,
      date,
      close: q.price,
      open: existing?.open ?? pos(q.open),
      high: hi,
      low: Math.min(...lows),
    }
    const id = await db.priceHistory.put(bar)
    return { ...bar, id: id as number }
  })
}

/** Recorded bars for a symbol, oldest first. `days` limits to the most recent N calendar days. */
export async function getSeries(symbol: string, days?: number): Promise<PriceBar[]> {
  let from = ''
  if (days && days > 0) {
    const d = new Date()
    d.setDate(d.getDate() - days)
    from = localDate(d.getTime())
  }
  const rows = await db.priceHistory.where('[symbol+date]').between([symbol, from], [symbol, '￿'], true, true).toArray()
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

/** Chart-ready points: [{ date, close }]. */
export async function getCloses(symbol: string, days?: number): Promise<{ date: string; close: number }[]> {
  return (await getSeries(symbol, days)).map((b) => ({ date: b.date, close: b.close }))
}
