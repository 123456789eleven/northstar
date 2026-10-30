import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getSetting } from '../../db'
import { IMPORTS_KEY } from '../finance/model'
import { addBulk, loadBulkContext } from './bulkData'
import { okItems, parseBulk, type BulkKind } from './parse'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-30T12:00:00'))
})
afterEach(() => vi.useRealTimers())

async function run(kind: BulkKind, text: string) {
  const c = await loadBulkContext(kind)
  const res = parseBulk(kind, text, { now: new Date(), ...c })
  return { res, added: await addBulk(kind, okItems(res)) }
}

describe('addBulk + undo', () => {
  it('adds tasks and undo removes exactly those, leaving older rows', async () => {
    await db.tasks.add({ title: 'existing', priority: 2, status: 'open', recurrence: 'none', createdAt: 'x' })
    const { added } = await run('tasks', 'call mom tomorrow !1\nPay rent every month\nexisting')
    expect(added.count).toBe(2)
    const rows = await db.tasks.toArray()
    expect(rows.map((t) => t.title).sort()).toEqual(['Pay rent', 'call mom', 'existing'])
    expect(rows.find((t) => t.title === 'call mom')).toMatchObject({ due: '2026-10-31', priority: 1, status: 'open' })
    await added.undo()
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['existing'])
  })

  it('people: second paste of the same names is all duplicates', async () => {
    const first = await run('people', 'Alex, Friend, every 14 days, 03-14\nMom')
    expect(first.added.count).toBe(2)
    expect(await db.people.toArray()).toHaveLength(2)
    const second = await run('people', 'alex\nDad')
    expect(second.res.rows.map((r) => r.status)).toEqual(['duplicate', 'ok'])
    await second.added.undo()
    expect((await db.people.toArray()).map((p) => p.name).sort()).toEqual(['Alex', 'Mom'])
  })

  it('goals and habits and meals round-trip', async () => {
    const g = await run('goals', 'Run a half marathon, health, by Dec 31')
    expect(await db.goals.toArray()).toMatchObject([{ title: 'Run a half marathon', area: 'health', targetDate: '2026-12-31', status: 'active', milestones: [] }])
    await g.added.undo()
    expect(await db.goals.count()).toBe(0)
    const h = await run('habits', 'Meditate\nRun 3x')
    expect((await db.habits.toArray()).map((x) => x.perWeek).sort()).toEqual([3, 7])
    await h.added.undo()
    expect(await db.habits.count()).toBe(0)
    const m = await run('meals', 'oatmeal 350cal for breakfast')
    expect(await db.meals.toArray()).toMatchObject([{ name: 'oatmeal', calories: 350, slot: 'breakfast', date: '2026-10-30' }])
    await m.added.undo()
    expect(await db.meals.count()).toBe(0)
  })

  it('transactions: tagged to a batch with one event; undo removes rows, record and event only for that batch', async () => {
    await db.transactions.add({ date: '2026-01-01', amount: -1, description: 'old', category: 'Uncategorized' })
    const { added } = await run('transactions', 'Kroger 42.50\nPaycheck +1200')
    expect(added.count).toBe(2)
    const rows = await db.transactions.toArray()
    expect(rows).toHaveLength(3)
    expect(rows.filter((t) => t.importBatch)).toHaveLength(2)
    expect(await db.events.count()).toBe(1)
    expect(await getSetting(IMPORTS_KEY, [])).toHaveLength(1)
    await added.undo()
    expect((await db.transactions.toArray()).map((t) => t.description)).toEqual(['old'])
    expect(await db.events.count()).toBe(0)
    expect(await getSetting(IMPORTS_KEY, [])).toHaveLength(0)
  })

  it('an empty add is a no-op', async () => {
    const { added } = await run('tasks', '')
    expect(added.count).toBe(0)
    await added.undo()
  })
})
