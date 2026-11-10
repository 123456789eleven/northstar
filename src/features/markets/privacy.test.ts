import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { db, setSetting } from '../../db'
import { buildBackup } from '../../lib/backup'
import { INTERNAL_TABLES, isLocalOnlySetting } from '../../sync/outbox'
import { isSyncedTable, naturalKey, uniqueLookup } from '../../sync/schema'

const read = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), 'utf8')

describe('markets privacy plumbing', () => {
  it('market.* settings are device-local and never queued for sync', () => {
    expect(isLocalOnlySetting('market.finnhubKey')).toBe(true)
    expect(isLocalOnlySetting('market.anything')).toBe(true)
    expect(isLocalOnlySetting('paper.startCash')).toBe(false)
  })
  it('priceHistory is a local cache (not synced); the user tables are synced', () => {
    expect(INTERNAL_TABLES.has('priceHistory')).toBe(true)
    expect(isSyncedTable('priceHistory')).toBe(false)
    for (const t of ['watchlist', 'paperTrades', 'tradeJournal']) expect(isSyncedTable(t)).toBe(true)
  })
  it('watchlist uses its symbol as the natural key', async () => {
    expect(await naturalKey('watchlist', { symbol: 'VTI' }, async () => null)).toBe('VTI')
    expect(uniqueLookup('watchlist', { symbol: 'VTI' })).toEqual({ index: 'symbol', value: 'VTI' })
  })
  it('the key is excluded from backups but priceHistory is included', async () => {
    await setSetting('market.finnhubKey', 'fakekey1234567890')
    await db.priceHistory.add({ symbol: 'VTI', date: '2026-03-01', close: 1 })
    const b = await buildBackup()
    expect(JSON.stringify(b)).not.toContain('fakekey1234567890')
    expect(b.tables.priceHistory).toHaveLength(1)
  })
  it('CSP allows only finnhub rest + websocket as new hosts', () => {
    const csp = /connect-src ([^;]*);/.exec(read('index.html'))![1]
    expect(csp).toContain('https://finnhub.io')
    expect(csp).toContain('wss://ws.finnhub.io')
    expect(csp).not.toMatch(/\*\.finnhub|\bhttps:\s|\*(?!\.supabase)/)
  })
  it('the service worker has no runtime caching, so finnhub responses are never stored', () => {
    const cfg = read('vite.config.ts')
    expect(cfg).not.toMatch(/runtimeCaching/)
    expect(cfg).not.toMatch(/finnhub/i)
  })
})
