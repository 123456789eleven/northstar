import { describe, expect, it } from 'vitest'
import { db } from '../../db'
import { addGoal, addHabit, addPerson, addTasks, saveBudgets } from './setupActions'
import { parseTaskLines } from './setupLogic'

describe('setup actions', () => {
  it('does not duplicate habits, goals or people by name', async () => {
    expect(await addHabit({ name: 'Stretch' })).toBe('added')
    expect(await addHabit({ name: ' stretch ' })).toBe('duplicate')
    expect(await addGoal('Be a manager', 'life', 'career')).toBe('added')
    expect(await addGoal('be a MANAGER', 'quarter', 'career')).toBe('duplicate')
    expect(await addPerson({ name: 'Sam', relation: 'Friend', cadenceDays: 30 })).toBe('added')
    expect(await addPerson({ name: 'sam', relation: 'Friend', cadenceDays: 30 })).toBe('duplicate')
    expect(await db.habits.count()).toBe(1)
  })

  it('parents a quarter goal under the single life goal', async () => {
    await addGoal('Be a manager', 'life', 'career')
    await addGoal('Ship the guide', 'quarter', 'career', '2026-12-31')
    const life = await db.goals.where('horizon').equals('life').first()
    const q = await db.goals.where('horizon').equals('quarter').first()
    expect(q?.parentId).toBe(life?.id)
    expect(q?.targetDate).toBe('2026-12-31')
  })

  it('saves only changed budgets and logs the first one once', async () => {
    expect(await saveBudgets({ Housing: 1500, Dining: undefined })).toBe(1)
    expect(await saveBudgets({ Housing: 1500, Gas: 100 })).toBe(1)
    expect(await db.budgets.count()).toBe(2)
    expect(await db.events.where('area').equals('finance').count()).toBe(1)
  })

  it('adds tasks once and skips ones already open', async () => {
    const lines = parseTaskLines('call HR\nCall hr\nbuy stamps')
    const first = await addTasks(lines)
    expect(first.added).toBe(2)
    const again = await addTasks(parseTaskLines('buy stamps'))
    expect(again).toEqual({ added: 0, skipped: 1 })
  })
})
