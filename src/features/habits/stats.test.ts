import { describe, expect, it } from 'vitest'
import { heatGrid, lastDays, milestoneFor, streak, weekCount, weekProgress } from './stats'

const S = (...d: string[]) => new Set(d)

describe('daily streak', () => {
  it('counts back from today', () => {
    expect(streak(S('2026-10-27', '2026-10-28', '2026-10-29'), '2026-10-29', 7)).toEqual({ count: 3, unit: 'day' })
  })
  it('stays alive through an unchecked today', () => {
    expect(streak(S('2026-10-27', '2026-10-28'), '2026-10-29', 7).count).toBe(2)
  })
  it('breaks after a missed day', () => {
    expect(streak(S('2026-10-26', '2026-10-28'), '2026-10-29', 7).count).toBe(1)
    expect(streak(S('2026-10-26'), '2026-10-29', 7).count).toBe(0)
  })
  it('survives DST changes (Nov 1 2026 fall back, Mar 8 2026 spring forward)', () => {
    expect(streak(S('2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'), '2026-11-02', 7).count).toBe(4)
    expect(streak(S('2026-03-07', '2026-03-08', '2026-03-09'), '2026-03-09', 7).count).toBe(3)
  })
})

describe('weekly streak', () => {
  // 2026-10-26 is a Monday.
  it('counts weeks meeting the target, current week included when met', () => {
    const d = S('2026-10-12', '2026-10-14', '2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28')
    expect(streak(d, '2026-10-29', 2)).toEqual({ count: 3, unit: 'week' })
  })
  it('an unmet current week does not break the streak yet', () => {
    const d = S('2026-10-19', '2026-10-21', '2026-10-26')
    expect(streak(d, '2026-10-29', 2).count).toBe(1)
  })
  it('a missed past week ends it', () => {
    const d = S('2026-10-12', '2026-10-14', '2026-10-26', '2026-10-27')
    expect(streak(d, '2026-10-29', 2).count).toBe(1)
  })
  it('Sunday belongs to the week that started Monday', () => {
    expect(weekCount(S('2026-10-25', '2026-10-26'), '2026-10-25')).toBe(1)
    expect(weekCount(S('2026-10-25', '2026-10-26'), '2026-10-26')).toBe(1)
  })
  it('weeks across the DST fallback still line up', () => {
    const d = S('2026-10-26', '2026-10-27', '2026-11-02', '2026-11-03')
    expect(streak(d, '2026-11-04', 2).count).toBe(2)
  })
})

describe('week progress, milestones, heat grid', () => {
  it('reports x of perWeek', () => {
    expect(weekProgress(S('2026-10-26', '2026-10-27', '2026-10-19'), '2026-10-29', 3)).toEqual({ done: 2, target: 3 })
  })
  it('flags milestones only on exact counts', () => {
    expect(milestoneFor({ count: 7, unit: 'day' })).toBe(7)
    expect(milestoneFor({ count: 8, unit: 'day' })).toBeNull()
    expect(milestoneFor({ count: 4, unit: 'week' })).toBe(4)
  })
  it('builds 12 Monday-first weeks ending in the current one', () => {
    const g = heatGrid(S('2026-10-29'), '2026-10-29', 12)
    expect(g).toHaveLength(12)
    expect(g[11][0].date).toBe('2026-10-26')
    expect(g[11][3]).toMatchObject({ date: '2026-10-29', done: true, future: false })
    expect(g[11][4].future).toBe(true)
    expect(g[0][0].date).toBe('2026-08-10')
    const all = g.flat().map((c) => c.date)
    expect(new Set(all).size).toBe(84) // no duplicate/skipped days across DST
  })
  it('lists the last 7 days oldest first', () => {
    expect(lastDays('2026-11-02')).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })
})
