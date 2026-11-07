import { describe, expect, it } from 'vitest'
import { consistencyGrid, weekTotals, weeksOnTarget } from './consistency'

// 2026-11-04 is a Wednesday; its week starts Monday 2026-11-02.
const T = '2026-11-04'
const by = new Map<number, Set<string>>([
  [1, new Set(['2026-11-02', '2026-11-03', '2026-10-26', '2026-10-27', '2026-10-28'])],
  [2, new Set(['2026-11-02'])],
])

describe('consistencyGrid', () => {
  it('has 12 weeks of 7 days ending in the current week', () => {
    const g = consistencyGrid(by, [1, 2], T)
    expect(g).toHaveLength(12)
    expect(g[11][0].date).toBe('2026-11-02')
    expect(g[11][0].count).toBe(2)
    expect(g[11][0].level).toBe(3)
    expect(g[11][1].level).toBe(2)
    expect(g[11][3].future).toBe(true)
    expect(g[11][2].today).toBe(true)
  })
  it('leaves empty days at level 0', () => {
    expect(consistencyGrid(by, [1, 2], T)[0][0].level).toBe(0)
  })
})

describe('weekTotals', () => {
  it('caps each habit at its target', () => {
    expect(weekTotals(by, [{ id: 1, perWeek: 2 }, { id: 2, perWeek: 3 }], '2026-10-26')).toEqual({ done: 2, target: 5 })
  })
})

describe('weeksOnTarget', () => {
  it('allows one grace day', () => {
    expect(weeksOnTarget(by, [{ id: 1, perWeek: 4 }], T, 1)).toEqual({ on: 1, of: 1 })
    expect(weeksOnTarget(by, [{ id: 1, perWeek: 5 }], T, 1).on).toBe(0)
  })
  it('returns zero with no habits', () => {
    expect(weeksOnTarget(by, [], T)).toEqual({ on: 0, of: 0 })
  })
})
