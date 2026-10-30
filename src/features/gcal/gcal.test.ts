import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db, getSetting } from '../../db'
import { mapGoogleEvent } from './map'
import { applyEvents, apiGet, runSync, syncWithToken, setStatus, getStatus, GcalError, windowFor } from './sync'

const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as Response
const noSleep = async () => {}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-06-15T12:00:00-04:00')) })
afterEach(() => vi.useRealTimers())

describe('mapGoogleEvent', () => {
  it('maps a timed event into local time (UTC input, New York)', () => {
    const [e] = mapGoogleEvent({ id: 'a', summary: 'Standup', start: { dateTime: '2026-06-16T14:00:00Z', timeZone: 'UTC' }, end: { dateTime: '2026-06-16T14:30:00Z' }, location: 'Room 1' }, 'cal')
    expect(e).toMatchObject({ title: 'Standup', date: '2026-06-16', start: '10:00', end: '10:30', allDay: false, location: 'Room 1', uid: 'g:cal:a:2026-06-16', importBatch: 'gcal' })
  })
  it('converts a different source offset', () => {
    const [e] = mapGoogleEvent({ id: 'a', start: { dateTime: '2026-06-16T23:00:00+09:00' }, end: { dateTime: '2026-06-17T00:00:00+09:00' } }, 'c')
    expect(e.date).toBe('2026-06-16')
    expect(e.start).toBe('10:00')
  })
  it('all-day end date is exclusive', () => {
    const r = mapGoogleEvent({ id: 'b', summary: 'Trip', start: { date: '2026-06-20' }, end: { date: '2026-06-21' } }, 'c')
    expect(r.map((x) => x.date)).toEqual(['2026-06-20'])
    expect(r[0].allDay).toBe(true)
  })
  it('expands multi-day all-day events', () => {
    const r = mapGoogleEvent({ id: 'b', start: { date: '2026-06-20' }, end: { date: '2026-06-23' } }, 'c')
    expect(r.map((x) => x.date)).toEqual(['2026-06-20', '2026-06-21', '2026-06-22'])
  })
  it('expands multi-day timed events and caps at 31 days', () => {
    const r = mapGoogleEvent({ id: 'm', start: { dateTime: '2026-06-20T20:00:00-04:00' }, end: { dateTime: '2026-06-22T09:00:00-04:00' } }, 'c')
    expect(r.map((x) => [x.date, x.start, x.end])).toEqual([['2026-06-20', '20:00', '23:59'], ['2026-06-21', '00:00', '23:59'], ['2026-06-22', '00:00', '09:00']])
    expect(mapGoogleEvent({ id: 'l', start: { date: '2026-01-01' }, end: { date: '2026-12-31' } }, 'c')).toHaveLength(31)
  })
  it('defaults the title, trims notes to 500, skips cancelled', () => {
    const [e] = mapGoogleEvent({ id: 'n', start: { date: '2026-06-20' }, description: ` ${'x'.repeat(600)} ` }, 'c')
    expect(e.title).toBe('Busy')
    expect(e.notes).toHaveLength(500)
    expect(mapGoogleEvent({ id: 'x', status: 'cancelled' }, 'c')).toEqual([])
  })
})

describe('applyEvents', () => {
  const win = { startDate: '2026-05-16', endDate: '2026-12-12' }
  const row = (id: string, date: string) => ({ title: id, date, allDay: true, uid: `g:cal:${id}:${date}`, importBatch: 'gcal' })

  it('upserts, removes vanished rows in window, keeps out-of-window and non-g rows', async () => {
    await db.calendar.bulkAdd([
      { title: 'manual', date: '2026-06-16', allDay: true },
      { title: 'ics', date: '2026-06-16', allDay: true, uid: 'abc@ics', importBatch: 'ics1' },
      { ...row('gone', '2026-06-16') },
      { ...row('old', '2025-01-01') },
      { ...row('keep', '2026-06-17') },
    ])
    const count = await applyEvents([{ ...row('keep', '2026-06-17'), title: 'renamed' }, row('new', '2026-06-18')], ['cal'], win)
    const all = await db.calendar.toArray()
    expect(all.map((e) => e.title).sort()).toEqual(['ics', 'manual', 'new', 'old', 'renamed'])
    expect(count).toBe(3)
  })
  it('removes rows of deselected calendars', async () => {
    await db.calendar.add({ ...row('z', '2026-06-16'), uid: 'g:other:z:2026-06-16' })
    await applyEvents([], ['cal'], win)
    expect(await db.calendar.count()).toBe(0)
  })
})

