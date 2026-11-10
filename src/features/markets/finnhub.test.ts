import { describe, expect, it, vi } from 'vitest'
import { createFinnhubClient, isPlausibleKey, maskKey, MarketError, normalizeSymbol, parseNews, parseQuote } from './finnhub'
import { getSetting, setSetting } from '../../db'

const FAKE = 'fakekey1234567890abcd'
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers })
const Q = { c: 101.5, d: 1.5, dp: 1.5, h: 102, l: 99, o: 100, pc: 100, t: 1_700_000_000 }

function setup(handler: (url: URL) => Response | Promise<Response>, o: Parameters<typeof createFinnhubClient>[0] = {}) {
  let t = 1_000_000
  const calls: URL[] = []
  const fetchImpl = vi.fn(async (u: string | URL | Request) => {
    const url = new URL(String(u))
    calls.push(url)
    return handler(url)
  }) as unknown as typeof fetch
  const sleep = vi.fn(async (ms: number) => {
    t += ms
  })
  const client = createFinnhubClient({ fetchImpl, getKey: async () => FAKE, now: () => t, sleep, ...o })
  return {
    client,
    calls,
    sleep,
    advance: (ms: number) => {
      t += ms
    },
    fetchImpl,
  }
}

describe('helpers', () => {
  it('normalizes symbols and rejects junk', () => {
    expect(normalizeSymbol(' vti ')).toBe('VTI')
    expect(normalizeSymbol('BRK.B')).toBe('BRK.B')
    for (const bad of ['', 'a b', '<script>', 'x'.repeat(30), 5, null]) expect(normalizeSymbol(bad)).toBeNull()
  })
  it('masks keys to the last 4 characters', () => {
    expect(maskKey(FAKE)).toBe('••••••••abcd')
    expect(maskKey(FAKE)).not.toContain('fakekey')
    expect(maskKey('')).toBe('')
    expect(isPlausibleKey(FAKE)).toBe(true)
    expect(isPlausibleKey('short')).toBe(false)
    expect(isPlausibleKey('has space 123456')).toBe(false)
  })
})

describe('validation', () => {
  it('parses a quote and derives missing change fields', () => {
    const q = parseQuote('VTI', { c: 110, pc: 100, t: 1 }, 5)
    expect(q).toMatchObject({ price: 110, change: 10, changePct: 10, time: 1000, fetchedAt: 5, open: 110 })
  })
  it('rejects malformed quotes and treats all zeros as unknown symbol', () => {
    expect(() => parseQuote('X', null)).toThrow(MarketError)
    expect(() => parseQuote('X', { c: 'a', pc: 1 })).toThrow(/unexpected/)
    expect(() => parseQuote('X', { c: -1, pc: 1 })).toThrow(MarketError)
    expect(() => parseQuote('X', { c: 0, pc: 0, t: 0 })).toThrow(/No quote found/)
    expect(() => parseQuote('X', { c: NaN, pc: 1 })).toThrow(MarketError)
  })
  it('drops news items with bad urls or missing fields', () => {
    const items = parseNews([
      { id: 1, datetime: 10, headline: 'ok', url: 'https://example.com/a', source: 's', summary: '' },
      { id: 2, datetime: 10, headline: 'js', url: 'javascript:alert(1)' },
      { id: 3, headline: 'no date', url: 'https://example.com' },
      'junk',
    ])
    expect(items.map((i) => i.id)).toEqual([1])
    expect(() => parseNews({})).toThrow(MarketError)
  })
})

