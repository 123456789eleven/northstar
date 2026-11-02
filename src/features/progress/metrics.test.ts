import { describe, expect, it } from 'vitest'
import type { Goal } from '../../db'
import { computeMetric, emptyMetricData, suggestLinks, weightAverage, type MetricData } from './metrics'

const TODAY = '2026-11-04' // Wednesday; week starts 2026-11-02
const base = (over: Partial<MetricData> = {}): MetricData => ({ ...emptyMetricData(TODAY), ...over })
const finite = (r: ReturnType<typeof computeMetric>) => {
  expect(r).not.toBeNull()
  for (const n of [r!.pct, r!.target, r!.value ?? 0]) expect(Number.isFinite(n)).toBe(true)
}

describe('every source with empty data', () => {
  for (const source of ['weight', 'protein-days', 'calorie-days', 'workouts', 'study-minutes', 'under-budget', 'net-worth'] as const) {
    it(source, () => {
      const r = computeMetric({ source, target: 0 }, base())
      finite(r)
      expect(r!.hasData).toBe(false)
      expect(r!.met).toBe(false)
      expect(r!.pct).toBe(0)
    })
  }
  it('manual yields null', () => expect(computeMetric({ source: 'manual', target: 1 }, base())).toBeNull())
})

describe('weight', () => {
  const weights = [
    { date: '2026-10-26', weight: 137 }, { date: '2026-10-28', weight: 137 },
    { date: '2026-11-02', weight: 139 }, { date: '2026-11-04', weight: 141 },
  ]
  it('7-day average vs start and target (up)', () => {
    const r = computeMetric({ source: 'weight', target: 165 }, base({ weights, startWeight: 135 }))!
    expect(r.value).toBe(140)
    expect(r.pct).toBeCloseTo((5 / 30) * 100, 5)
    expect(r.label).toBe('140 of 165 lb')
    expect(r.note).toBe('+3 lb vs the 7 days before')
    expect(r.met).toBe(false)
  })
  it('falls back to the earliest weigh-in as start and is direction aware (down)', () => {
    const r = computeMetric({ source: 'weight', target: 150, direction: 'down' }, base({ weights: [{ date: '2026-11-01', weight: 160 }, { date: '2026-11-04', weight: 155 }] }))!
    expect(r.value).toBe(157.5)
    expect(r.pct).toBeCloseTo(25, 5)
  })
  it('met when the average reaches the target; target equal to start does not divide by zero', () => {
    expect(computeMetric({ source: 'weight', target: 140 }, base({ weights, startWeight: 135 }))!.met).toBe(true)
    finite(computeMetric({ source: 'weight', target: 135 }, base({ weights: [{ date: TODAY, weight: 135 }] })))
  })
  it('weightAverage is null with no rows in range', () => expect(weightAverage([], TODAY)).toBeNull())
})

describe('protein-days and calorie-days', () => {
  const meal = (date: string, protein: number, calories = 0) => ({ date, slot: 'lunch' as const, name: 'x', protein, calories })
  const meals = [meal('2026-11-02', 100, 2000), meal('2026-11-03', 96, 1900), meal('2026-11-03', 0, 100), meal('2026-11-04', 80, 1000), meal('2026-10-30', 100, 2000)]
  it('counts days >=95% of the target within the week', () => {
    const r = computeMetric({ source: 'protein-days', target: 6 }, base({ meals, targets: { protein: 100 } }))!
    expect(r.value).toBe(2)
    expect(r.label).toBe('2 of 6 days this week')
    expect(r.note).toBe('Last week: 1')
    expect(r.pct).toBeCloseTo(33.33, 1)
  })
  it('calories use the calorie target; no target means no data', () => {
    expect(computeMetric({ source: 'calorie-days', target: 5 }, base({ meals, targets: { calories: 2000 } }))!.value).toBe(2)
    expect(computeMetric({ source: 'protein-days', target: 6 }, base({ meals }))!.hasData).toBe(false)
  })
  it('met at the target', () => {
    const m = [0, 1, 2].map((i) => meal(`2026-11-0${2 + i}`, 100))
    expect(computeMetric({ source: 'protein-days', target: 3 }, base({ meals: m, targets: { protein: 100 } }))!.met).toBe(true)
  })
})

