import { describe, expect, it } from 'vitest'
import { generateInsights, nextBestAction, type Snapshot } from './engine'

const base: Snapshot = {
  today: '2026-10-29',
  tasks: [], goals: [], meals: [], transactions: [], budgets: [], studySessions: [], people: [], events: [],
  lastBackupAt: '2026-10-28T10:00:00.000Z',
}
const snap = (p: Partial<Snapshot>): Snapshot => ({ ...base, ...p })
const ids = (s: Snapshot) => generateInsights(s).map((i) => i.id)

const task = (o: object) => ({ title: 't', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-01-01T00:00:00.000Z', ...o }) as never
const goal = (o: object) => ({ id: 1, title: 'Ship it', area: 'career', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-08-01T00:00:00.000Z', ...o }) as never
const days = (...d: string[]) => d.map((date) => ({ itemId: 1, date, minutes: 20 })) as never

describe('generateInsights', () => {
  it('says nothing when there is nothing useful', () => {
    expect(generateInsights(base)).toEqual([])
  })

  it('flags a quarter goal with no recent progress, not a fresh one', () => {
    expect(ids(snap({ goals: [goal({})] }))).toContain('goal-drift')
    expect(ids(snap({ goals: [goal({ createdAt: '2026-10-25T00:00:00.000Z' })] }))).not.toContain('goal-drift')
  })

  it('does not flag drift when a linked task was completed recently', () => {
    const t = task({ goalId: 1, status: 'done', doneAt: '2026-10-20T12:00:00.000Z' })
    expect(ids(snap({ goals: [goal({})], tasks: [t] }))).not.toContain('goal-drift')
  })

  it('flags overdue pile-up only at 3 or more', () => {
    const o = task({ due: '2026-10-20' })
    expect(ids(snap({ tasks: [o, o] }))).not.toContain('overdue-pile')
    expect(ids(snap({ tasks: [o, o, o] }))).toContain('overdue-pile')
  })

  it('projects a budget overspend from pace', () => {
    const tx = [{ date: '2026-10-10', amount: -400, description: 'x', category: 'Dining' }] as never
    const r = generateInsights(snap({ today: '2026-10-15', transactions: tx, budgets: [{ category: 'Dining', monthlyLimit: 500 }] as never }))
    expect(r[0].id).toBe('budget-pace')
    expect(r[0].text).toContain('Dining')
  })

  it('does not flag a budget that is on pace', () => {
    const tx = [{ date: '2026-10-10', amount: -100, description: 'x', category: 'Dining' }] as never
    expect(ids(snap({ today: '2026-10-15', transactions: tx, budgets: [{ category: 'Dining', monthlyLimit: 500 }] as never }))).not.toContain('budget-pace')
  })

  it('names the biggest category mover versus the same point last month', () => {
    const tx = [
      { date: '2026-09-05', amount: -100, description: '', category: 'Dining' },
      { date: '2026-10-05', amount: -300, description: '', category: 'Dining' },
      { date: '2026-10-06', amount: -60, description: '', category: 'Gas' },
    ] as never
    const r = generateInsights(snap({ transactions: tx }))
    expect(r.find((i) => i.id === 'category-mover')?.text).toContain('Dining spending is $200 higher')
  })

  it('reports the savings rate change', () => {
    const tx = [
      { date: '2026-09-01', amount: 1000, description: '', category: 'Income' },
      { date: '2026-09-02', amount: -900, description: '', category: 'Housing' },
      { date: '2026-08-01', amount: 1000, description: '', category: 'Income' },
      { date: '2026-08-02', amount: -500, description: '', category: 'Housing' },
    ] as never
    expect(generateInsights(snap({ transactions: tx })).find((i) => i.id === 'savings-rate')?.text).toContain('fell 40 points')
  })

  it('flags food logging gaps only for someone who was logging', () => {
    const was = [{ date: '2026-10-12', slot: 'lunch', name: 'x' }] as never
    expect(ids(snap({ meals: was }))).toContain('food-gaps')
    const never = [{ date: '2026-10-28', slot: 'lunch', name: 'x' }] as never
    expect(ids(snap({ meals: never }))).not.toContain('food-gaps')
  })

  it('warns when a study streak would break today', () => {
    const s = days('2026-10-26', '2026-10-27', '2026-10-28')
    expect(ids(snap({ studySessions: s }))).toContain('study-streak')
    expect(ids(snap({ studySessions: days('2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29') }))).not.toContain('study-streak')
    expect(ids(snap({ studySessions: days('2026-10-27', '2026-10-28') }))).not.toContain('study-streak')
  })

  it('warns when a habit streak of 3+ would break tonight', () => {
    const habits = [{ id: 1, name: 'Walk', area: 'health', perWeek: 7, createdAt: '' }] as never
    const logs = (...d: string[]) => d.map((date) => ({ habitId: 1, date })) as never
    const three = logs('2026-10-26', '2026-10-27', '2026-10-28')
    expect(ids(snap({ habits, habitLogs: three, hour: 19 }))).toContain('habit-at-risk')
    expect(ids(snap({ habits, habitLogs: three, hour: 17 }))).not.toContain('habit-at-risk')
    expect(ids(snap({ habits, habitLogs: logs('2026-10-27', '2026-10-28'), hour: 19 }))).not.toContain('habit-at-risk')
    expect(ids(snap({ habits, habitLogs: logs('2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29'), hour: 19 }))).not.toContain('habit-at-risk')
  })

  it('notes a calendar-heavy day at 5+ events', () => {
    const cal = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `e${i}`, date: '2026-10-29', allDay: true })) as never
    expect(ids(snap({ calendar: cal(5) }))).toContain('busy-day')
    expect(ids(snap({ calendar: cal(4) }))).not.toContain('busy-day')
  })

  it('names the most overdue people and upcoming birthdays', () => {
    const people = [
      { id: 1, name: 'Ana', relation: '', cadenceDays: 7, lastContact: '2026-10-01', birthday: '11-02' },
      { id: 2, name: 'Ben', relation: '', cadenceDays: 14, lastContact: '2026-10-10' },
    ] as never
    const r = generateInsights(snap({ people }))
    expect(r.find((i) => i.id === 'people-overdue')?.text).toContain('Ana')
    expect(r.find((i) => i.id === 'birthdays')?.text).toContain('in 4 days')
  })

  it('handles a birthday that wraps the year', () => {
    const people = [{ id: 1, name: 'Cy', relation: '', cadenceDays: 0, birthday: '01-01' }] as never
    expect(ids(snap({ today: '2026-12-30', people }))).toContain('birthdays')
  })

  it('nudges when the backup is stale or missing, but not for empty apps', () => {
    const t = [task({})]
    expect(ids(snap({ tasks: t, lastBackupAt: '2026-09-01T00:00:00.000Z' }))).toContain('backup')
    expect(ids(snap({ tasks: t, lastBackupAt: null }))).toContain('backup')
    expect(ids(snap({ lastBackupAt: null }))).not.toContain('backup')
  })

  it('celebrates a protein streak and weekly milestones', () => {
    const meals = ['2026-10-27', '2026-10-28', '2026-10-29'].map((date) => ({ date, slot: 'lunch', name: 'x', protein: 150 })) as never
    const events = [{ at: '2026-10-27T10:00:00.000Z', area: 'career', kind: 'goal.done', title: 'Ship v1', milestone: true }] as never
    const r = ids(snap({ meals, proteinTarget: 140, events }))
    expect(r).toContain('protein-streak')
    expect(r).toContain('wins')
  })

  it('caps at 5 and ranks the most useful first', () => {
    const o = task({ due: '2026-10-01' })
    const r = generateInsights(
      snap({
        goals: [goal({})], tasks: [o, o, o], lastBackupAt: null,
        people: [{ id: 1, name: 'Ana', relation: '', cadenceDays: 7, lastContact: '2026-09-01', birthday: '10-30' }] as never,
        studySessions: days('2026-10-26', '2026-10-27', '2026-10-28'),
        events: [{ at: '2026-10-28T10:00:00.000Z', area: 'career', kind: 'k', title: 'W', milestone: true }] as never,
      }),
    )
    expect(r).toHaveLength(5)
    expect(r[0].id).toBe('goal-drift')
    expect(r.map((i) => i.score)).toEqual([...r.map((i) => i.score)].sort((a, b) => b - a))
  })
})

describe('nextBestAction', () => {
  it('guides a new user to add a task, then a goal', () => {
    expect(nextBestAction(base)?.href).toBe('/tasks')
    expect(nextBestAction(snap({ tasks: [task({})] }))?.href).toBe('/goals')
  })
})
