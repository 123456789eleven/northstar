import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { db } from '../db'

// The schema exactly as shipped through v3. NEVER edit: frozen fixture for the v4 (sync bookkeeping) migration.
const V3 = {
  tasks: '++id, status, due, goalId, focusDate, doneAt',
  goals: '++id, status, area, horizon, parentId',
  meals: '++id, date, slot',
  favoriteMeals: '++id, name, uses',
  transactions: '++id, date, category, importBatch',
  budgets: '++id, &category',
  balances: '++id, date, name',
  learning: '++id, status, kind, goalId',
  studySessions: '++id, itemId, date',
  people: '++id, name, lastContact',
  interactions: '++id, personId, date',
  events: '++id, at, area',
  reviews: '++id, &weekOf',
  settings: '&key',
  habits: '++id, archived, goalId',
  habitLogs: '++id, habitId, date, &[habitId+date]',
  journal: '++id, date',
  calendar: '++id, date, uid, importBatch',
}

describe('v4 migration (sync bookkeeping)', () => {
  it('v3 data survives, the new tables exist and start empty, and nothing is queued for sync', async () => {
    await db.delete()
    const old = new Dexie('northstar')
    old.version(3).stores(V3)
    await old.open()
    await old.table('journal').add({ date: '2026-03-01', text: 'private', createdAt: '2026-03-01T00:00:00Z' })
    const habitId = await old.table('habits').add({ name: 'Walk', area: 'health', perWeek: 5, createdAt: '2026-03-01T00:00:00Z' })
    await old.table('habitLogs').add({ habitId, date: '2026-03-01' })
    await old.table('settings').put({ key: 'profile.name', value: 'Sam' })
    old.close()

    await db.open()
    expect(db.verno).toBeGreaterThanOrEqual(4)
    expect((await db.journal.toArray())[0].text).toBe('private')
    expect(await db.habitLogs.where('[habitId+date]').equals([habitId as number, '2026-03-01']).count()).toBe(1)
    expect((await db.settings.get('profile.name'))!.value).toBe('Sam')
    expect(await db.table('outbox').count()).toBe(0)
    expect(await db.table('syncMeta').count()).toBe(0)
    // Writes after the upgrade are not tracked while sync is off.
    await db.journal.add({ date: '2026-03-02', text: 'x', createdAt: '2026-03-02T00:00:00Z' })
    expect(await db.table('outbox').count()).toBe(0)
    await db.table('syncMeta').put({ table: 'journal', key: 1, syncId: 'abc' })
    await expect(db.table('syncMeta').put({ table: 'journal', key: 2, syncId: 'abc' })).rejects.toThrow()
  })
})
