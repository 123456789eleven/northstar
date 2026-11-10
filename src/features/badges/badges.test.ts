import { describe, expect, it } from 'vitest'
import {
  deriveBadges, earnedIds, firstActiveWeeks, firstRun, limitReachedOn, longestRun, netWorthSeries, nthDate,
  type BadgeSnapshot,
} from './badges'

const empty: BadgeSnapshot = {
  today: '2026-11-09', weightDates: [], mealDates: [], journalDates: [], habitLogDates: [], events: [], tasksDone: 0,
  budgetCount: 0, holdingCount: 0, contributions: [], retirementLimit: 7500, balances: [], learningDone: [], goalsDone: 0, reviews: 0,
}
const by = (s: BadgeSnapshot, id: string) => deriveBadges(s).find((b) => b.id === id)!
const dates = (start: number, n: number) => Array.from({ length: n }, (_, i) => `2026-10-${String(start + i).padStart(2, '0')}`)

describe('helpers', () => {
  it('nthDate sorts and returns the nth', () => {
    expect(nthDate(['2026-02-03T10:00:00Z', '2026-01-01'], 2)).toBe('2026-02-03')
    expect(nthDate(['2026-01-01'], 2)).toBeUndefined()
  })
  it('runs of consecutive days', () => {
    expect(firstRun(dates(1, 7), 7)).toBe('2026-10-07')
    expect(firstRun([...dates(1, 3), ...dates(5, 3)], 4)).toBeUndefined()
    expect(longestRun([...dates(1, 3), ...dates(5, 4), '2026-10-05'])).toBe(4)
    expect(longestRun([])).toBe(0)
  })
  it('active weeks need consecutive weeks with enough days', () => {
    // Mondays 2026-10-05, 12, 19, 26
    const d = ['05', '06', '07', '12', '13', '14', '19', '20', '21', '26', '27', '28'].map((x) => `2026-10-${x}`)
    expect(firstActiveWeeks(d, 4, 3)).toEqual({ at: '2026-11-01', best: 4 })
    expect(firstActiveWeeks(d.slice(0, 9), 4, 3).at).toBeUndefined()
    expect(firstActiveWeeks(d.filter((x) => x !== '2026-10-13' && x !== '2026-10-14'), 4, 3).best).toBe(2)
  })
  it('net worth series subtracts liabilities', () => {
    const s = netWorthSeries([
      { date: '2026-02-01', kind: 'asset', balance: 100 }, { date: '2026-02-01', kind: 'liability', balance: 30 },
      { date: '2026-01-01', kind: 'asset', balance: 10 },
    ])
    expect(s).toEqual([{ date: '2026-01-01', total: 10 }, { date: '2026-02-01', total: 70 }])
  })
  it('contribution limit is per calendar year and nets withdrawals', () => {
    const c = [
      { date: '2025-12-01', amount: 5000, kind: 'contribution' as const },
      { date: '2026-01-10', amount: 4000, kind: 'contribution' as const },
      { date: '2026-02-10', amount: 4000, kind: 'contribution' as const },
      { date: '2026-03-10', amount: 100, kind: 'withdrawal' as const },
    ]
    expect(limitReachedOn(c, 7500)).toEqual({ at: '2026-02-10', best: 8000 })
    expect(limitReachedOn(c.slice(0, 2), 7500).at).toBeUndefined()
  })
})

