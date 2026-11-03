import { describe, expect, it } from 'vitest'
import { addDays } from '../../../lib/dates'
import { computeStreak } from './streaks'

const set = (...d: string[]) => new Set(d)

describe('weekly streak', () => {
  it('counts active days in the current Monday-start week', () => {
    const r = computeStreak(set('2026-11-02'), '2026-11-04', 5)
    expect(r.daysThisWeek).toBe(1)
    expect(r.weekDots).toEqual([true, false, false, false, false, false, false])
    expect(r.weeksInRow).toBe(0)
  })
  it('Sunday belongs to the week that started the Monday before', () => {
    const r = computeStreak(set('2026-11-01'), '2026-11-01', 5)
    expect(r.weekDots[6]).toBe(true)
  })
  it('rest tokens cover missed days only when needed to reach the target', () => {
    // Wed: Mon active, Tue missed. Need 3 with Wed..Sun still open: no cover yet (5 days left covers it).
    expect(computeStreak(set('2026-11-02'), '2026-11-03', 3).restTokens).toBe(2)
    // Sat: Mon, Tue active; Wed-Fri missed; Sat+Sun left. Target 5 needs 3 more: Sat+Sun give 2, so 1 token is used.
    const r = computeStreak(set('2026-11-02', '2026-11-03'), '2026-11-07', 5)
    expect(r.restTokens).toBe(1)
    expect(r.daysThisWeek).toBe(3)
    expect(r.weekDots).toEqual([true, true, true, false, false, false, false])
  })
  it('a covered week keeps the run, a missed week resets it, XP is not involved', () => {
    const active = set(
      // week of Oct 12: 4 active + 2 tokens -> met (target 5)
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      // week of Oct 19: 5 active
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23',
      // week of Oct 26: only 2 -> missed
      '2026-10-26', '2026-10-27',
      // this week 5 active
      '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06',
    )
    const r = computeStreak(active, '2026-11-06', 5)
    expect(r.metWeeks.map((w) => w.weekOf)).toEqual(['2026-10-12', '2026-10-19', '2026-11-02'])
    expect(r.weeksInRow).toBe(1)
    const before = computeStreak(active, '2026-10-25', 5)
    expect(before.weeksInRow).toBe(2)
  })
  it('a week with 3 of 5 and 2 tokens is met; 2 of 5 is not', () => {
    expect(computeStreak(set('2026-10-26', '2026-10-27', '2026-10-28'), '2026-11-02', 5).weeksInRow).toBe(1)
    expect(computeStreak(set('2026-10-26', '2026-10-27'), '2026-11-02', 5).weeksInRow).toBe(0)
  })
  it('is safe across the DST change (Nov 1 2026) and long ranges', () => {
    const days: string[] = []
    for (let i = 0; i < 70; i++) days.push(addDays('2026-08-31', i))
    const r = computeStreak(new Set(days), '2026-11-08', 5)
    expect(r.weeksInRow).toBe(10)
    expect(r.weekDots).toHaveLength(7)
  })
  it('handles empty data and bad targets', () => {
    const r = computeStreak(new Set(), '2026-11-02', NaN)
    expect(r).toMatchObject({ target: 5, daysThisWeek: 0, weeksInRow: 0, restTokens: 2 })
    expect(computeStreak(new Set(), '2026-11-02', 99).target).toBe(7)
  })
})
