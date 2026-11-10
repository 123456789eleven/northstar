import { describe, expect, it, vi } from 'vitest'
import { createStream, MAX_STREAM_SYMBOLS } from './stream'

class FakeWs {
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  send(d: string) {
    this.sent.push(d)
  }
  close() {
    this.closed = true
  }
}
const flush = () => new Promise((r) => setTimeout(r, 0))

function make() {
  const sockets: FakeWs[] = []
  const urls: string[] = []
  const timers: { fn: () => void; ms: number }[] = []
  const s = createStream({
    createSocket: (u) => {
      urls.push(u)
      const w = new FakeWs()
      sockets.push(w)
      return w
    },
    getKey: async () => 'fakekey1234567890',
    setTimer: (fn, ms) => {
      timers.push({ fn, ms })
      return timers.length
    },
    clearTimer: () => {},
  })
  return { s, sockets, urls, timers }
}

describe('stream', () => {
  it('does not connect until someone subscribes, then connects and subscribes symbols', async () => {
    const { s, sockets, urls } = make()
    await flush()
    expect(sockets).toHaveLength(0)
    s.subscribe(['vti', 'AAPL'])
    await flush()
    expect(urls[0]).toBe('wss://ws.finnhub.io?token=fakekey1234567890')
    sockets[0].onopen!()
    const sent = sockets[0].sent.map((x) => JSON.parse(x).symbol).sort()
    expect(sent).toEqual(['AAPL', 'VTI'])
    expect(s.getStatus()).toBe('open')
  })

  it('exposes the last trade and ignores unsubscribed or invalid trades', async () => {
    const { s, sockets } = make()
    s.subscribe(['VTI'])
    await flush()
    const got = vi.fn()
    s.onTrade(got)
    sockets[0].onopen!()
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'trade', data: [{ s: 'VTI', p: 301.25, t: 1700, v: 3 }, { s: 'ZZZ', p: 1, t: 1, v: 1 }, { s: 'VTI', p: -5, t: 1, v: 1 }] }) })
    sockets[0].onmessage!({ data: 'not json' })
    sockets[0].onmessage!({ data: JSON.stringify({ type: 'ping' }) })
    expect(s.getLast('vti')).toEqual({ price: 301.25, time: 1700, volume: 3 })
    expect(got).toHaveBeenCalledTimes(1)
  })

  it('ref-counts consumers, and closes with the last one', async () => {
    const { s, sockets } = make()
    const a = s.subscribe(['VTI'])
    const b = s.subscribe(['VTI', 'QQQ'])
    await flush()
    sockets[0].onopen!()
    a()
    expect(s.symbols().sort()).toEqual(['QQQ', 'VTI'])
    b()
    expect(sockets[0].closed).toBe(true)
    expect(s.getStatus()).toBe('idle')
    expect(s.symbols()).toEqual([])
  })

  it('caps at 50 symbols', () => {
    const { s } = make()
    s.subscribe(Array.from({ length: 60 }, (_, i) => `S${i}`))
    expect(s.symbols()).toHaveLength(MAX_STREAM_SYMBOLS)
  })

  it('reconnects with growing backoff after a drop while consumers remain', async () => {
    const { s, sockets, timers } = make()
    s.subscribe(['VTI'])
    await flush()
    sockets[0].onclose!()
    expect(s.getStatus()).toBe('closed')
    expect(timers).toHaveLength(1)
    const first = timers[0].ms
    timers[0].fn()
    await flush()
    sockets[1].onclose!()
    expect(timers[1].ms).toBeGreaterThan(first)
  })

  it('never connects without a key', async () => {
    const sockets: FakeWs[] = []
    const s = createStream({
      createSocket: () => {
        const w = new FakeWs()
        sockets.push(w)
        return w
      },
      getKey: async () => '',
    })
    s.subscribe(['VTI'])
    await flush()
    expect(sockets).toHaveLength(0)
  })
})