describe('deriveBadges', () => {
  it('has 25 distinct badges and none earned from nothing', () => {
    const b = deriveBadges(empty)
    expect(b).toHaveLength(25)
    expect(new Set(b.map((x) => x.id)).size).toBe(25)
    expect(earnedIds(b)).toEqual([])
    expect(b.every((x) => x.earnedAt === undefined && x.have === 0)).toBe(true)
  })
  it('copy avoids banned words', () => {
    const text = deriveBadges(empty).map((b) => `${b.title} ${b.hint} ${b.meaning}`).join(' ')
    expect(text).not.toMatch(/\bxp\b|level up|quest|loot|trophy|epic|legendary|!/i)
  })
  it('first weigh-in and ten weigh-ins with dates and progress', () => {
    const s = { ...empty, weightDates: dates(1, 3) }
    expect(by(s, 'weigh-first')).toMatchObject({ earned: true, earnedAt: '2026-10-01' })
    expect(by(s, 'weigh-10')).toMatchObject({ earned: false, have: 3, need: 10 })
    expect(by({ ...empty, weightDates: dates(1, 10) }, 'weigh-10')).toMatchObject({ earned: true, earnedAt: '2026-10-10' })
  })
  it('workouts use event counts', () => {
    const events = Array.from({ length: 10 }, (_, i) => ({ kind: 'workout.logged', at: `2026-10-${String(i + 1).padStart(2, '0')}T08:00:00` }))
    const s = { ...empty, events }
    expect(by(s, 'workout-first').earned).toBe(true)
    expect(by(s, 'workout-10')).toMatchObject({ earned: true, earnedAt: '2026-10-10' })
    expect(by(s, 'workout-50')).toMatchObject({ earned: false, have: 10, need: 50 })
  })
  it('career wins count both kinds', () => {
    const events = [{ kind: 'career.win', at: '2026-01-01T00:00:00' }, { kind: 'win', at: '2026-01-02T00:00:00' }]
    expect(by({ ...empty, events }, 'win-5')).toMatchObject({ earned: false, have: 2, need: 5 })
    expect(by({ ...empty, events }, 'win-first').earned).toBe(true)
  })
  it('budgets, holdings and learning', () => {
    const s = { ...empty, budgetCount: 5, holdingCount: 1, learningDone: [{ completedAt: '2026-03-01' }], events: [{ kind: 'finance.budget', at: '2026-04-01T00:00:00' }] }
    expect(by(s, 'budget-first')).toMatchObject({ earned: true, earnedAt: '2026-04-01' })
    expect(by(s, 'budget-5')).toMatchObject({ earned: true, earnedAt: undefined })
    expect(by(s, 'holding-first')).toMatchObject({ earned: true, earnedAt: undefined })
    expect(by(s, 'course-first')).toMatchObject({ earned: true, earnedAt: '2026-03-01' })
    expect(by(s, 'course-3')).toMatchObject({ earned: false, have: 1, need: 3 })
  })
  it('retirement badges', () => {
    const s = { ...empty, contributions: [{ date: '2026-03-01', amount: 4000, kind: 'contribution' as const }, { date: '2026-06-01', amount: 3600, kind: 'contribution' as const }] }
    expect(by(s, 'retire-first')).toMatchObject({ earned: true, earnedAt: '2026-03-01' })
    expect(by(s, 'retire-limit')).toMatchObject({ earned: true, earnedAt: '2026-06-01' })
    expect(by({ ...s, contributions: s.contributions.slice(0, 1) }, 'retire-limit')).toMatchObject({ earned: false, have: 4000, need: 7500 })
  })
  it('net worth badges need a rise across three snapshots', () => {
    const snap = (date: string, balance: number) => ({ date, kind: 'asset' as const, balance })
    const up = { ...empty, balances: [snap('2026-01-01', 100), snap('2026-02-01', 200), snap('2026-03-01', 300)] }
    expect(by(up, 'nw-high')).toMatchObject({ earned: true, earnedAt: '2026-03-01' })
    expect(by(up, 'nw-positive')).toMatchObject({ earned: true, earnedAt: '2026-01-01' })
    const two = { ...empty, balances: up.balances.slice(0, 2) }
    expect(by(two, 'nw-high').earned).toBe(false)
    const dip = { ...empty, balances: [snap('2026-01-01', 300), snap('2026-02-01', 200), snap('2026-03-01', 250)] }
    expect(by(dip, 'nw-high').earned).toBe(false)
  })
  it('consistency badges', () => {
    const s = { ...empty, mealDates: dates(1, 7), habitLogDates: dates(1, 6), journalDates: dates(1, 10) }
    expect(by(s, 'meals-week')).toMatchObject({ earned: true, earnedAt: '2026-10-07' })
    expect(by(s, 'habit-7')).toMatchObject({ earned: false, have: 6, need: 7 })
    expect(by(s, 'journal-10').earned).toBe(true)
    expect(by({ ...empty, weightDates: dates(1, 30) }, 'days-30')).toMatchObject({ earned: true, earnedAt: '2026-10-30' })
  })
  it('earned flag never drops below need and have is capped', () => {
    const b = by({ ...empty, tasksDone: 400, events: Array.from({ length: 100 }, (_, i) => ({ kind: 'task.done', at: `2026-01-01T00:${String(i % 60).padStart(2, '0')}:00` })) }, 'tasks-100')
    expect(b).toMatchObject({ earned: true, have: 100, need: 100 })
  })
})
