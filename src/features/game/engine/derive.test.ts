import { describe, expect, it } from 'vitest'
import { deriveGains } from './derive'
import { goal, habit, person, snap, task, TODAY } from './fixtures'
import { RULES, XP_TABLE } from './xpTable'

const sum = (g: { xp: number }[]) => g.reduce((a, x) => a + x.xp, 0)
const D = TODAY

describe('xp table', () => {
  it('has exactly one rule per kind with positive values', () => {
    expect(new Set(XP_TABLE.map((r) => r.kind)).size).toBe(XP_TABLE.length)
    for (const r of XP_TABLE) {
      expect(r.xp).toBeGreaterThan(0)
      expect(r.cap).toBeGreaterThanOrEqual(r.xp > 1 ? r.xp : 1)
    }
  })
})

describe('deriveGains: skill mapping', () => {
  const s = snap({
    weights: [{ id: 1, date: D, weight: 180 }],
    meals: [{ id: 1, date: D, slot: 'lunch', name: 'x', calories: 2400, protein: 140 }],
    targets: { calories: 2400, protein: 140 },
    habits: [habit({ id: 1, name: 'Lift' }), habit({ id: 2, name: 'Read' }), habit({ id: 3, name: 'Budget check', goalId: 7 })],
    habitLogs: [{ id: 1, habitId: 1, date: D }, { id: 2, habitId: 2, date: D }, { id: 3, habitId: 3, date: D }],
    goals: [goal({ id: 7, area: 'finance' }), goal({ id: 8, area: 'health', status: 'done', completedAt: `${D}T15:00:00` })],
    journal: [{ id: 1, date: D, text: 'hello', createdAt: '' }],
    studySessions: [{ id: 1, itemId: 1, date: D, minutes: 30 }],
    events: [
      { id: 1, at: `${D}T10:00:00`, area: 'career', kind: 'career.win', title: 'w', milestone: false },
      { id: 2, at: `${D}T10:05:00`, area: 'career', kind: 'goal.milestone', title: 'm', refTable: 'goals', refId: 8, milestone: true },
      { id: 3, at: `${D}T10:06:00`, area: 'career', kind: 'finance.import', title: 'i', milestone: false },
      { id: 4, at: `${D}T10:07:00`, area: 'career', kind: 'tx.categorize', title: 'c', milestone: false },
      { id: 5, at: `${D}T10:08:00`, area: 'career', kind: 'focus.session', title: 'f', milestone: false },
    ],
    tasks: [task({ id: 1, status: 'done', doneAt: `${D}T09:00:00`, priority: 1, goalId: 7 })],
    people: [person({ id: 1 })],
    interactions: [{ id: 1, personId: 1, date: D, kind: 'call' }],
    balances: [{ id: 1, date: D, name: 'Checking', kind: 'asset', balance: 100 }],
    reviews: [{ id: 1, weekOf: '2026-10-26', wins: '', struggles: '', focusNext: '', ratings: {}, createdAt: '', lockedAt: `${D}T08:00:00` } as never],
  })
  const gains = deriveGains(s, D)
  it.each([
    ['weigh-in', 'body'], ['calories-met', 'body'], ['protein-met', 'body'], ['workout', 'body'], ['meal', 'body'],
    ['journal', 'mind'], ['learning', 'mind'], ['focus', 'mind'], ['habit', 'money'],
    ['win', 'career'], ['review', 'career'], ['milestone', 'body'], ['goal-done', 'body'],
    ['contact', 'people'], ['task', 'money'], ['import', 'money'], ['categorize', 'money'], ['net-worth', 'money'],
  ] as const)('%s -> %s', (k, sk) => {
    const found = gains.filter((g) => g.id.startsWith(`${k}:`)).map((g) => g.skill)
    expect(found.length).toBeGreaterThan(0)
    expect(found).toContain(sk)
  })
  it('unlinked habits go to Mind, lift habit is a workout not a check-in', () => {
    expect(gains.find((g) => g.id.startsWith('habit:2'))?.skill).toBe('mind')
    expect(gains.some((g) => g.id.startsWith('habit:1'))).toBe(false)
    expect(gains.find((g) => g.kind === 'workout')?.skill).toBe('body')
  })
  it('task xp adds priority and goal bonuses and carries a why line', () => {
    const t = gains.find((g) => g.id === 'task:1')!
    expect(t.xp).toBe(20)
    expect(t.reason).toBe('Finished a task (+20)')
  })
})