describe('workouts', () => {
  it('counts distinct days of lift-like habit check-ins', () => {
    const d = base({
      habits: [{ id: 1, name: 'Lift weights', area: 'health', perWeek: 4, createdAt: '' }, { id: 2, name: 'Read', area: 'personal', perWeek: 7, createdAt: '' }],
      habitLogs: [{ habitId: 1, date: '2026-11-02' }, { habitId: 1, date: '2026-11-02' }, { habitId: 1, date: '2026-11-04' }, { habitId: 2, date: '2026-11-03' }, { habitId: 1, date: '2026-10-28' }],
    })
    const r = computeMetric({ source: 'workouts', target: 4 }, d)!
    expect(r.value).toBe(2)
    expect(r.label).toBe('2 of 4 workouts this week')
    expect(r.note).toBe('Last week: 1')
  })
  it('falls back to events', () => {
    const d = base({ events: [{ at: '2026-11-03T12:00:00', area: 'health', kind: 'workout.logged', title: 'Gym', milestone: false }, { at: '2026-11-03T13:00:00', area: 'health', kind: 'goal.done', title: 'Lift 4 times', milestone: true }] })
    expect(computeMetric({ source: 'workouts', target: 4 }, d)!.value).toBe(1)
  })
})

describe('study-minutes', () => {
  it('sums the window', () => {
    const d = base({ studySessions: [{ itemId: 1, date: '2026-11-02', minutes: 30 }, { itemId: 1, date: '2026-11-03', minutes: 45 }, { itemId: 1, date: '2026-10-20', minutes: 99 }] })
    const r = computeMetric({ source: 'study-minutes', target: 150 }, d)!
    expect(r.value).toBe(75)
    expect(r.pct).toBe(50)
  })
})

describe('under-budget', () => {
  const tx = (amount: number, category: string, date = '2026-11-02') => ({ date, amount, description: 'x', category })
  const d = base({ budgets: [{ category: 'Food', monthlyLimit: 500 }], transactions: [tx(-200, 'Food'), tx(-50, 'Other'), tx(3000, 'Income')] })
  it('compares budgeted categories only and is not met mid-month', () => {
    const r = computeMetric({ source: 'under-budget', target: 100 }, d)!
    expect(r.value).toBe(200)
    expect(r.pct).toBe(100)
    expect(r.met).toBe(false)
    expect(r.label).toBe('$200 of $500 budget')
    expect(r.note).toBe('$300 left this month')
  })
  it('over budget shrinks the bar; met at month end when under', () => {
    const over = computeMetric({ source: 'under-budget', target: 100 }, { ...d, transactions: [tx(-1000, 'Food')] })!
    expect(over.pct).toBe(50)
    expect(over.note).toBe('$500 over this month')
    expect(computeMetric({ source: 'under-budget', target: 100 }, { ...d, today: '2026-11-30' })!.met).toBe(true)
  })
  it('applies the bill set-aside', () => {
    const bills = [{ id: 'b', name: 'Ins', amount: 600, everyMonths: 6, lastPaid: '2026-10-01', category: 'Food' }]
    const r = computeMetric({ source: 'under-budget', target: 100 }, { ...d, bills, transactions: [tx(-600, 'Food')] })!
    expect(r.value).toBe(100)
  })
})

describe('net-worth', () => {
  it('latest snapshot vs first', () => {
    const balances = [
      { date: '2026-09-01', name: 'A', kind: 'asset' as const, balance: 1000 },
      { date: '2026-11-01', name: 'A', kind: 'asset' as const, balance: 3000 },
      { date: '2026-11-01', name: 'L', kind: 'liability' as const, balance: 1000 },
    ]
    const r = computeMetric({ source: 'net-worth', target: 5000 }, base({ balances }))!
    expect(r.value).toBe(2000)
    expect(r.pct).toBe(25)
    expect(r.met).toBe(false)
  })
})

describe('suggestLinks', () => {
  const g = (id: number, title: string, over: Partial<Goal> = {}): Goal => ({ id, title, area: 'health', horizon: 'quarter', status: 'active', milestones: [], createdAt: '', ...over })
  it('matches the owner goals and skips linked/done ones', () => {
    const s = suggestLinks([
      g(1, 'Reach 142 lb'), g(2, 'Hit the protein target 6 days a week'), g(3, 'Lift 4 times a week for 12 weeks'),
      g(4, 'Gain 30 lb lean'), g(5, 'Reach 150 lb', { status: 'done' }), g(6, 'Lift 3 times', { metric: { source: 'workouts', target: 3 } }), g(7, 'Write a book'),
    ], { bodyGoal: 165 })
    expect(s.map((x) => [x.goalId, x.metric.source, x.metric.target])).toEqual([
      [1, 'weight', 142], [2, 'protein-days', 6], [3, 'workouts', 4], [4, 'weight', 165],
    ])
  })
})
