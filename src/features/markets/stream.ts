// Finnhub trade WebSocket (wss://ws.finnhub.io?token=...). Connects only while at least one consumer is
// subscribed, sends only ticker symbols, reconnects with backoff, and closes when the tab has been hidden >60 s.
// The free plan's websocket coverage is not guaranteed; consumers must fall back to polling (see `status`).
import { getSetting } from '../../db'
import { KEY_SETTING, normalizeSymbol } from './finnhub'

export const MAX_STREAM_SYMBOLS = 50
export const HIDDEN_CLOSE_MS = 60_000
export const WS_URL = 'wss://ws.finnhub.io'

export interface Trade { price: number; time: number; volume: number }
export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed'

interface WsLike {
  send(data: string): void
  close(): void
  onopen: ((ev?: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev?: unknown) => void) | null
  onerror: ((ev?: unknown) => void) | null
}
export interface StreamOptions {
  createSocket?: (url: string) => WsLike
  getKey?: () => Promise<string>
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (h: unknown) => void
  now?: () => number
}

export function createStream(opts: StreamOptions = {}) {
  const createSocket = opts.createSocket ?? ((u: string) => new WebSocket(u) as unknown as WsLike)
  const getKey = opts.getKey ?? (async () => (await getSetting<string>(KEY_SETTING, '')) || '')
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))

  const counts = new Map<string, number>()
  const last = new Map<string, Trade>()
  const listeners = new Set<(symbol: string, t: Trade) => void>()
  const statusListeners = new Set<(s: StreamStatus) => void>()
  let ws: WsLike | null = null
  let status: StreamStatus = 'idle'
  let attempts = 0
  let retry: unknown = null
  let hiddenTimer: unknown = null
  let connecting = false

  const setStatus = (s: StreamStatus) => {
    if (s === status) return
    status = s
    statusListeners.forEach((l) => l(s))
  }
  const wanted = () => [...counts.keys()]

  function teardown() {
    if (retry) clearTimer(retry)
    retry = null
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null
      try { ws.close() } catch { /* already closed */ }
    }
    ws = null
  }

  function scheduleReconnect() {
    if (!counts.size || retry) return
    const delay = Math.min(30_000, 1000 * 2 ** attempts) + Math.floor(Math.random() * 250)
    attempts += 1
    retry = setTimer(() => { retry = null; void connect() }, delay)
  }

  async function connect() {
    if (ws || connecting || !counts.size) return
    connecting = true
    try {
      const key = await getKey()
      if (!key || !counts.size || ws) return
      setStatus('connecting')
      const sock = createSocket(`${WS_URL}?token=${encodeURIComponent(key)}`)
      ws = sock
      sock.onopen = () => {
        attempts = 0
        setStatus('open')
        for (const s of wanted()) sock.send(JSON.stringify({ type: 'subscribe', symbol: s }))
      }
      sock.onmessage = (ev) => {
        let msg: unknown
        try { msg = JSON.parse(String(ev.data)) } catch { return }
        if (!msg || typeof msg !== 'object') return
        const m = msg as { type?: unknown; data?: unknown }
        if (m.type !== 'trade' || !Array.isArray(m.data)) return
        for (const d of m.data) {
          if (!d || typeof d !== 'object') continue
          const { s, p, t, v } = d as Record<string, unknown>
          const sym = normalizeSymbol(s)
          if (!sym || !counts.has(sym) || typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || typeof t !== 'number') continue
          const trade = { price: p, time: t, volume: typeof v === 'number' ? v : 0 }
          last.set(sym, trade)
          listeners.forEach((l) => l(sym, trade))
        }
      }
      sock.onerror = () => { /* onclose follows */ }
      sock.onclose = () => {
        ws = null
        setStatus(counts.size ? 'closed' : 'idle')
        scheduleReconnect()
      }
    } finally {
      connecting = false
    }
  }

  function disconnect() {
    teardown()
    setStatus('idle')
  }

  function onVisibility() {
    if (typeof document === 'undefined') return
    if (document.visibilityState === 'hidden') {
      if (hiddenTimer === null && ws) hiddenTimer = setTimer(() => { hiddenTimer = null; disconnect() }, HIDDEN_CLOSE_MS)
    } else {
      if (hiddenTimer !== null) clearTimer(hiddenTimer)
      hiddenTimer = null
      if (counts.size && !ws) { attempts = 0; void connect() }
    }
  }
  let visBound = false
  const bindVisibility = (on: boolean) => {
    if (typeof document === 'undefined' || visBound === on) return
    visBound = on
    if (on) document.addEventListener('visibilitychange', onVisibility)
    else document.removeEventListener('visibilitychange', onVisibility)
  }

  return {
    /** Subscribe to symbols (max 50 distinct). Returns an unsubscribe function. Extra symbols are ignored. */
    subscribe(symbols: string[]): () => void {
      const mine: string[] = []
      for (const raw of symbols) {
        const s = normalizeSymbol(raw)
        if (!s || mine.includes(s)) continue
        if (!counts.has(s) && counts.size >= MAX_STREAM_SYMBOLS) continue
        mine.push(s)
        const isNew = !counts.has(s)
        counts.set(s, (counts.get(s) ?? 0) + 1)
        if (isNew && ws && status === 'open') ws.send(JSON.stringify({ type: 'subscribe', symbol: s }))
      }
      if (mine.length) bindVisibility(true)
      void connect()
      let done = false
      return () => {
        if (done) return
        done = true
        for (const s of mine) {
          const n = (counts.get(s) ?? 1) - 1
          if (n <= 0) {
            counts.delete(s)
            if (ws && status === 'open') ws.send(JSON.stringify({ type: 'unsubscribe', symbol: s }))
          } else counts.set(s, n)
        }
        if (!counts.size) {
          bindVisibility(false)
          if (hiddenTimer !== null) clearTimer(hiddenTimer)
          hiddenTimer = null
          disconnect()
        }
      }
    },
    getLast: (symbol: string): Trade | undefined => last.get(symbol.toUpperCase()),
    onTrade(fn: (symbol: string, t: Trade) => void): () => void {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    onStatus(fn: (s: StreamStatus) => void): () => void {
      statusListeners.add(fn)
      return () => statusListeners.delete(fn)
    },
    getStatus: () => status,
    symbols: wanted,
    /** Test hook: simulate the tab visibility handler. */
    _visibility: onVisibility,
    /** Drop everything (used when the key is removed). */
    reset() {
      counts.clear()
      last.clear()
      bindVisibility(false)
      disconnect()
    },
  }
}

export type FinnhubStream = ReturnType<typeof createStream>
export const finnhubStream = createStream()
