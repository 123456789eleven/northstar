import { describe, expect, it } from 'vitest'
import { dailyFind, proteinFind, spendFind, workoutsFind } from './dailyFind'

const D = '2026-11-04' // Wednesday; week starts Mon 2026-11-02

describe('daily find', () => {
  it('is null with no data', () => {
    expect(dailyFind({ workouts: [], meals: [], transactions: [], budgets: [] }, D)).toBeNull()
  })
  it('workouts this week vs last', () => {
    expect(workoutsFind(['2026-11-02T10:00:00', '2026-11-03T10:00:00', '2026-10-28T10:00:00'], D)).toBe('2 workouts logged this week, 1 last week.')
    expect(workoutsFind(['2026-11-03T10:00:00'], D)).toBe('1 workout logged this week.')
    expect(workoutsFind(['2026-10-28T10:00:00'], D)).toBeNull()
  })
  it('protein days vs the week before', () => {
    const meals = [
      { date: '2026-11-04', protein: 30 }, { date: '2026-11-03', protein: 20 }, { date: '2026-11-03', protein: 10 },
      { date: '2026-10-28', protein: 40 }, { date: '2026-11-01', protein: 0 },
    ]
    expect(proteinFind(meals, D)).toBe('Protein logged on 2 of the last 7 days, 1 the week before.')
    expect(proteinFind([], D)).toBeNull()
  })
  it('spend vs budget pace, only budgeted categories this month', () => {
    const txs = [
      { date: '2026-11-02', amount: -150, category: 'Food' },
      { date: '2026-11-03', amount: -50, category: 'Other' },
      { date: '2026-10-30', amount: -900, category: 'Food' },
      { date: '2026-11-03', amount: 500, category: 'Food' },
    ]
    expect(spendFind(txs, [{ category: 'Food', monthlyLimit: 500 }], D)).toBe("Budgeted spending is at 30% of the month's limits, with 13% of the month gone.")
    expect(spendFind(txs, [], D)).toBeNull()
  })
  it('rotates deterministically by day among available sentences', () => {
    const input = { workouts: ['2026-11-03T10:00:00'], meals: [{ date: '2026-11-04', protein: 9 }], transactions: [], budgets: [] }
    const a = dailyFind(input, D)
    expect(a).toBe(dailyFind(input, D))
    expect(dailyFind(input, '2026-11-05')).not.toBe(a)
    expect(a).toMatch(/\.$/)
  })
})
