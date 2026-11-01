import { describe, expect, it } from 'vitest'
import { addDays } from '../../lib/dates'
import { adaptiveMaintenance, adviceFor, averageAt, dailyTargets, isFlat, milestoneCrossings, milestoneTargets, movingAverage, projectDate, weeklyRate, type WeightPoint } from './model'

const D0 = '2026-03-01'
const line = (n: number, start: number, perWeek: number): WeightPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(D0, i), weight: start + (perWeek / 7) * i }))

describe('movingAverage', () => {
  it('averages the trailing 7 days and tolerates gaps and unsorted input', () => {
    const w = [{ date: '2026-03-03', weight: 138 }, { date: '2026-03-01', weight: 134 }, { date: '2026-03-20', weight: 140 }]
    const s = movingAverage(w)
    expect(s.map((p) => p.avg)).toEqual([134, 136, 140])
  })
  it('drops points older than the window', () => {
    const s = movingAverage(line(10, 100, 7)) // +1/day
    expect(s[9].avg).toBeCloseTo(106, 5) // mean of 103..109
  })
})

describe('averageAt', () => {
  it('is null with no data in the window', () => expect(averageAt([{ date: D0, weight: 1 }], '2026-04-01')).toBeNull())
})

describe('weeklyRate', () => {
  it('recovers a straight-line slope', () => expect(weeklyRate(line(28, 135, 0.75), addDays(D0, 27))).toBeCloseTo(0.75, 5))
  it('needs 3 points over 14+ days', () => {
    expect(weeklyRate(line(10, 135, 1), addDays(D0, 9))).toBeNull()
    expect(weeklyRate([{ date: D0, weight: 1 }, { date: addDays(D0, 20), weight: 2 }], addDays(D0, 20))).toBeNull()
  })
  it('only uses the window', () => {
    const w = [...line(14, 150, -2), ...line(28, 135, 0.5).map((p) => ({ ...p, date: addDays(p.date, 30) }))]
    expect(weeklyRate(w, addDays(D0, 57))).toBeCloseTo(0.5, 5)
  })
  it('is negative when losing', () => expect(weeklyRate(line(21, 140, -0.5), addDays(D0, 20))!).toBeCloseTo(-0.5, 5))
})

describe('projectDate', () => {
  it('projects from the rate', () => expect(projectDate(135, 165, 0.75, D0)).toBe(addDays(D0, 280)))
  it('is null when flat, negative or unknown', () => {
    expect(projectDate(135, 165, 0, D0)).toBeNull()
    expect(projectDate(135, 165, -1, D0)).toBeNull()
    expect(projectDate(135, 165, null, D0)).toBeNull()
  })
  it('is today when already at goal', () => expect(projectDate(166, 165, null, D0)).toBe(D0))
})

describe('milestones', () => {
  it('lists each 5 lb step above start, then the goal', () => {
    expect(milestoneTargets(135, 165)).toEqual([140, 145, 150, 155, 160, 165])
    expect(milestoneTargets(136.4, 165)).toEqual([140, 145, 150, 155, 160, 165])
    expect(milestoneTargets(135, 163)).toEqual([140, 145, 150, 155, 160, 163])
    expect(milestoneTargets(170, 165)).toEqual([])
  })
  it('records the first date the 7-day average crosses a step', () => {
    const w = line(60, 135, 1) // 1 lb/week
    const c = milestoneCrossings(w, 135, 165)
    expect(c[0].target).toBe(140)
    expect(c[0].date).not.toBeNull()
    // average lags the raw line by 3 days, so 140 is crossed after day 35 of raw weight
    expect(c[0].date! > addDays(D0, 35)).toBe(true)
    expect(c.find((x) => x.target === 165)!.date).toBeNull()
  })
})

describe('adviceFor / isFlat', () => {
  it('flags fast gain', () => expect(adviceFor(1.4, 30, false).text).toMatch(/faster than about 1.25/))
  it('flags flat', () => expect(adviceFor(0.05, 30, true).text).toMatch(/200-300 kcal/))
  it('is good in range', () => expect(adviceFor(0.7, 30, false).tone).toBe('good'))
  it('asks for data with no rate', () => expect(adviceFor(null, 3, false).text).toMatch(/Log a few more/))
  it('detects a flat average', () => {
    expect(isFlat(line(28, 140, 0), addDays(D0, 27))).toBe(true)
    expect(isFlat(line(28, 140, 1), addDays(D0, 27))).toBe(false)
  })
})

describe('targets', () => {
  it('maintenance 15 x lb, surplus, protein 0.8 x lb', () => expect(dailyTargets(135, { surplus: 400 })).toEqual({ maintenance: 2025, calories: 2425, protein: 108 }))
  it('honours overrides', () => expect(dailyTargets(135, { surplus: 300, maintenance: 2500, protein: 140 })).toEqual({ maintenance: 2500, calories: 2800, protein: 140 }))
  it('adaptive maintenance = intake - rate*3500/7', () => {
    expect(adaptiveMaintenance(Array(14).fill(2700), 1)).toBe(2200)
    expect(adaptiveMaintenance(Array(13).fill(2700), 1)).toBeNull()
    expect(adaptiveMaintenance(Array(14).fill(2700), null)).toBeNull()
  })
})
