import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db'
import { isLocalOnlySetting } from '../../sync/outbox'
import { getPackRecord, installPack, packKey, removePack } from './packActions'
import { PACKS, packCounts } from './packDefs'

const career = PACKS.find((p) => p.id === 'career-lead')!
const money = PACKS.find((p) => p.id === 'money-basics')!

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-10T12:00:00'))
})

describe('starter packs', () => {
  it('installs everything with links and logs one event', async () => {
    const c = packCounts(career)
    const r = await installPack(career)
    expect(r).toEqual({ added: c.goals + c.learning + c.habits + c.tasks, skipped: 0 })
    expect(await db.goals.count()).toBe(c.goals)
    expect(await db.tasks.count()).toBe(c.tasks)
    const year = (await db.goals.where('horizon').equals('year').first())!
    const life = (await db.goals.where('horizon').equals('life').first())!
    expect(year.parentId).toBe(life.id)
    expect(year.milestones.length).toBeGreaterThan(3)
    const monthly = (await db.tasks.filter((t) => t.recurrence === 'monthly').first())!
    expect(monthly.recurDay).toBe(Number(monthly.due!.slice(8, 10)))
    expect((await db.events.filter((e) => e.kind === 'pack.installed').toArray()).length).toBe(1)
    expect(await getPackRecord(career.id)).not.toBeNull()
  })

  it('skips titles that already exist, case-insensitively, and does not double install', async () => {
    await db.tasks.add({ title: 'UPDATE NET WORTH', priority: 1, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() })
    await db.budgets.add({ category: 'groceries (edit me)', monthlyLimit: 1 })
    const r = await installPack(money)
    expect(r.skipped).toBe(2)
    expect(await db.tasks.count()).toBe(2)
    expect(await db.budgets.count()).toBe(5)
    expect(await installPack(money)).toEqual({ added: 0, skipped: 0 })
    expect(await db.tasks.count()).toBe(2)
  })

  it('removes untouched items but keeps edited, completed and checked-in ones', async () => {
    await installPack(career)
    const task = (await db.tasks.toCollection().first())!
    await db.tasks.update(task.id!, { title: 'My own wording' })
    const habit = (await db.habits.toCollection().first())!
    await db.habitLogs.add({ habitId: habit.id!, date: '2026-03-10' })
    const goal = (await db.goals.where('horizon').equals('quarter').first())!
    await db.goals.update(goal.id!, { milestones: goal.milestones.map((m, i) => ({ ...m, done: i === 0 })) })
    const total = (await db.goals.count()) + (await db.learning.count()) + (await db.habits.count()) + (await db.tasks.count())
    const r = await removePack(career.id)
    expect(r.kept).toBeGreaterThanOrEqual(3)
    expect(r.removed + r.kept).toBeGreaterThanOrEqual(total)
    expect((await db.tasks.get(task.id!))?.title).toBe('My own wording')
    expect(await db.habits.get(habit.id!)).toBeTruthy()
    expect(await db.goals.get(goal.id!)).toBeTruthy()
    // the kept goal's ancestors survive so nothing dangles
    expect(await db.goals.get(goal.parentId!)).toBeTruthy()
    expect(await getPackRecord(career.id)).toBeNull()
    expect(await db.events.filter((e) => e.kind === 'pack.installed').count()).toBe(0)
  })

  it('removes a fully untouched pack completely and leaves user data alone', async () => {
    await db.tasks.add({ title: 'Mine', priority: 1, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() })
    await installPack(money)
    const r = await removePack(money.id)
    expect(r.kept).toBe(0)
    expect(await db.budgets.count()).toBe(0)
    expect(await db.tasks.count()).toBe(1)
  })

  it('keeps pack bookkeeping device-local', () => {
    expect(isLocalOnlySetting(packKey('career-lead'))).toBe(true)
    expect(isLocalOnlySetting('theme')).toBe(false)
  })
})
