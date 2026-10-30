import { describe, expect, it } from 'vitest'
import type { Task } from '../../db'
import { buildTodayView } from './todayQueue'

const d = '2026-10-30'
const t = (id: number, o: Partial<Task> = {}): Task => ({ id, title: `t${id}`, priority: 2, status: 'open', recurrence: 'none', createdAt: `2026-01-0${id}T00:00:00.000Z`, ...o })

describe('buildTodayView', () => {
  it('never lists a task in two sections', () => {
    const tasks = [t(1, { due: '2026-10-20', focusDate: d }), t(2, { due: d }), t(3, { due: '2026-10-25' }), t(4, { status: 'done', doneAt: `${d}T10:00:00.000Z`, due: d, focusDate: d }), t(5, { status: 'done', doneAt: `${d}T09:00:00.000Z`, due: d })]
    const v = buildTodayView(tasks, d)
    const all = [...v.focus, ...v.suggestions, ...v.due, ...v.done].map((x) => x.id)
    expect(new Set(all).size).toBe(all.length)
    expect(v.focus.map((x) => x.id).sort()).toEqual([1, 4])
    expect(v.due.map((x) => x.id)).toEqual([3, 2])
    expect(v.done.map((x) => x.id)).toEqual([5])
  })
  it('suggestions are also removed from the due list', () => {
    const tasks = [t(1, { due: '2026-10-20' }), t(2, { due: d }), t(3)]
    const v = buildTodayView(tasks, d)
    expect(v.focus).toEqual([])
    expect(v.suggestions.map((x) => x.id)).toEqual([1, 2, 3])
    expect(v.due).toEqual([])
    expect(v.overdueCount).toBe(1)
    expect(v.dueTodayCount).toBe(1)
  })
})
