import { describe, expect, it } from 'vitest'
import { isDueToday, monthGrid, weekRing } from './week'

const set = (...d: string[]) => new Set(d)

describe('weekRing', () => {
  it('counts Monday to Sunday of the current week only', () => {
    // 2026-11-02 is a Monday
    const r = weekRing(set('2026-11-01', '2026-11-02', '2026-11-04'), '2026-11-04', 3)
    expect(r.done).toBe(2)
    expect(r.pct).toBeCloseTo(2 / 3)
    expect(r.days[0].date).toBe('2026-11-02')
    expect(r.days.filter((d) => d.future).length).toBe(4)
    expect(r.days.find((d) => d.today)?.date).toBe('2026-11-04')
  })
  it('Sunday belongs to the week that started the Monday before', () => {
    const r = weekRing(set('2026-11-08', '2026-11-09'), '2026-11-08', 5)
    expect(r.days[0].date).toBe('2026-11-02')
    expect(r.done).toBe(1)
  })
  it('exceeded target caps the ring at 1', () => {
    const all = ['02', '03', '04', '05', '06', '07', '08'].map((x) => `2026-11-${x}`)
    expect(weekRing(new Set(all), '2026-11-08', 5)).toMatchObject({ done: 7, pct: 1, exceeded: true })
  })
  it('keeps 7 distinct days across the fall-back DST week', () => {
    // US DST ends 2026-11-01 (Sunday): the week of Oct 26 has a 25-hour day.
    const r = weekRing(set('2026-10-26', '2026-11-01'), '2026-11-01', 2)
    expect(r.days.map((d) => d.date)).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
    expect(r.done).toBe(2)
    expect(r.pct).toBe(1)
  })
  it('keeps 7 distinct days across the spring-forward week', () => {
    // US DST starts 2026-03-08 (Sunday).
    const r = weekRing(set('2026-03-08'), '2026-03-08', 7)
    expect(r.days[0].date).toBe('2026-03-02')
    expect(new Set(r.days.map((d) => d.date)).size).toBe(7)
    expect(r.days[6].date).toBe('2026-03-08')
  })
  it('clamps a nonsense target', () => {
    expect(weekRing(set(), '2026-11-04', 0).target).toBe(1)
    expect(weekRing(set(), '2026-11-04', 20).target).toBe(7)
  })
})

describe('isDueToday', () => {
  it('false once checked; a weekly habit stops being due when the week target is met', () => {
    expect(isDueToday(set('2026-11-04'), '2026-11-04', 7)).toBe(false)
    expect(isDueToday(set(), '2026-11-04', 7)).toBe(true)
    expect(isDueToday(set('2026-11-02'), '2026-11-04', 1)).toBe(false)
    expect(isDueToday(set('2026-11-02'), '2026-11-04', 3)).toBe(true)
  })
})

describe('monthGrid', () => {
  it('Monday-first rows covering the month, outside days marked', () => {
    const g = monthGrid(set('2026-11-03'), '2026-11-04')
    expect(g[0][0].date).toBe('2026-10-26')
    expect(g[0][0].inMonth).toBe(false)
    expect(g[0][6].date).toBe('2026-11-01')
    expect(g[0][6].inMonth).toBe(true)
    expect(g.flat().find((c) => c.date === '2026-11-03')?.done).toBe(true)
    expect(g.length).toBe(6)
  })
  it('a DST month has no duplicate or missing days', () => {
    const dates = monthGrid(set(), '2026-03-15').flat().map((c) => c.date)
    expect(new Set(dates).size).toBe(dates.length)
    expect(dates.filter((d) => d.startsWith('2026-03')).length).toBe(31)
  })
})
