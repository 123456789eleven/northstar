import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db'
import { addBulk, loadBulkContext } from './bulkData'
import { emptyExisting, okItems, parseBulk } from './parse'
import { templateCsv } from './templates'

const NOW = new Date('2026-10-30T12:00:00')
const ctx = { now: NOW }
const one = (line: string, c = ctx) => parseBulk('balances', line, c).rows[0]

describe('balances parser', () => {
  it('parses a valid line, abs amount, and date formats', () => {
    const r = one('Marcus Savings (HYSA), asset,"$14,490.94",2026-09-30')
    expect(r.status).toBe('ok')
    expect(r.item).toMatchObject({ kind: 'balances', name: 'Marcus Savings (HYSA)', accountKind: 'asset', balance: 14490.94, date: '2026-09-30' })
    expect(one('Visa, liability, -1250, 09/30/2026').item).toMatchObject({ balance: 1250, date: '2026-09-30' })
    expect(one('Cash, a, 20').item).toMatchObject({ date: '2026-10-30', accountKind: 'asset' })
  })
  it('accepts kind aliases', () => {
    for (const w of ['L', 'debt', 'OWE', 'Liability']) expect(one(`Loan, ${w}, 5`).item).toMatchObject({ accountKind: 'liability' })
    for (const w of ['A', 'Asset']) expect(one(`Bank, ${w}, 5`).item).toMatchObject({ accountKind: 'asset' })
  })
  it('flags bad lines', () => {
    expect(one(', asset, 5').status).toBe('error')
    expect(one('Bank, savings, 5').reason).toMatch(/asset or liability/)
    expect(one('Bank, asset, lots').reason).toMatch(/amount/)
    expect(one('Bank, asset, 5, 2026-13-45').reason).toMatch(/date/)
    expect(one('Bank, asset').status).toBe('error')
  })
  it('marks duplicates (earlier in paste and already saved)', () => {
    const existing = emptyExisting()
    existing.balances.add('bank|2026-10-30|asset')
    const res = parseBulk('balances', 'BANK, asset, 5\nCard, liability, 9\ncard, liability, 9\nCard, asset, 9', { now: NOW, existing })
    expect(res.rows.map((r) => r.status)).toEqual(['duplicate', 'ok', 'duplicate', 'ok'])
  })
  it('reads a tab-separated paste with a header', () => {
    const res = parseBulk('balances', 'Account\tType\tBalance\tDate\nSavings\tasset\t100\t2026-09-01\nCard\tdebt\t$50\t', ctx)
    expect(res.mode).toBe('sheet')
    expect(res.headerLine).toBe(0)
    expect(res.rows.map((r) => r.item)).toMatchObject([
      { name: 'Savings', accountKind: 'asset', balance: 100, date: '2026-09-01' },
      { name: 'Card', accountKind: 'liability', balance: 50, date: '2026-10-30' },
    ])
  })
  it('template round-trips', () => {
    const csv = templateCsv('balances', '2026-10-30')!
    expect(parseBulk('balances', csv, ctx).rows.map((r) => r.status)).toEqual(['ok', 'ok'])
  })
})

describe('balances add + undo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('inserts rows with one event and undo removes exactly those', async () => {
    await db.balances.add({ date: '2026-01-01', name: 'Old', kind: 'asset', balance: 1 })
    const c = await loadBulkContext('balances')
    const res = parseBulk('balances', 'Bank, asset, 100\nCard, liability, 40\nOld, asset, 1, 2026-01-01', { now: NOW, ...c })
    expect(res.rows.map((r) => r.status)).toEqual(['ok', 'ok', 'duplicate'])
    const added = await addBulk('balances', okItems(res))
    expect(added.count).toBe(2)
    expect(await db.balances.count()).toBe(3)
    const events = await db.events.toArray()
    expect(events).toHaveLength(1)
    expect(events[0].title).toBe('Added 2 account balances')
    await added.undo()
    expect((await db.balances.toArray()).map((b) => b.name)).toEqual(['Old'])
    expect(await db.events.count()).toBe(0)
  })
})
