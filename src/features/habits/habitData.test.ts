import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type Habit } from '../../db'
import { checkIn, toggleCheckIn, undoCheckIn } from './habitData'

const mk = async (perWeek = 7): Promise<Habit> => {
  const h: Habit = { name: 'Walk', area: 'health', perWeek, createdAt: '2026-01-01T00:00:00.000Z' }
  h.id = (await db.habits.add(h)) as number
  return h
}

beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(2026, 9, 29, 9, 0)))
afterEach(() => vi.useRealTimers())

describe('toggleCheckIn', () => {
  it('checks and unchecks a day, one row max', async () => {
    const h = await mk()
    expect(await toggleCheckIn(h, '2026-10-29')).toBe(true)
    expect(await db.habitLogs.count()).toBe(1)
    expect(await toggleCheckIn(h, '2026-10-29')).toBe(false)
    expect(await db.habitLogs.count()).toBe(0)
  })

  it('does not log events for ordinary check-ins', async () => {
    const h = await mk()
    await toggleCheckIn(h, '2026-10-29')
    expect(await db.events.count()).toBe(0)
  })

  it('logs a 7-day milestone once, even after toggling off and on', async () => {
    const h = await mk()
    for (const d of ['23', '24', '25', '26', '27', '28', '29']) await toggleCheckIn(h, `2026-10-${d}`)
    const ms = await db.events.toArray()
    expect(ms).toHaveLength(1)
    expect(ms[0]).toMatchObject({ kind: 'habit.streak', milestone: true, refTable: 'habits', refId: h.id })
    await toggleCheckIn(h, '2026-10-29')
    await toggleCheckIn(h, '2026-10-29')
    expect(await db.events.count()).toBe(1)
  })

  it('backfilling a past day works', async () => {
    const h = await mk(3)
    expect(await toggleCheckIn(h, '2026-10-27')).toBe(true)
    expect((await db.habitLogs.toArray())[0].date).toBe('2026-10-27')
  })
})

describe('checkIn milestone moment', () => {
  it('reports the milestone it reached with the next rung, and undo removes the log and the event', async () => {
    const h = await mk()
    for (const d of ['23', '24', '25', '26', '27', '28']) expect((await checkIn(h, `2026-10-${d}`)).milestone).toBeNull()
    const r = await checkIn(h, '2026-10-29')
    expect(r).toMatchObject({ checked: true, milestone: { count: 7, unit: 'day', key: 'streak:day:7', next: 30 } })
    await undoCheckIn(h, '2026-10-29', r.milestone)
    expect(await db.habitLogs.count()).toBe(6)
    expect(await db.events.count()).toBe(0)
  })
})
