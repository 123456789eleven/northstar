import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../db'
import { blockMeta, blockUid, conflictIds, makeSpan, minFromY, moveSpan, normalizeWall, realMinutes, resizeSpan, snap } from './timeBlock'

const ev = (id: number, start: string, end: string, uid?: string): CalendarEvent => ({ id, title: 't' + id, date: '2026-11-04', allDay: false, start, end, uid })

describe('time block math', () => {
  it('snaps to 15 minutes and defaults to 45', () => {
    expect(snap(37)).toBe(30)
    expect(snap(38)).toBe(45)
    expect(makeSpan('2026-11-04', 9 * 60 + 7)).toEqual({ date: '2026-11-04', start: '09:00', end: '09:45' })
  })
  it('never crosses midnight: late starts move earlier', () => {
    const s = makeSpan('2026-11-04', 23 * 60 + 30)
    expect(s.end <= '23:59').toBe(true)
    expect(s.start < s.end).toBe(true)
    expect(makeSpan('2026-11-04', 23 * 60 + 59, 45).end <= '23:59').toBe(true)
  })
  it('moves keeping length and across days', () => {
    expect(moveSpan({ date: '2026-11-04', start: '09:00', end: '10:30' }, '2026-11-05', 14 * 60)).toEqual({ date: '2026-11-05', start: '14:00', end: '15:30' })
  })
  it('resizes with a 15 minute minimum and a midnight cap', () => {
    const s = { date: '2026-11-04', start: '09:00', end: '09:45' }
    expect(resizeSpan(s, 9 * 60).end).toBe('09:15')
    expect(resizeSpan(s, 11 * 60 + 20).end).toBe('11:15')
    expect(resizeSpan(s, 30 * 60).end).toBe('23:59')
  })
  it('handles DST: spring-forward gap and elapsed time (America/New_York)', () => {
    expect(normalizeWall('2026-03-08', 2 * 60 + 30)).toBe(3 * 60 + 30)
    expect(normalizeWall('2026-03-09', 2 * 60 + 30)).toBe(2 * 60 + 30)
    expect(realMinutes('2026-03-08', '01:30', '03:30')).toBe(60)
    expect(realMinutes('2026-03-09', '01:30', '03:30')).toBe(120)
    expect(realMinutes('2026-11-01', '00:30', '02:30')).toBe(180)
    expect(makeSpan('2026-03-08', 2 * 60).start).toBe('03:00')
  })
  it('maps pointer y to minutes', () => {
    expect(minFromY(0, 7, 48)).toBe(7 * 60)
    expect(minFromY(48 * 2 + 12, 7, 48)).toBe(9 * 60 + 15)
  })
  it('encodes the task link in the uid', () => {
    const uid = blockUid('task', 42)
    expect(blockMeta({ uid })).toEqual({ kind: 'task', taskId: 42 })
    expect(blockMeta({ uid: blockUid('training') })).toEqual({ kind: 'training', taskId: undefined })
    expect(blockMeta({ uid: 'g:cal:abc:2026-11-04' })).toBeNull()
    expect(blockMeta({})).toBeNull()
  })
  it('finds conflicts, treating touching blocks as free', () => {
    const c = conflictIds([ev(1, '09:00', '10:00'), ev(2, '09:30', '10:30'), ev(3, '10:30', '11:00'), ev(4, '12:00', '13:00')], '2026-11-04')
    expect([...c].sort()).toEqual([1, 2])
  })
})
