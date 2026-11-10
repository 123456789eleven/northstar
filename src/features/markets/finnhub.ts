// Finnhub REST client (opt-in, owner's own free key). Only ticker symbols (and a date range for news) are ever
// sent; the key travels as the `token` query parameter and is never logged or stored anywhere but the
// device-local setting `market.finnhubKey`. Free-tier endpoints only: no /stock/candle (premium). See docs/markets.md.
import { getSetting } from '../../db'

export const KEY_SETTING = 'market.finnhubKey'
export const BASE_URL = 'https://finnhub.io/api/v1'
export const CALLS_PER_MINUTE = 60

export type MarketErrorCode = 'NoKey' | 'InvalidKey' | 'RateLimited' | 'Offline' | 'Unavailable'

export class MarketError extends Error {
  readonly code: MarketErrorCode
  /** For RateLimited: ms until a retry makes sense. */
  readonly retryAfterMs?: number
  constructor(code: MarketErrorCode, message?: string, retryAfterMs?: number) {
    super(message ?? DEFAULT_MESSAGES[code])
    this.name = 'MarketError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}

const DEFAULT_MESSAGES: Record<MarketErrorCode, string> = {
  NoKey: 'Add your Finnhub key to see live prices.',
  InvalidKey: 'Finnhub did not accept this key. Check it and try again.',
  RateLimited: 'Finnhub is limiting requests for a moment. Prices will resume shortly.',
  Offline: 'No connection. Showing the last prices saved on this device.',
  Unavailable: 'Finnhub could not answer right now.',
}

/** Same format check the key field uses: letters and digits only, a sensible length. */
export const isPlausibleKey = (k: string) => /^[A-Za-z0-9]{10,64}$/.test(k)
/** Show only the last 4 characters of a key, never the whole thing. */
export const maskKey = (k: string) => (k ? `${'•'.repeat(8)}${k.slice(-4)}` : '')

/** Upper-cases and validates a ticker; null when it is not a plausible symbol. */
export function normalizeSymbol(s: unknown): string | null {
  if (typeof s !== 'string') return null
  const u = s.trim().toUpperCase()
  return /^[A-Z0-9][A-Z0-9.\-:^]{0,19}$/.test(u) ? u : null
}

// ---- Typed results -------------------------------------------------------------------------------------------
export interface Quote {
  symbol: string
  price: number
  change: number
  changePct: number
  open: number
  high: number
  low: number
  prevClose: number
  /** Time of the last trade, ms since epoch. */
  time: number
  fetchedAt: number
}
export interface Profile { symbol: string; name: string; exchange?: string; industry?: string; currency?: string; marketCap?: number; weburl?: string }
export interface Metrics { week52High?: number; week52Low?: number; peTTM?: number; epsTTM?: number; beta?: number; dividendYield?: number; marketCap?: number }
export interface NewsItem { id: number; headline: string; summary: string; source: string; url: string; time: number }
export interface SearchHit { symbol: string; description: string; type: string }
export interface MarketStatus { exchange: string; isOpen: boolean; session?: string; holiday?: string; time: number }

// ---- Strict validators ---------------------------------------------------------------------------------------
const bad = (what: string): never => {
  throw new MarketError('Unavailable', `Finnhub sent an unexpected ${what} response.`)
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const str = (v: unknown, max = 2000): string | undefined => (typeof v === 'string' && v.length <= max ? v : undefined)
const httpsUrl = (v: unknown): string | undefined => {
  if (typeof v !== 'string' || v.length > 2000) return undefined
  try {
    return new URL(v).protocol === 'https:' ? v : undefined
  } catch {
    return undefined
  }
}

export function parseQuote(symbol: string, raw: unknown, now = Date.now()): Quote {
  if (!isObj(raw)) return bad('quote')
  const c = num(raw.c), o = num(raw.o), h = num(raw.h), l = num(raw.l), pc = num(raw.pc), t = num(raw.t)
  if (c === undefined || pc === undefined) return bad('quote')
  // Finnhub answers an unknown symbol with all zeros.
  if (c === 0 && pc === 0 && !t) throw new MarketError('Unavailable', `No quote found for ${symbol}.`)
  if (c < 0 || pc < 0) return bad('quote')
  const change = num(raw.d) ?? c - pc
  const changePct = num(raw.dp) ?? (pc ? ((c - pc) / pc) * 100 : 0)
  return { symbol, price: c, change, changePct, open: o ?? c, high: h ?? c, low: l ?? c, prevClose: pc, time: (t ?? 0) * 1000, fetchedAt: now }
}

export function parseProfile(symbol: string, raw: unknown): Profile {
  if (!isObj(raw)) return bad('profile')
  const name = str(raw.name, 200)
  if (!name) throw new MarketError('Unavailable', `No company profile for ${symbol}.`)
  return { symbol, name, exchange: str(raw.exchange, 200), industry: str(raw.finnhubIndustry, 200), currency: str(raw.currency, 10), marketCap: num(raw.marketCapitalization), weburl: httpsUrl(raw.weburl) }
}

export function parseMetrics(raw: unknown): Metrics {
  if (!isObj(raw) || !isObj(raw.metric)) return bad('metrics')
  const m = raw.metric
  return {
    week52High: num(m['52WeekHigh']),
    week52Low: num(m['52WeekLow']),
    peTTM: num(m.peTTM) ?? num(m.peBasicExclExtraTTM),
    epsTTM: num(m.epsTTM) ?? num(m.epsBasicExclExtraItemsTTM),
    beta: num(m.beta),
    dividendYield: num(m.dividendYieldIndicatedAnnual),
    marketCap: num(m.marketCapitalization),
  }
}

export function parseNews(raw: unknown, limit = 20): NewsItem[] {
  if (!Array.isArray(raw)) return bad('news')
  const out: NewsItem[] = []
  for (const r of raw) {
    if (!isObj(r)) continue
    const id = num(r.id), dt = num(r.datetime), headline = str(r.headline, 500), url = httpsUrl(r.url)
    if (id === undefined || dt === undefined || !headline || !url) continue
    out.push({ id, headline, summary: str(r.summary, 2000) ?? '', source: str(r.source, 100) ?? '', url, time: dt * 1000 })
    if (out.length >= limit) break
  }
  return out
}

export function parseSearch(raw: unknown): SearchHit[] {
  if (!isObj(raw) || !Array.isArray(raw.result)) return bad('search')
  const out: SearchHit[] = []
  for (const r of raw.result) {
    if (!isObj(r)) continue
    const symbol = normalizeSymbol(r.symbol), description = str(r.description, 200)
    if (!symbol || !description) continue
    out.push({ symbol, description, type: str(r.type, 50) ?? '' })
    if (out.length >= 15) break
  }
  return out
}

export function parseMarketStatus(raw: unknown): MarketStatus {
  if (!isObj(raw) || typeof raw.isOpen !== 'boolean') return bad('market status')
  return { exchange: str(raw.exchange, 20) ?? 'US', isOpen: raw.isOpen, session: str(raw.session, 50), holiday: str(raw.holiday, 100), time: (num(raw.t) ?? 0) * 1000 }
}

// ---- Client --------------------------------------------------------------------------------------------------
export const TTL = { quote: 15_000, profile: 24 * 3_600_000, metric: 3_600_000, news: 600_000, search: 600_000, status: 60_000 } as const

export interface ClientOptions {
  fetchImpl?: typeof fetch
  getKey?: () => Promise<string>
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  timeoutMs?: number
  callsPerMinute?: number
}

export function createFinnhubClient(opts: ClientOptions = {}) {
  const now = opts.now ?? (() => Date.now())
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const getKey = opts.getKey ?? (async () => (await getSetting<string>(KEY_SETTING, '')) || '')
  const timeoutMs = opts.timeoutMs ?? 10_000
  const budget = opts.callsPerMinute ?? CALLS_PER_MINUTE

  const sent: number[] = []
  let queueTail: Promise<unknown> = Promise.resolve()
  let blockedUntil = 0
  const cache = new Map<string, { at: number; ttl: number; value: unknown }>()
  const inflight = new Map<string, Promise<unknown>>()

  /** Waits (FIFO) until a call fits in the rolling 60 s budget. */
  function acquire(): Promise<void> {
    const run = async () => {
      for (;;) {
        const t = now()
        if (t < blockedUntil) throw new MarketError('RateLimited', undefined, blockedUntil - t)
        while (sent.length && t - sent[0] >= 60_000) sent.shift()
        if (sent.length < budget) {
          sent.push(t)
          return
        }
        await sleep(sent[0] + 60_000 - t + 1)
      }
    }
    const p = queueTail.then(run)
    queueTail = p.catch(() => undefined)
    return p
  }

  async function request(path: string, params: Record<string, string>, keyOverride?: string): Promise<unknown> {
    const key = keyOverride ?? (await getKey())
    if (!key) throw new MarketError('NoKey')
    await acquire()
    const f = opts.fetchImpl ?? globalThis.fetch.bind(globalThis)
    const url = new URL(BASE_URL + path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('token', key)
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), timeoutMs)
    let res: Response
    try {
      res = await f(url.toString(), { signal: ctl.signal, credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    } catch (e) {
      if (ctl.signal.aborted) throw new MarketError('Unavailable', 'Finnhub took too long to answer.')
      if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new MarketError('Offline')
      if (e instanceof TypeError) throw new MarketError('Offline')
      throw new MarketError('Unavailable')
    } finally {
      clearTimeout(timer)
    }
    if (res.status === 401 || res.status === 403) throw new MarketError('InvalidKey')
    if (res.status === 429) {
      const ra = Number(res.headers.get('retry-after'))
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 30_000
      blockedUntil = now() + wait
      throw new MarketError('RateLimited', undefined, wait)
    }
    if (!res.ok) throw new MarketError('Unavailable')
    try {
      return await res.json()
    } catch {
      throw new MarketError('Unavailable', 'Finnhub sent an unreadable response.')
    }
  }

  /** Cached + de-duplicated fetch. The token is never part of the cache key. */
  function cached<T>(id: string, ttl: number, load: () => Promise<T>): Promise<T> {
    const hit = cache.get(id)
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.value as T)
    const running = inflight.get(id)
    if (running) return running as Promise<T>
    const p = load()
      .then((value) => {
        cache.set(id, { at: now(), ttl, value })
        return value
      })
      .finally(() => inflight.delete(id))
    inflight.set(id, p)
    return p
  }

  const sym = (s: string) => {
    const n = normalizeSymbol(s)
    if (!n) throw new MarketError('Unavailable', 'That does not look like a ticker symbol.')
    return n
  }

  return {
    getQuote: (symbol: string) => {
      const s = sym(symbol)
      return cached(`quote:${s}`, TTL.quote, async () => parseQuote(s, await request('/quote', { symbol: s }), now()))
    },
    getProfile: (symbol: string) => {
      const s = sym(symbol)
      return cached(`profile:${s}`, TTL.profile, async () => parseProfile(s, await request('/stock/profile2', { symbol: s })))
    },
    getMetrics: (symbol: string) => {
      const s = sym(symbol)
      return cached(`metric:${s}`, TTL.metric, async () => parseMetrics(await request('/stock/metric', { symbol: s, metric: 'all' })))
    },
    /** Company news for a window of local dates (YYYY-MM-DD). */
    getNews: (symbol: string, from: string, to: string) => {
      const s = sym(symbol)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new MarketError('Unavailable', 'Bad date range.')
      return cached(`news:${s}:${from}:${to}`, TTL.news, async () => parseNews(await request('/company-news', { symbol: s, from, to })))
    },
    search: (query: string) => {
      const q = query.trim().slice(0, 40)
      if (!q) return Promise.resolve([] as SearchHit[])
      return cached(`search:${q.toLowerCase()}`, TTL.search, async () => parseSearch(await request('/search', { q })))
    },
    getMarketStatus: (exchange = 'US') => cached(`status:${exchange}`, TTL.status, async () => parseMarketStatus(await request('/stock/market-status', { exchange }))),
    /** Checks a key without saving it: asks for one quote. Resolves true, or throws a MarketError. */
    async testKey(key: string): Promise<true> {
      if (!isPlausibleKey(key)) throw new MarketError('InvalidKey')
      parseQuote('AAPL', await request('/quote', { symbol: 'AAPL' }, key))
      return true
    },
    clearCache: () => {
      cache.clear()
      inflight.clear()
    },
    /** Calls made in the last minute (for tests and diagnostics). */
    callsInLastMinute: () => sent.filter((t) => now() - t < 60_000).length,
  }
}

export type FinnhubClient = ReturnType<typeof createFinnhubClient>
/** The app-wide client (reads the key from settings). */
export const finnhub = createFinnhubClient()
