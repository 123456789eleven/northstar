import { describe, expect, it } from 'vitest'
import type { LifeEvent } from '../../db'
import { countByArea, groupByWeek, weekLabel } from './group'

const ev = (at: string, area: LifeEvent['area'] = 'tasks'): LifeEvent => ({ at, area, kind: 'x', title: at, milestone: false })

describe('groupByWeek', () => {
  it('groups newest-first events by Monday week then day', () => {
    const rows = [ev('2026-10-30T15:00:00'), ev('2026-10-30T09:00:00'), ev('2026-10-27T09:00:00'), ev('2026-10-25T09:00:00')]
    const g = groupByWeek(rows)
    expect(g.map((w) => [w.weekOf, w.count, w.days.length])).toEqual([['2026-10-26', 3, 2], ['2026-10-19', 1, 1]])
  })
  it('returns nothing for no events', () => expect(groupByWeek([])).toEqual([]))
})

describe('weekLabel', () => {
  it('names this and last week, ranges otherwise', () => {
    expect(weekLabel('2026-10-26', '2026-10-30')).toBe('This week')
    expect(weekLabel('2026-10-19', '2026-10-30')).toBe('Last week')
    expect(weekLabel('2026-09-28', '2026-10-30')).toMatch(/Sep 28 – Oct 4/)
    expect(weekLabel('2025-12-29', '2026-10-30')).toMatch(/2026$/)
  })
})

describe('countByArea', () => {
  it('counts and sorts', () => {
    expect(countByArea([ev('a', 'health'), ev('b', 'tasks'), ev('c', 'tasks')])).toEqual([['tasks', 2], ['health', 1]])
  })
})
