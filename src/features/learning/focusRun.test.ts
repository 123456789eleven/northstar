import { describe, expect, it } from 'vitest'
import { elapsedMs, focusReducer, formatClock, IDLE, minutesByDay, targetProgress, type FocusRun } from './focusRun'

const MIN = 60_000
const at = (h: number, m = 0, day = 5) => new Date(2026, 10, day, h, m, 0).getTime()

describe('focusReducer', () => {
  it('counts up while running, freezes while paused, resumes without the gap', () => {
    let s: FocusRun = focusReducer(IDLE, { type: 'start', itemId: 1, targetMin: 25, now: at(9) })
    expect(elapsedMs(s, at(9, 10))).toBe(10 * MIN)
    s = focusReducer(s, { type: 'pause', now: at(9, 10) })
    expect(s.phase).toBe('paused')
    expect(elapsedMs(s, at(11))).toBe(10 * MIN)
    s = focusReducer(s, { type: 'resume', now: at(11) })
    expect(elapsedMs(s, at(11, 5))).toBe(15 * MIN)
    expect(minutesByDay(s, at(11, 5))).toEqual([{ date: '2026-11-05', minutes: 15 }])
  })
  it('ignores invalid transitions', () => {
    expect(focusReducer(IDLE, { type: 'pause', now: 1 })).toBe(IDLE)
    const s = focusReducer(IDLE, { type: 'start', itemId: 1, targetMin: null, now: 0 })
    expect(focusReducer(s, { type: 'start', itemId: 2, targetMin: null, now: 5 })).toBe(s)
    expect(focusReducer(s, { type: 'resume', now: 5 })).toBe(s)
    expect(focusReducer(s, { type: 'reset' })).toBe(IDLE)
  })
  it('splits a run across local midnight into per-day minutes', () => {
    const s = focusReducer(IDLE, { type: 'start', itemId: 1, targetMin: null, now: at(23, 40) })
    expect(minutesByDay(s, at(0, 25, 6))).toEqual([{ date: '2026-11-05', minutes: 20 }, { date: '2026-11-06', minutes: 25 }])
  })
  it('drops sub-30s runs and tracks target progress', () => {
    const s = focusReducer(IDLE, { type: 'start', itemId: 1, targetMin: 25, now: at(9) })
    expect(minutesByDay(s, at(9) + 20_000)).toEqual([])
    expect(targetProgress(s, at(9, 50))).toBe(1)
    expect(targetProgress(s, at(9) + 12.5 * MIN)).toBeCloseTo(0.5)
  })
  it('formats the clock', () => {
    expect(formatClock(65_000)).toBe('01:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })
})