describe('deriveGains: rules', () => {
  it('applies per-kind daily caps', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({ id: i + 1, at: `${D}T1${i}:00:00`, area: 'career' as const, kind: 'career.win', title: 'w', milestone: false }))
    const tasks = Array.from({ length: 12 }, (_, i) => task({ id: i + 1, status: 'done', doneAt: `${D}T0${i % 9}:00:00` }))
    const g = deriveGains(snap({ events, tasks, studySessions: [{ id: 1, itemId: 1, date: D, minutes: 600 }] }), D)
    expect(sum(g.filter((x) => x.kind === 'win'))).toBe(RULES.win.cap)
    expect(sum(g.filter((x) => x.kind === 'task'))).toBe(RULES.task.cap)
    expect(sum(g.filter((x) => x.kind === 'learning'))).toBe(RULES.learning.cap)
  })
  it('journal gets +10 at 150 words', () => {
    const text = Array(150).fill('word').join(' ')
    expect(deriveGains(snap({ journal: [{ id: 1, date: D, text, createdAt: '' }] }), D)[0].xp).toBe(30)
  })
  it('targets need 95 percent', () => {
    const meals = (c: number, p: number) => [{ id: 1, date: D, slot: 'lunch' as const, name: 'x', calories: c, protein: p }]
    const t = { calories: 2000, protein: 100 }
    const hit = deriveGains(snap({ targets: t, meals: meals(1900, 95) }), D).map((g) => g.kind)
    expect(hit).toContain('calories-met')
    expect(hit).toContain('protein-met')
    const miss = deriveGains(snap({ targets: t, meals: meals(1899, 94) }), D).map((g) => g.kind)
    expect(miss).not.toContain('calories-met')
    expect(miss).not.toContain('protein-met')
  })
  it('workouts from the workout.logged event count once per day with the habit', () => {
    const g = deriveGains(snap({
      habits: [habit({ id: 1, name: 'Gym' })], habitLogs: [{ id: 1, habitId: 1, date: D }],
      events: [{ id: 1, at: `${D}T18:00:00`, area: 'body', kind: 'workout.logged', title: 'w', milestone: false }],
    }), D)
    expect(g.filter((x) => x.kind === 'workout')).toHaveLength(1)
  })
  it('uses local dates for timestamps (late evening UTC stays on the local day)', () => {
    // 2026-11-03T02:30Z is 21:30 on Nov 2 in New York.
    const g = deriveGains(snap({ tasks: [task({ id: 1, status: 'done', doneAt: '2026-11-03T02:30:00.000Z' })] }), D)
    expect(g[0].date).toBe(D)
  })
  it('ignores future days and awards on-budget days only for past days with spending', () => {
    const s = snap({
      budgets: [{ id: 1, category: 'Dining', monthlyLimit: 100 }],
      transactions: [
        { id: 1, date: '2026-10-05', amount: -40, description: 'a', category: 'Dining' },
        { id: 2, date: '2026-10-06', amount: -70, description: 'b', category: 'Dining' },
        { id: 3, date: '2026-11-01', amount: -20, description: 'c', category: 'Dining' },
        { id: 4, date: D, amount: -5, description: 'd', category: 'Dining' },
      ],
      weights: [{ id: 1, date: '2026-11-09', weight: 1 }],
    })
    const g = deriveGains(s, D)
    expect(g.filter((x) => x.kind === 'budget-day').map((x) => x.date)).toEqual(['2026-10-05', '2026-11-01'])
    expect(g.some((x) => x.kind === 'weigh-in')).toBe(false)
  })
  it('is idempotent, sorted, and never negative or NaN', () => {
    const s = snap({ studySessions: [{ id: 1, itemId: 1, date: D, minutes: -50 }, { id: 2, itemId: 1, date: D, minutes: NaN }], tasks: [task({ id: 1, status: 'done', doneAt: 'garbage' })] })
    const a = deriveGains(s, D)
    expect(deriveGains(s, D)).toEqual(a)
    for (const g of a) {
      expect(Number.isFinite(g.xp)).toBe(true)
      expect(g.xp).toBeGreaterThan(0)
    }
    expect(deriveGains(snap(), D)).toEqual([])
  })
  it('adds the day-clear bonus once per day, and a week-clear bonus when the target is met', () => {
    // Only the journal quest applies in an empty app: writing it clears the day.
    const dates = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', D]
    const g = deriveGains(snap({ journal: dates.map((date, id) => ({ id, date, text: 'x', createdAt: '' })) }), D)
    expect(g.filter((x) => x.kind === 'day-clear')).toHaveLength(6)
    expect(g.filter((x) => x.kind === 'day-clear' && x.date === D)).toHaveLength(1)
    expect(g.filter((x) => x.kind === 'week-clear').map((x) => x.id)).toEqual(['week-clear:2026-10-26'])
    expect(sum(g.filter((x) => x.kind === 'week-clear'))).toBe(120)
  })
})
