import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db'
import { appendToToday, saveEntry } from './journalData'

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 9, 29, 9, 0)))
afterEach(() => vi.useRealTimers())

describe('journal persistence', () => {
  it('keeps one row per date and extracts tags', async () => {
    await saveEntry('2026-10-29', { text: 'hello #work' })
    await saveEntry('2026-10-29', { text: 'hello again #work #home', mood: 4 })
    const rows = await db.journal.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ mood: 4, tags: ['work', 'home'] })
  })

  it('logs one text-free event per day', async () => {
    await saveEntry('2026-10-29', { text: 'private thoughts' })
    await saveEntry('2026-10-29', { text: 'private thoughts, more' })
    const ev = await db.events.toArray()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ kind: 'journal.entry', title: 'Journal entry', milestone: false })
    expect(JSON.stringify(ev)).not.toContain('private')
  })

  it('does not log an event for mood-only or empty entries', async () => {
    await saveEntry('2026-10-29', { mood: 3 })
    expect(await db.events.count()).toBe(0)
  })

  it('appends capture lines to today and undoes cleanly', async () => {
    const undo1 = await appendToToday('first')
    const undo2 = await appendToToday('second')
    expect((await db.journal.toArray())[0].text).toBe('first\nsecond')
    await undo2()
    expect((await db.journal.toArray())[0].text).toBe('first')
    await undo1()
    expect(await db.journal.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
  })
})
