import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, setSetting } from '../../db'
import { addDays } from '../../lib/dates'
import { applyFoodTargets, logWeight, removeWeight } from './bodyData'

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(2026, 2, 20, 9, 0)) })
afterEach(() => vi.useRealTimers())

describe('logWeight', () => {
  it('one row per date; logging again updates it and its event', async () => {
    await logWeight('2026-03-20', 135)
    await logWeight('2026-03-20', 136.44)
    const rows = await db.weights.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].weight).toBe(136.4)
    const evs = await db.events.where('area').equals('body').toArray()
    expect(evs.filter((e) => e.kind === 'body.weight')).toHaveLength(1)
    expect(evs[0].title).toBe('Weighed 136.4 lb')
  })
  it('rejects nonsense', async () => {
    expect(await logWeight('2026-03-20', 5)).toBeNull()
    expect(await db.weights.count()).toBe(0)
  })
  it('undo of a new log removes the row and event; undo of an update restores', async () => {
    const a = await logWeight('2026-03-20', 135)
    const b = await logWeight('2026-03-20', 137)
    await b!.undo()
    expect((await db.weights.toArray())[0].weight).toBe(135)
    expect((await db.events.toArray())[0].title).toBe('Weighed 135 lb')
    await a!.undo()
    expect(await db.weights.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
  })
  it('milestone fires once when the 7-day average first passes a step, and undoes with the log', async () => {
    await logWeight('2026-03-10', 135)
    const r = await logWeight('2026-03-11', 146) // avg 140.5 crosses 140
    expect(r!.milestones).toEqual([140])
    const again = await logWeight('2026-03-12', 146)
    expect(again!.milestones).toEqual([])
    const ms = await db.events.filter((e) => e.kind === 'body.milestone').toArray()
    expect(ms).toHaveLength(1)
    expect(ms[0].milestone).toBe(true)
    await r!.undo()
    expect(await db.events.filter((e) => e.kind === 'body.milestone').count()).toBe(0)
  })
  it('uses a stored starting weight when set', async () => {
    await setSetting('body.startWeight', 100)
    const r = await logWeight(addDays('2026-03-20', 0), 106)
    expect(r!.milestones).toEqual([105])
  })
})

describe('removeWeight / targets', () => {
  it('remove deletes row and events; undo restores them', async () => {
    await logWeight('2026-03-20', 135)
    const id = (await db.weights.toArray())[0].id!
    const undo = await removeWeight(id)
    expect(await db.weights.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
    await undo!()
    expect(await db.weights.count()).toBe(1)
    expect(await db.events.count()).toBe(1)
  })
  it('writes the Food targets key, keeping other fields', async () => {
    await setSetting('food.targets', { calories: 2000 })
    await applyFoodTargets({ protein: 110 })
    expect((await db.settings.get('food.targets'))!.value).toEqual({ calories: 2000, protein: 110 })
  })
})
