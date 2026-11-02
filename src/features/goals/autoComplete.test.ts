import { describe, expect, it } from 'vitest'
import { db } from '../../db'
import { autoCompleteGoal, createGoal, setGoalMetric, undoAutoComplete } from './goalActions'

const make = async (metric?: Parameters<typeof setGoalMetric>[1]) => (await
  createGoal({ title: 'Reach 142 lb', area: 'health', horizon: 'quarter', status: 'active', metric })) as number

describe('auto-complete (db)', () => {
  it('completes a tracked goal, logs one milestone event; undo reopens, removes the event and holds auto-complete', async () => {
    const id = await make({ source: 'weight', target: 142 })
    expect(await autoCompleteGoal(id)).toBe(true)
    expect((await db.goals.get(id))!.status).toBe('done')
    const evs = await db.events.toArray()
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ kind: 'goal.done', milestone: true, refTable: 'goals', refId: id })
    // Already done: a second pass does nothing and logs nothing.
    expect(await autoCompleteGoal(id)).toBe(false)
    expect(await db.events.count()).toBe(1)

    await undoAutoComplete(id)
    const g = (await db.goals.get(id))!
    expect(g.status).toBe('active')
    expect(g.completedAt).toBeUndefined()
    expect(g.metric).toMatchObject({ source: 'weight', target: 142, autoComplete: false })
    expect(await db.events.count()).toBe(0)
    // Held: does not complete again by itself.
    expect(await autoCompleteGoal(id)).toBe(false)
    expect((await db.goals.get(id))!.status).toBe('active')
  })

  it('never completes goals without a real metric', async () => {
    const none = await make()
    const manual = await make({ source: 'manual', target: 1 })
    expect(await autoCompleteGoal(none)).toBe(false)
    expect(await autoCompleteGoal(manual)).toBe(false)
    expect(await db.events.count()).toBe(0)
  })

  it('setGoalMetric returns an undo that restores the previous metric', async () => {
    const id = await make()
    const undo = await setGoalMetric(id, { source: 'workouts', target: 4, window: 'week' })
    expect((await db.goals.get(id))!.metric?.source).toBe('workouts')
    await undo()
    expect((await db.goals.get(id))!.metric).toBeUndefined()
  })
})
