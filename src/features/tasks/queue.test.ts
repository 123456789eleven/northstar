import { describe, expect, it } from 'vitest'
import type { Task } from '../../db'
import { groupOpenTasks, queueOrder, selectionAfterRemoval, stepSelection } from './queue'

const t = (id: number, over: Partial<Task> = {}): Task => ({ id, title: `t${id}`, priority: 2, status: 'open', recurrence: 'none', createdAt: `2026-01-0${id}T00:00:00.000Z`, ...over })

describe('groupOpenTasks', () => {
  const d = '2026-10-30'
  const tasks = [
    t(1, { due: '2026-10-20' }),
    t(2, { due: d }),
    t(3, { due: '2026-11-02' }),
    t(4, { due: '2026-12-25' }),
    t(5),
    t(6, { due: d, status: 'done' }),
  ]
  it('buckets open tasks by due date and drops empty groups and done tasks', () => {
    const g = groupOpenTasks(tasks, d)
    expect(g.map((x) => [x.key, x.tasks.map((y) => y.id)])).toEqual([['overdue', [1]], ['today', [2]], ['week', [3]], ['later', [4]], ['none', [5]]])
    expect(groupOpenTasks([t(5)], d).map((x) => x.key)).toEqual(['none'])
  })
  it('flattens in display order', () => {
    expect(queueOrder(groupOpenTasks(tasks, d))).toEqual([1, 2, 3, 4, 5])
  })
})

describe('selection', () => {
  const order = [1, 2, 3]
  it('steps and clamps', () => {
    expect(stepSelection(order, 1, 1)).toBe(2)
    expect(stepSelection(order, 3, 1)).toBe(3)
    expect(stepSelection(order, 1, -1)).toBe(1)
  })
  it('starts at the first item when nothing is active or the id vanished', () => {
    expect(stepSelection(order, null, 1)).toBe(1)
    expect(stepSelection(order, 99, -1)).toBe(1)
    expect(stepSelection([], null, 1)).toBeNull()
  })
  it('picks the neighbour after removal', () => {
    expect(selectionAfterRemoval([1, 2, 3], 2, [1, 3])).toBe(3)
    expect(selectionAfterRemoval([1, 2, 3], 3, [1, 2])).toBe(2)
    expect(selectionAfterRemoval([1], 1, [])).toBeNull()
  })
})
