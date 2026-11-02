import { describe, expect, it } from 'vitest'
import { emptyMetricData } from '../progress/metrics'
import { buildWeekNumbers, type WeekInput } from './weekNumbers'

const WEEK = '2026-11-02'
const NOW = '2026-11-08'
const input = (over: Partial<WeekInput> = {}, data = {}): WeekInput => ({ data: { ...emptyMetricData(NOW), ...data }, goals: [], journal: [], interactions: [], trainDays: 4, ...over })
const by = (items: ReturnType<typeof buildWeekNumbers>, key: string) => items.find((i) => i.key === key)!

describe('buildWeekNumbers', () => {
  it('shows honest no-data states for an empty week (no NaN)', () => {
    const items = buildWeekNumbers(input(), WEEK, NOW)
    expect(items.map((i) => i.key)).toEqual(['weight', 'protein', 'calories', 'workouts', 'study', 'spend', 'journal', 'contacts', 'goals'])
    for (const i of items) {
      expect(i.empty).toBe(true)
      expect(i.value).toBe('No data')
      expect(i.value + i.note).not.toMatch(/NaN|undefined|Infinity/)
    }
  })

  it('fills each item from real rows', () => {
    const items = buildWeekNumbers(
      input(
        {
          journal: [{ date: '2026-11-03', text: 'one two three', createdAt: '' }, { date: '2026-11-04', text: 'four five', createdAt: '' }],
          interactions: [{ personId: 1, date: '2026-11-03', kind: 'call' }, { personId: 1, date: '2026-11-04', kind: 'text' }, { personId: 2, date: '2026-11-05', kind: 'text' }],
          goals: [{ id: 1, title: 'Reach 142 lb', area: 'health', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-10-01T00:00:00', metric: { source: 'weight', target: 142, window: 'goal' } }],
        },
        {
          weights: [{ date: '2026-10-28', weight: 136 }, { date: '2026-11-03', weight: 137 }, { date: '2026-11-06', weight: 138 }],
          startWeight: 135,
          targets: { protein: 100 },
          meals: [{ date: '2026-11-03', slot: 'lunch', name: 'x', protein: 120 }],
          studySessions: [{ itemId: 1, date: '2026-11-04', minutes: 40 }],
          transactions: [{ date: '2026-11-03', amount: -50, description: 'x', category: 'Food' }, { date: '2026-11-03', amount: -500, description: 'x', category: 'Savings/Transfer' }],
          budgets: [{ category: 'Food', monthlyLimit: 400 }],
          habits: [{ id: 1, name: 'Lift', area: 'health', perWeek: 4, createdAt: '' }],
          habitLogs: [{ habitId: 1, date: '2026-11-03' }, { habitId: 1, date: '2026-11-05' }],
        },
      ),
      WEEK,
      NOW,
    )
    expect(by(items, 'weight').value).toBe('+1.5 lb')
    expect(by(items, 'protein').value).toBe('1 of 7')
    expect(by(items, 'calories').empty).toBe(true)
    expect(by(items, 'workouts').value).toBe('2 of 4')
    expect(by(items, 'workouts').note).toBe('2 workouts short of your weekly target.')
    expect(by(items, 'study').value).toBe('40 min')
    expect(by(items, 'spend').value).toBe('$50')
    expect(by(items, 'spend').note).toContain('$50 of $400')
    expect(by(items, 'journal').value).toBe('2 of 7 days')
    expect(by(items, 'journal').note).toBe('5 words written.')
    expect(by(items, 'contacts').value).toBe('2')
    expect(by(items, 'goals').value).toBe('1 goal moved')
    expect(by(items, 'goals').lines![0]).toMatch(/^Reach 142 lb: \+\d+ points/)
  })
})