describe('sync', () => {
  it('pages through results and sends cancelled events as deletions', async () => {
    await db.calendar.add({ title: 'del', date: '2026-06-20', allDay: true, uid: 'g:primary:e2:2026-06-20' })
    const f = vi.fn()
      .mockResolvedValueOnce(json({ items: [{ id: 'e1', summary: 'A', start: { date: '2026-06-19' }, end: { date: '2026-06-20' } }], nextPageToken: 'p2' }))
      .mockResolvedValueOnce(json({ items: [{ id: 'e2', status: 'cancelled' }] }))
    const n = await syncWithToken('tok', { fetch: f as unknown as typeof fetch, sleep: noSleep })
    expect(n).toBe(1)
    expect(f.mock.calls[1][0]).toContain('pageToken=p2')
    expect(f.mock.calls[0][0]).toContain('showDeleted=true')
    expect(f.mock.calls[0][0]).toContain('singleEvents=true')
    expect((await db.calendar.toArray())[0].title).toBe('A')
    expect(windowFor().startDate).toBe('2026-05-16')
  })
  it('retries 429/5xx with a cap', async () => {
    const f = vi.fn().mockResolvedValue(json({}, 503))
    await expect(apiGet('u', 't', { fetch: f as unknown as typeof fetch, sleep: noSleep, maxRetries: 2 })).rejects.toMatchObject({ kind: 'server' })
    expect(f).toHaveBeenCalledTimes(3)
    const g = vi.fn().mockResolvedValueOnce(json({}, 429)).mockResolvedValueOnce(json({ ok: 1 }))
    expect(await apiGet('u', 't', { fetch: g as unknown as typeof fetch, sleep: noSleep })).toEqual({ ok: 1 })
  })
  it('classifies 403 and offline', async () => {
    await expect(apiGet('u', 't', { fetch: (async () => json({}, 403)) as typeof fetch })).rejects.toMatchObject({ kind: 'forbidden' })
    await expect(apiGet('u', 't', { fetch: (async () => { throw new TypeError('x') }) as typeof fetch })).rejects.toBeInstanceOf(GcalError)
  })
})

describe('runSync', () => {
  const ok = () => json({ items: [{ id: 'e1', summary: 'A', start: { date: '2026-06-19' }, end: { date: '2026-06-20' } }] })

  it('goes syncing -> connected, logs the connect event once, never stores the token', async () => {
    const seen: string[] = []
    const f = vi.fn(async () => { seen.push((await getStatus()).state); return ok() })
    const deps = { fetch: f as unknown as typeof fetch, sleep: noSleep, getToken: async () => 'SECRET-TOKEN-123' }
    const r = await runSync('cid', deps)
    expect(seen).toEqual(['syncing'])
    expect(r).toMatchObject({ state: 'connected', count: 1 })
    await runSync('cid', deps)
    expect(await db.events.filter((e) => e.kind === 'gcal.sync').count()).toBe(1)
    const dump = JSON.stringify([await db.settings.toArray(), await db.calendar.toArray(), await db.events.toArray()])
    expect(dump).not.toContain('SECRET-TOKEN-123')
  })
  it('refreshes silently once on 401, then succeeds', async () => {
    const f = vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(ok())
    const getToken = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new')
    const drop = vi.fn()
    const r = await runSync('cid', { fetch: f as unknown as typeof fetch, sleep: noSleep, getToken, dropToken: drop })
    expect(r.state).toBe('connected')
    expect(drop).toHaveBeenCalledOnce()
  })
  it('ends in error with a message when 401 persists', async () => {
    await setStatus({ state: 'connected', lastSyncedAt: '2026-06-01T00:00:00Z', count: 4 })
    const f = vi.fn(async () => json({}, 401))
    const r = await runSync('cid', { fetch: f as unknown as typeof fetch, sleep: noSleep, getToken: async () => 't', dropToken: () => {} })
    expect(r.state).toBe('error')
    expect(r.message).toMatch(/Reconnect/)
    expect(r.lastSyncedAt).toBe('2026-06-01T00:00:00Z')
    expect((await getSetting('gcal.status', { state: 'off' })).state).toBe('error')
  })
})
