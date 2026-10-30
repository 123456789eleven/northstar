import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type LearningItem } from '../../db'
import { addSession, completeItem, fmtMinutes, saveItem, sessionStreak, startItem, undoLast, type ItemDraft } from './learningData'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 5, 15, 12, 0))
})
afterEach(() => vi.useRealTimers())

const draft = (over: Partial<ItemDraft> = {}): ItemDraft => ({ title: ' SQL ', kind: 'course', status: 'planned', progress: 0, ...over })
const events = () => db.events.orderBy('at').toArray()

describe('sessionStreak', () => {
  const s = (...d: string[]) => new Set(d)
  it('consecutive days ending today', () => {
    expect(sessionStreak(s('2026-06-15', '2026-06-14', '2026-06-13'))).toBe(3)
  })
  it('still alive if only yesterday is logged', () => {
    expect(sessionStreak(s('2026-06-14', '2026-06-13'))).toBe(2)
  })
  it('broken by a gap or by two empty days', () => {
    expect(sessionStreak(s('2026-06-15', '2026-06-13'))).toBe(1)
    expect(sessionStreak(s('2026-06-13', '2026-06-12'))).toBe(0)
    expect(sessionStreak(s())).toBe(0)
  })
  it('explicit from-date and month boundary', () => {
    expect(sessionStreak(s('2026-03-01', '2026-02-28', '2026-02-27'), '2026-03-01')).toBe(3)
  })
})

describe('fmtMinutes', () => {
  it.each([[0, '0m'], [45, '45m'], [60, '1h'], [61, '1h 1m'], [125, '2h 5m']])('%i -> %s', (m, want) => {
    expect(fmtMinutes(m)).toBe(want)
  })
})

describe('addSession', () => {
  it('records rounded minutes and trims note', async () => {
    await addSession(1, 29.6, '2026-06-14', '  chapter 2 ')
    expect(await db.studySessions.toArray()).toMatchObject([{ itemId: 1, minutes: 30, date: '2026-06-14', note: 'chapter 2' }])
  })
  it('ignores zero, negative and NaN minutes', async () => {
    await addSession(1, 0)
    await addSession(1, -5)
    await addSession(1, NaN)
    expect(await db.studySessions.count()).toBe(0)
  })
  it('defaults to today', async () => {
    await addSession(1, 10)
    expect((await db.studySessions.toArray())[0].date).toBe('2026-06-15')
  })
})

describe('saveItem status transitions', () => {
  it('creating a planned item logs nothing', async () => {
    const item = await saveItem(draft())
    expect(item.title).toBe('SQL')
    expect(await events()).toHaveLength(0)
    expect(item.startedAt).toBeUndefined()
  })
  it('creating directly as active sets startedAt and logs a start', async () => {
    const item = await saveItem(draft({ status: 'active', progress: 10 }))
    expect(item.startedAt).toBe('2026-06-15')
    const ev = await events()
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ kind: 'learning-started', milestone: false, refId: item.id })
  })
  it('planned -> active logs start once; editing while active logs nothing more', async () => {
    const planned = await saveItem(draft())
    const stored = (await db.learning.get(planned.id!))!
    const active = await saveItem(draft({ status: 'active' }), stored)
    await saveItem(draft({ status: 'active', progress: 50 }), (await db.learning.get(active.id!))!)
    expect((await events()).filter((e) => e.kind === 'learning-started')).toHaveLength(1)
  })
  it('completing sets 100%, completedAt, and a milestone; certification wording differs', async () => {
    const cert = await saveItem(draft({ title: 'AWS SAA', kind: 'certification', status: 'done', progress: 40 }))
    expect(cert).toMatchObject({ progress: 100, completedAt: '2026-06-15', startedAt: '2026-06-15' })
    const book = await saveItem(draft({ title: 'Dune', kind: 'book', status: 'done' }))
    const ev = (await events()).filter((e) => e.milestone)
    expect(ev.map((e) => e.title).sort()).toEqual(['Completed Dune', 'Earned AWS SAA'])
    expect(book.completedAt).toBe('2026-06-15')
  })
  it('re-saving a done item does not log another completion', async () => {
    const done = await saveItem(draft({ status: 'done' }))
    await saveItem(draft({ status: 'done', title: 'SQL 2' }), (await db.learning.get(done.id!))!)
    expect((await events()).filter((e) => e.kind === 'learning-completed')).toHaveLength(1)
  })
  it('moving back from done clears completedAt', async () => {
    const done = await saveItem(draft({ status: 'done' }))
    const back = await saveItem(draft({ status: 'active', progress: 80 }), (await db.learning.get(done.id!))!)
    expect(back.completedAt).toBeUndefined()
    expect((await db.learning.get(done.id!))!.completedAt).toBeUndefined()
  })
  it('clamps progress to 0..100 and normalizes blank provider/url', async () => {
    const hi = await saveItem(draft({ progress: 250, provider: '  ', url: '' }))
    expect(hi.progress).toBe(100)
    expect(hi.provider).toBeUndefined()
    expect(hi.url).toBeUndefined()
    const lo = await saveItem(draft({ progress: -9 }))
    expect(lo.progress).toBe(0)
  })
})

describe('startItem / completeItem', () => {
  const make = async (over: Partial<LearningItem> = {}) => {
    const id = await db.learning.add({ title: 'Rust', kind: 'skill', status: 'planned', progress: 0, createdAt: '2026-01-01T00:00:00Z', ...over })
    return (await db.learning.get(id))!
  }
  it('startItem activates, keeps an existing startedAt, logs', async () => {
    const it1 = await make({ startedAt: '2026-01-02' })
    await startItem(it1)
    expect(await db.learning.get(it1.id!)).toMatchObject({ status: 'active', startedAt: '2026-01-02' })
    expect(await events()).toMatchObject([{ kind: 'learning-started', title: 'Started Rust' }])
  })
  it('completeItem sets progress/dates and logs a milestone', async () => {
    const it1 = await make()
    await completeItem(it1)
    expect(await db.learning.get(it1.id!)).toMatchObject({ status: 'done', progress: 100, completedAt: '2026-06-15', startedAt: '2026-06-15' })
    expect(await events()).toMatchObject([{ kind: 'learning-completed', milestone: true, title: 'Completed Rust' }])
  })

  it('undoLast removes only the most recent matching session', async () => {
    await addSession(1, 15)
    await addSession(1, 15)
    await undoLast(1, 15)
    expect(await db.studySessions.count()).toBe(1)
  })
})
