import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { db } from './db'

// The schema exactly as shipped in v1. NEVER edit this block: it is the frozen fixture the migration is tested against.
const V1_STORES = {
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
  events: '++id, at, area, milestone',
  reviews: '++id, &weekOf',
  settings: '&key',
}

describe('schema migrations', () => {
  it('current schema is at least v2 and every v1 table still exists', () => {
    expect(db.verno).toBeGreaterThanOrEqual(2)
    for (const name of Object.keys(V1_STORES)) expect(db.tables.map((t) => t.name), name).toContain(name)
  })

  it('v1 data survives opening at the current version, and indexes keep working', async () => {
    await db.delete()

    const old = new Dexie('northstar')
    old.version(1).stores(V1_STORES)
    await old.open()
    expect(old.verno).toBe(1)
    await old.table('tasks').bulkAdd([
      { title: 'Open task', priority: 1, status: 'open', recurrence: 'weekly', due: '2026-03-02', createdAt: '2026-01-01T00:00:00Z' },
      { title: 'Done task', priority: 2, status: 'done', recurrence: 'none', doneAt: '2026-02-01T12:00:00Z', createdAt: '2026-01-01T00:00:00Z' },
    ])
    await old.table('goals').add({ title: 'G', area: 'career', horizon: 'year', status: 'active', milestones: [{ id: 'a', title: 'm', done: false }], createdAt: '2026-01-01T00:00:00Z' })
    await old.table('meals').add({ date: '2026-03-01', slot: 'lunch', name: 'Salad', calories: 400 })
    await old.table('transactions').add({ date: '2026-03-01', amount: -9.99, description: 'X', category: 'Dining', importBatch: 'imp-1' })
    await old.table('budgets').add({ category: 'Dining', monthlyLimit: 200 })
    await old.table('people').add({ name: 'Ann', relation: 'friend', cadenceDays: 14 })
    await old.table('reviews').add({ weekOf: '2026-02-23', wins: '', struggles: '', focusNext: '', ratings: { career: 3 }, createdAt: '2026-02-24T00:00:00Z' })
    await old.table('settings').put({ key: 'food.targets', value: { protein: 100 } })
    await old.table('events').bulkAdd([
      { at: '2026-02-01T12:00:00Z', area: 'tasks', kind: 'task.done', title: 'Done task', milestone: false },
      { at: '2026-02-02T12:00:00Z', area: 'career', kind: 'goal.done', title: 'Big', milestone: true },
    ])
    old.close()

    // Open with the app's real schema (v2+).
    await db.open()
    expect(db.verno).toBeGreaterThanOrEqual(2)

    expect((await db.tasks.toArray()).map((t) => t.title).sort()).toEqual(['Done task', 'Open task'])
    expect(await db.tasks.where('status').equals('open').count()).toBe(1)
    expect(await db.tasks.where('due').equals('2026-03-02').count()).toBe(1)
    expect((await db.goals.toArray())[0].milestones).toEqual([{ id: 'a', title: 'm', done: false }])
    expect(await db.meals.where('date').equals('2026-03-01').count()).toBe(1)
    expect(await db.transactions.where('importBatch').equals('imp-1').count()).toBe(1)
    expect((await db.budgets.get(1))!.monthlyLimit).toBe(200)
    expect((await db.budgets.where('category').equals('Dining').first())!.monthlyLimit).toBe(200)
    expect(await db.people.count()).toBe(1)
    expect((await db.reviews.where('weekOf').equals('2026-02-23').first())!.ratings).toEqual({ career: 3 })
    expect((await db.settings.get('food.targets'))!.value).toEqual({ protein: 100 })

    // Events: both rows intact, area/at indexes still queryable, milestone flag preserved as data.
    expect(await db.events.count()).toBe(2)
    expect(await db.events.where('area').equals('career').count()).toBe(1)
    expect((await db.events.orderBy('at').first())!.title).toBe('Done task')
    expect(await db.events.filter((e) => e.milestone).count()).toBe(1)

    // New writes work, ids continue after the old ones, unique indexes still enforced.
    const nextId = await db.tasks.add({ title: 'New', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-03-01T00:00:00Z' })
    expect(nextId).toBe(3)
    await expect(db.budgets.add({ category: 'Dining', monthlyLimit: 1 })).rejects.toThrow()
  })

  it('the v2 events store no longer indexes the (unindexable) boolean milestone', () => {
    expect(db.events.schema.idxByName.milestone).toBeUndefined()
    expect(db.events.schema.idxByName.at).toBeDefined()
    expect(db.events.schema.idxByName.area).toBeDefined()
  })
})
