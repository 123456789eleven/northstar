import { db } from '../../db'
import { normalizeSymbol } from './finnhub'
import { MAX_WATCHLIST } from './view'

export async function addSymbol(symbol: string, count: number): Promise<string | null> {
  const s = normalizeSymbol(symbol)
  if (!s) return 'That does not look like a ticker symbol.'
  if (count >= MAX_WATCHLIST) return `The watchlist holds ${MAX_WATCHLIST} symbols. Remove one first.`
  if (await db.watchlist.where('symbol').equals(s).first()) return `${s} is already on the watchlist.`
  await db.watchlist.add({ symbol: s, addedAt: new Date().toISOString() })
  return null
}
