import { describe, expect, it } from 'vitest'
import type { Goal } from '../../db'
import { nextStepAfterGoal, nextStepAfterMilestone } from './completion'

const g = (id: number, over: Partial<Goal> = {}): Goal => ({ id, title: `G${id}`, area: 'career', horizon: 'quarter', status: 'active', milestones: [], createdAt: `2026-01-0${id}T00:00:00Z`, ...over })

describe('nextStepAfterGoal', () => {
  it('points at the next open sibling under the same parent, earliest target first', () => {
    const all = [g(1, { horizon: 'year' }), g(2, { parentId: 1 }), g(3, { parentId: 1, targetDate: '2026-12-01' }), g(4, { parentId: 1, targetDate: '2026-11-01' })]
    expect(nextStepAfterGoal(all[1], all)).toEqual({ kind: 'sibling', text: 'Next: G4' })
  })
  it('offers to plan the next child when the parent has nothing else open', () => {
    const all = [g(1, { horizon: 'year' }), g(2, { parentId: 1 }), g(3, { parentId: 1, status: 'done' })]
    const r = nextStepAfterGoal(all[1], all)
    expect(r.kind).toBe('add-child')
    expect(r.kind === 'add-child' && r.parent.id).toBe(1)
  })
  it('falls back to a quiet line for a lone goal', () => {
    expect(nextStepAfterGoal(g(1, { horizon: 'life' }), [g(1, { horizon: 'life' })]).kind).toBe('none')
  })
})

describe('nextStepAfterMilestone', () => {
  const goal = g(1, { milestones: [{ id: 'a', title: 'A', done: true }, { id: 'b', title: 'B', done: false }, { id: 'c', title: 'C', done: false }] })
  it('reports progress and the next open milestone', () => {
    expect(nextStepAfterMilestone(goal, 'b')).toEqual({ text: '2 of 3 milestones. Next: C', allDone: false })
  })
  it('flags the last one', () => {
    const almost = { ...goal, milestones: goal.milestones.map((m) => ({ ...m, done: m.id !== 'c' })) }
    expect(nextStepAfterMilestone(almost, 'c').allDone).toBe(true)
  })
})
