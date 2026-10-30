import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../db'
import { allDayOn, daySegments, fmtTime, hourRange, layoutSegments, sortedUpcoming, timeLabel, toMin, weekDates } from './layout'

const ev = (title: string, date: string, start?: string, end?: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ title, date, start, end, allDay: !start, ...extra })

describe('time helpers', () => {
  it('parses and formats', () => {
    expect(toMin('13:30')).toBe(810)
    expect(fmtTime(810)).toBe('1:30 PM')
    expect(fmtTime(540)).toBe('9 AM')
    expect(fmtTime(0)).toBe('12 AM')
  })
  it('labels events', () => {
    expect(timeLabel(ev('a', '2026-10-29'))).toBe('All day')
    expect(timeLabel(ev('a', '2026-10-29', '09:00', '10:30'))).toBe('9 AM - 10:30 AM')
  })
})

describe('weekDates', () => {
  it('is Monday-first', () => {
    const w = weekDates('2026-10-29')
    expect(w[0]).toBe('2026-10-26')
    expect(w[6]).toBe('2026-11-01')
  })
  it('stays 7 distinct consecutive days across DST fall back (Nov 1 2026)', () => {
    expect(weekDates('2026-11-01')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'])
  })
  it('stays 7 days across DST spring forward (Mar 8 2026)', () => {
    expect(weekDates('2026-03-08')).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-07', '2026-03-08'])
    expect(weekDates('2026-03-09')[0]).toBe('2026-03-09')
  })
})

describe('daySegments', () => {
  it('splits all-day from timed and defaults to one hour', () => {
    const list = [ev('Trip', '2026-10-29'), ev('Standup', '2026-10-29', '09:00')]
    expect(allDayOn(list, '2026-10-29').map((e) => e.title)).toEqual(['Trip'])
    expect(daySegments(list, '2026-10-29').map((s) => [s.start, s.end])).toEqual([[540, 600]])
  })
  it('runs an overnight event into the next day', () => {
    const night = ev('Late shift', '2026-10-29', '22:00', '02:00')
    expect(daySegments([night], '2026-10-29')[0]).toMatchObject({ start: 1320, end: 1440, continued: false })
    expect(daySegments([night], '2026-10-30')[0]).toMatchObject({ start: 0, end: 120, continued: true })
    expect(daySegments([night], '2026-10-31')).toEqual([])
  })
})

describe('layoutSegments', () => {
  const place = (...list: CalendarEvent[]) => layoutSegments(daySegments(list, '2026-10-29')).map((p) => [p.event.title, p.col, p.cols])
  it('gives a lone event the full width', () => {
    expect(place(ev('A', '2026-10-29', '09:00', '10:00'))).toEqual([['A', 0, 1]])
  })
  it('puts overlapping events side by side', () => {
    expect(place(ev('A', '2026-10-29', '09:00', '10:30'), ev('B', '2026-10-29', '10:00', '11:00'))).toEqual([['A', 0, 2], ['B', 1, 2]])
  })
  it('back-to-back events do not overlap', () => {
    expect(place(ev('A', '2026-10-29', '09:00', '10:00'), ev('B', '2026-10-29', '10:00', '11:00'))).toEqual([['A', 0, 1], ['B', 0, 1]])
  })
  it('reuses a free column inside a cluster and keeps clusters independent', () => {
    const r = place(
      ev('A', '2026-10-29', '09:00', '12:00'),
      ev('B', '2026-10-29', '09:30', '10:00'),
      ev('C', '2026-10-29', '10:30', '11:00'),
      ev('D', '2026-10-29', '14:00', '15:00'),
    )
    expect(r).toEqual([['A', 0, 2], ['B', 1, 2], ['C', 1, 2], ['D', 0, 1]])
  })
  it('stretches the hour range to fit', () => {
    expect(hourRange([])).toEqual([7, 21])
    expect(hourRange(daySegments([ev('E', '2026-10-29', '05:30', '23:30')], '2026-10-29'))).toEqual([5, 24])
  })
})

describe('sortedUpcoming', () => {
  const list = [
    ev('Done', '2026-10-29', '08:00', '09:00'),
    ev('Soon', '2026-10-29', '15:00', '16:00'),
    ev('All day', '2026-10-29'),
    ev('Tomorrow', '2026-10-30', '09:00'),
    ev('Past', '2026-10-28', '09:00'),
  ]
  it('drops ended and past events and sorts by time', () => {
    expect(sortedUpcoming(list, '2026-10-29', 12 * 60).map((e) => e.title)).toEqual(['All day', 'Soon', 'Tomorrow'])
  })
})