describe('client', () => {
  it('sends only the symbol and token, to finnhub, without credentials', async () => {
    const { client, calls, fetchImpl } = setup(() => json(Q))
    await client.getQuote('vti')
    expect(calls[0].origin).toBe('https://finnhub.io')
    expect(calls[0].pathname).toBe('/api/v1/quote')
    expect([...calls[0].searchParams.keys()].sort()).toEqual(['symbol', 'token'])
    expect(calls[0].searchParams.get('symbol')).toBe('VTI')
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]
    expect(init.credentials).toBe('omit')
  })

  it('throws NoKey without a key and makes no request', async () => {
    const { client, calls } = setup(() => json(Q), { getKey: async () => '' })
    await expect(client.getQuote('VTI')).rejects.toMatchObject({ code: 'NoKey' })
    expect(calls).toHaveLength(0)
  })

  it('maps 401/403 to InvalidKey, 500 to Unavailable, network failure to Offline', async () => {
    for (const [status, code] of [
      [401, 'InvalidKey'],
      [403, 'InvalidKey'],
      [500, 'Unavailable'],
    ] as const) {
      const { client } = setup(() => json({}, status))
      await expect(client.getQuote('VTI')).rejects.toMatchObject({ code })
    }
    const { client } = setup(() => {
      throw new TypeError('fetch failed')
    })
    await expect(client.getQuote('VTI')).rejects.toMatchObject({ code: 'Offline' })
  })

  it('times out slow requests as Unavailable', async () => {
    const { client } = setup(() => json(Q), {
      fetchImpl: ((_u: string, init: RequestInit) =>
        new Promise((_r, rej) => init.signal!.addEventListener('abort', () => rej(new DOMException('x', 'AbortError'))))) as unknown as typeof fetch,
      timeoutMs: 5,
    })
    await expect(client.getQuote('VTI')).rejects.toMatchObject({ code: 'Unavailable' })
  })

  it('treats a bad body as Unavailable', async () => {
    const { client } = setup(() => new Response('<html>', { status: 200 }))
    await expect(client.getQuote('VTI')).rejects.toMatchObject({ code: 'Unavailable' })
  })

  it('caches quotes for 15 s and de-duplicates concurrent calls', async () => {
    const { client, calls, advance } = setup(() => json(Q))
    await Promise.all([client.getQuote('VTI'), client.getQuote('VTI')])
    expect(calls).toHaveLength(1)
    advance(14_000)
    await client.getQuote('VTI')
    expect(calls).toHaveLength(1)
    advance(2_000)
    await client.getQuote('VTI')
    expect(calls).toHaveLength(2)
  })

  it('does not cache failures', async () => {
    let n = 0
    const { client, calls } = setup(() => (n++ === 0 ? json({}, 500) : json(Q)))
    await expect(client.getQuote('VTI')).rejects.toBeTruthy()
    await expect(client.getQuote('VTI')).resolves.toMatchObject({ price: 101.5 })
    expect(calls).toHaveLength(2)
  })

  it('uses the documented endpoints and TTLs for profile, metrics, news, search, status', async () => {
    const { client, calls, advance } = setup((u) => {
      if (u.pathname.endsWith('profile2')) return json({ name: 'Example Fund', exchange: 'NYSE' })
      if (u.pathname.endsWith('metric')) return json({ metric: { '52WeekHigh': 120, '52WeekLow': 80, peTTM: 20 } })
      if (u.pathname.endsWith('company-news')) return json([])
      if (u.pathname.endsWith('search')) return json({ count: 1, result: [{ symbol: 'VTI', description: 'Example', type: 'ETP' }] })
      return json({ exchange: 'US', isOpen: true, t: 5 })
    })
    expect((await client.getProfile('vti')).name).toBe('Example Fund')
    expect((await client.getMetrics('vti')).week52High).toBe(120)
    expect(calls[1].searchParams.get('metric')).toBe('all')
    await client.getNews('VTI', '2026-03-01', '2026-03-08')
    expect((await client.search('vt'))[0].symbol).toBe('VTI')
    expect((await client.getMarketStatus()).isOpen).toBe(true)
    expect(calls.map((c) => c.pathname)).toEqual(['/api/v1/stock/profile2', '/api/v1/stock/metric', '/api/v1/company-news', '/api/v1/search', '/api/v1/stock/market-status'])
    await client.getProfile('VTI')
    advance(3_000_000) // 50 min: metric (1 h) still cached
    await client.getMetrics('VTI')
    expect(calls).toHaveLength(5)
    advance(700_000)
    await client.getMetrics('VTI')
    expect(calls).toHaveLength(6)
    await expect(async () => client.getNews('VTI', 'bad', '2026-03-08')).rejects.toBeTruthy()
  })

  it('never uses a premium candle endpoint', async () => {
    const { client, calls } = setup(() => json(Q))
    await client.getQuote('VTI')
    expect(calls.every((c) => !c.pathname.includes('candle'))).toBe(true)
  })

  it('waits when the calls-per-minute budget is used', async () => {
    const { client, sleep, calls } = setup(() => json(Q), { callsPerMinute: 3 })
    for (const s of ['A', 'B', 'C', 'D']) await client.getQuote(s)
    expect(calls).toHaveLength(4)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('backs off after a 429 and blocks further calls until the delay passes', async () => {
    let n = 0
    const { client, calls, advance } = setup(() => (n++ === 0 ? json({}, 429, { 'retry-after': '20' }) : json(Q)))
    await expect(client.getQuote('A')).rejects.toMatchObject({ code: 'RateLimited', retryAfterMs: 20_000 })
    await expect(client.getQuote('B')).rejects.toMatchObject({ code: 'RateLimited' })
    expect(calls).toHaveLength(1)
    advance(20_001)
    await expect(client.getQuote('B')).resolves.toBeTruthy()
  })

  it('testKey checks a candidate key without saving it and rejects bad formats offline', async () => {
    const { client, calls } = setup(() => json(Q), { getKey: async () => '' })
    await expect(client.testKey(FAKE)).resolves.toBe(true)
    expect(calls[0].searchParams.get('token')).toBe(FAKE)
    expect(calls[0].searchParams.get('symbol')).toBe('AAPL')
    await expect(client.testKey('bad key!')).rejects.toMatchObject({ code: 'InvalidKey' })
    expect(calls).toHaveLength(1)
    const bad = setup(() => json({}, 401), { getKey: async () => '' })
    await expect(bad.client.testKey(FAKE)).rejects.toMatchObject({ code: 'InvalidKey' })
  })

  it('reads the key from the device-local setting by default', async () => {
    await setSetting('market.finnhubKey', FAKE)
    const calls: string[] = []
    const client = createFinnhubClient({
      fetchImpl: (async (u: string) => {
        calls.push(u)
        return json(Q)
      }) as unknown as typeof fetch,
    })
    await client.getQuote('VTI')
    expect(calls[0]).toContain(`token=${FAKE}`)
    expect(await getSetting('market.finnhubKey', '')).toBe(FAKE)
  })
})
