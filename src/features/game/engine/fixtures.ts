// Fictional test data builders (no real person data).
import type { Goal, Habit, Person, Task } from '../../../db'
import { emptySnapshot, type Snapshot } from './snapshot'

export const TODAY = '2026-11-02' // a Monday
export const snap = (p: Partial<Snapshot> = {}): Snapshot => ({ ...emptySnapshot(), ...p })
export const goal = (p: Partial<Goal> & { id: number }): Goal => ({ title: 'Goal', area: 'personal', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00Z', ...p })
export const habit = (p: Partial<Habit> & { id: number }): Habit => ({ name: 'Read', area: 'personal', perWeek: 7, createdAt: '2026-01-01T00:00:00Z', ...p })
export const task = (p: Partial<Task> & { id: number }): Task => ({ title: 'Task', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-01-01T00:00:00Z', ...p })
export const person = (p: Partial<Person> & { id: number }): Person => ({ name: 'Sam', relation: 'friend', cadenceDays: 14, ...p })

/** The owner's setup, fictional numbers. */
export function ownerSnapshot(extra: Partial<Snapshot> = {}): Snapshot {
  return snap({
    goals: [goal({ id: 1, title: 'Reach 165 lb', area: 'health', metric: { source: 'weight', target: 165 } }), goal({ id: 2, title: 'Get promoted', area: 'career' })],
    habits: [habit({ id: 1, name: 'Lift', perWeek: 4, goalId: 1 })],
    targets: { protein: 140, calories: 2400 },
    budgets: [{ id: 1, category: 'Groceries', monthlyLimit: 500 }],
    people: [person({ id: 1, name: 'Alex Example', cadenceDays: 7, lastContact: '2026-10-10' })],
    ...extra,
  })
}
