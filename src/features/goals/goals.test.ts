import { describe, expect, it } from 'vitest'
import { db, type Goal, type Task } from '../../db'
import { addMilestone, completeGoal, createGoal, removeMilestone, reopenGoal, setPaused, toggleMilestone, undoMilestone } from './goalActions'
import { goalProgress, newId, progressLabel } from './progress'

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 1, title: 'G', area: 'career', horizon: 'year', status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00Z', ...over,
})
const task = (over: Partial<Task>): Task => ({ title: 't', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-01-01T00:00:00Z', ...over })
const ms = (done: boolean, id = newId()) => ({ id, title: 'm', done })

describe('goalProgress', () => {
  it('milestones: done / total', () => {
    const p = goalProgress(goal({ milestones: [ms(true), ms(false), ms(false), ms(true)] }), [])
    expect(p).toMatchObject({ done: 2, total: 4, pct: 50, basis: 'milestones' })
    expect(progressLabel(p)).toBe('2/4 milestones')
  })
  it('milestones take precedence over linked tasks', () => {
    const p = goalProgress(goal({ milestones: [ms(false)] }), [task({ goalId: 1, status: 'done' })])
    expect(p).toMatchObject({ pct: 0, basis: 'milestones' })
  })
  it('falls back to linked tasks, ignoring other goals tasks', () => {
    const p = goalProgress(goal(), [task({ goalId: 1, status: 'done' }), task({ goalId: 1 }), task({ goalId: 1 }), task({ goalId: 2, status: 'done' })])
    expect(p.basis).toBe('tasks')
    expect(p.done).toBe(1)
    expect(p.total).toBe(3)
    expect(p.pct).toBeCloseTo(33.33, 1)
    expect(progressLabel(p)).toBe('1/3 tasks')
  })
  it('no milestones and no tasks -> zero', () => {
    const p = goalProgress(goal(), [task({ goalId: 9 })])
    expect(p).toEqual({ pct: 0, done: 0, total: 0, basis: 'none' })
    expect(progressLabel(p)).toBe('No milestones yet')
  })
  it('a done goal is 100% regardless of children', () => {
    expect(goalProgress(goal({ status: 'done', milestones: [ms(false)] }), []).pct).toBe(100)
    expect(goalProgress(goal({ status: 'done' }), []).pct).toBe(100)
  })
  it('newId is unique-ish and non-empty', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()))
    expect(ids.size).toBe(200)
  })
})

describe('goal actions (db)', () => {
  async function make(over: Partial<Omit<Goal, 'id' | 'milestones' | 'createdAt'>> = {}) {
    const id = await createGoal({ title: 'Ship it', area: 'career', horizon: 'quarter', status: 'active', ...over })
    return (await db.goals.get(id))!
  }

  it('completeGoal marks done and logs one milestone event; reopen undoes both', async () => {
    const g = await make()
    await completeGoal(g)
    expect((await db.goals.get(g.id!))!.status).toBe('done')
    expect((await db.goals.get(g.id!))!.completedAt).toBeTruthy()
    const evs = await db.events.toArray()
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ kind: 'goal.done', milestone: true, refTable: 'goals', refId: g.id, area: 'career' })

    await reopenGoal((await db.goals.get(g.id!))!)
    const after = (await db.goals.get(g.id!))!
    expect(after.status).toBe('active')
    expect(after.completedAt).toBeUndefined()
    expect(await db.events.count()).toBe(0)
  })

  it('reopen only removes the latest completion event', async () => {
    const g = await make()
    await completeGoal(g)
    await new Promise((r) => setTimeout(r, 3))
    await completeGoal(g)
    await reopenGoal(g)
    expect(await db.events.count()).toBe(1)
  })

  it('milestones: add, toggle logs only on completion, remove', async () => {
    let g = await make()
    await addMilestone(g, '  First  ')
    await addMilestone(g, '   ') // ignored
    g = (await db.goals.get(g.id!))!
    expect(g.milestones).toHaveLength(1)
    expect(g.milestones[0]).toMatchObject({ title: 'First', done: false })

    await toggleMilestone(g, g.milestones[0].id)
    g = (await db.goals.get(g.id!))!
    expect(g.milestones[0].done).toBe(true)
    expect(await db.events.count()).toBe(1)

    await toggleMilestone(g, g.milestones[0].id) // un-complete: no new event
    g = (await db.goals.get(g.id!))!
    expect(g.milestones[0].done).toBe(false)
    expect(await db.events.count()).toBe(1)

    await toggleMilestone(g, 'missing') // no-op
    await removeMilestone(g, g.milestones[0].id)
    expect((await db.goals.get(g.id!))!.milestones).toEqual([])
  })

  it('undoMilestone unchecks it and removes the event that check logged', async () => {
    let g = await make()
    await addMilestone(g, 'First')
    g = (await db.goals.get(g.id!))!
    await toggleMilestone(g, g.milestones[0].id)
    expect(await db.events.count()).toBe(1)
    await undoMilestone(g.id!, g.milestones[0].id)
    expect((await db.goals.get(g.id!))!.milestones[0].done).toBe(false)
    expect(await db.events.count()).toBe(0)
  })

  it('setPaused toggles status', async () => {
    const g = await make()
    await setPaused(g, true)
    expect((await db.goals.get(g.id!))!.status).toBe('paused')
    await setPaused(g, false)
    expect((await db.goals.get(g.id!))!.status).toBe('active')
  })
})
