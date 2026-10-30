import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { buildBackup, eraseAll, importBackup } from './backup'
import { addDays } from './dates'
import { DEMO_KEY, demoCounts, getDemoRecord, hasUserData, loadDemo, removeDemo } from './demo'
import { isLocalOnlySetting, setTracking } from '../sync/outbox'
import { loadDemoWithConfirm } from '../features/onboarding/demoActions'

const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.filter((t) => t.name !== 'settings').map(async (t) => [t.name, await t.toArray()])))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-05-20T10:00:00'))
})
afterEach(() => {
  setTracking(db, false)
  vi.useRealTimers()
})

describe('demo data', () => {
  it('loads a realistic set across tables', async () => {
    expect(await loadDemo()).toBe(true)
    const n = async (t: string) => db.table(t).count()
    expect(await n('tasks')).toBeGreaterThanOrEqual(25)
    expect(await n('transactions')).toBeGreaterThanOrEqual(80)
    expect(await n('people')).toBe(8)
    expect(await n('habits')).toBe(4)
    expect(await n('journal')).toBe(10)
    expect(await n('calendar')).toBeGreaterThanOrEqual(15)
    expect(await n('reviews')).toBe(1)
    expect(await n('events')).toBeGreaterThan(10)
    expect((await demoCounts())!.rows).toBeGreaterThan(300)
    const overdue = await db.tasks.filter((t) => t.status === 'open' && !!t.due && t.due < '2026-05-20').count()
    expect(overdue).toBeGreaterThan(0)
  })

  it('is idempotent', async () => {
    await loadDemo()
    const before = await db.tasks.count()
    expect(await loadDemo()).toBe(false)
    expect(await db.tasks.count()).toBe(before)
  })

  it('dates are relative to today', async () => {
    await loadDemo()
    const a = (await db.tasks.toArray()).map((t) => t.due).filter(Boolean).sort()
    await removeDemo()
    vi.setSystemTime(new Date('2027-01-10T10:00:00'))
    await loadDemo()
    const b = (await db.tasks.toArray()).map((t) => t.due).filter(Boolean).sort()
    expect(b[0]).toBe(addDays('2027-01-10', -20))
    expect(a[0]).toBe(addDays('2026-05-20', -20))
  })

  it('removal deletes only demo rows, their events, and leaves user rows alone', async () => {
    const taskId = (await db.tasks.add({ title: 'Mine', priority: 1, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() })) as number
    const budgetId = (await db.budgets.add({ category: 'Dining', monthlyLimit: 99 })) as number
    await db.events.add({ at: new Date().toISOString(), area: 'personal', kind: 'manual', title: 'Mine', milestone: false })
    await db.settings.put({ key: 'profile.name', value: 'Me' })
    const before = await snapshot()

    await loadDemo()
    expect(await db.budgets.count()).toBe(2) // Dining skipped, Groceries added
    // User activity on a demo row, which must also go.
    const demoHabit = (await getDemoRecord())!.ids.habits[0]
    await db.habitLogs.where('habitId').equals(demoHabit).delete()
    await db.habitLogs.add({ habitId: demoHabit, date: '2026-05-20' })
    await db.events.add({ at: new Date().toISOString(), area: 'health', kind: 'habit.streak', title: 'x', refTable: 'habits', refId: demoHabit, milestone: true })

    expect(await removeDemo()).toBeGreaterThan(300)
    expect(await snapshot()).toEqual(before)
    expect(await db.tasks.get(taskId)).toBeTruthy()
    expect((await db.budgets.get(budgetId))!.monthlyLimit).toBe(99)
    expect(await db.settings.get(DEMO_KEY)).toBeUndefined()
    expect((await db.settings.get('profile.name'))!.value).toBe('Me')
    expect(await getDemoRecord()).toBeNull()
  })

  it('never queues sync outbox entries, on load or removal', async () => {
    setTracking(db, true)
    await loadDemo()
    expect(await db.table('outbox').count()).toBe(0)
    await db.tasks.add({ title: 'Mine', priority: 1, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() })
    expect(await db.table('outbox').count()).toBe(1) // tracking is really on
    await removeDemo()
    expect(await db.table('outbox').count()).toBe(1)
  })

  it('demo.ids is a device-local setting', () => {
    expect(isLocalOnlySetting(DEMO_KEY)).toBe(true)
  })

  it('asks before adding to real data and only adds', async () => {
    expect(await hasUserData()).toBe(false)
    await db.people.add({ name: 'Real', relation: 'friend', cadenceDays: 7 })
    expect(await hasUserData()).toBe(true)
    const no = vi.fn(() => false)
    expect(await loadDemoWithConfirm(no)).toBe('cancelled')
    expect(no).toHaveBeenCalled()
    expect(await db.people.count()).toBe(1)
    expect(await loadDemoWithConfirm(() => true)).toBe('loaded')
    expect(await db.people.count()).toBe(9)
    expect(await db.people.where('name').equals('Real').count()).toBe(1)
  })

  it('backup round trip keeps demo data and its record', async () => {
    await loadDemo()
    const before = await snapshot()
    const backup = await buildBackup()
    await eraseAll()
    await importBackup(backup)
    expect(await snapshot()).toEqual(before)
    expect(await getDemoRecord()).not.toBeNull()
    expect(await removeDemo()).toBeGreaterThan(300)
    expect(await db.tasks.count()).toBe(0)
  })
})
