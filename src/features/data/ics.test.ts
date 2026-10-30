import { describe, expect, it } from 'vitest'
import { parseIcs } from './ics'

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`
const ev = (lines: string[]) => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT`
const NOW = new Date(2026, 0, 1, 12)

describe('parseIcs', () => {
  it('parses a timed event with folding and escapes', () => {
    const r = parseIcs(wrap(ev(['UID:a1', 'SUMMARY:Lunch\\, with Sam', 'DTSTART:20260310T120000', 'DTEND:20260310T130000', 'LOCATION:Cafe\\; Main St', 'DESCRIPTION:Line one\\nline ', ' two (folded)'])), { now: NOW })
    expect(r.events).toEqual([{ title: 'Lunch, with Sam', date: '2026-03-10', start: '12:00', end: '13:00', allDay: false, location: 'Cafe; Main St', notes: 'Line one\nline two (folded)', uid: 'a1' }])
  })

  it('converts UTC Z times to local (New York)', () => {
    const r = parseIcs(wrap(ev(['UID:u', 'SUMMARY:Call', 'DTSTART:20260115T023000Z', 'DTEND:20260115T033000Z'])), { now: NOW })
    expect(r.events[0]).toMatchObject({ date: '2026-01-14', start: '21:30', end: '22:30' })
  })

  it('converts TZID times to local and falls back for unknown zones', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:LA', 'DTSTART;TZID=America/Los_Angeles:20260115T090000', 'DTEND;TZID=America/Los_Angeles:20260115T100000']) + '\r\n' + ev(['SUMMARY:Win', 'DTSTART;TZID=Eastern Standard Time:20260116T090000'])), { now: NOW })
    expect(r.events.find((e) => e.title === 'LA')).toMatchObject({ start: '12:00', end: '13:00' })
    expect(r.events.find((e) => e.title === 'Win')).toMatchObject({ start: '09:00' })
  })

  it('handles all-day events with exclusive DTEND and splits multi-day', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:Trip', 'UID:t', 'DTSTART;VALUE=DATE:20260301', 'DTEND;VALUE=DATE:20260304'])), { now: NOW })
    expect(r.events.map((e) => [e.date, e.allDay])).toEqual([['2026-03-01', true], ['2026-03-02', true], ['2026-03-03', true]])
    const one = parseIcs(wrap(ev(['SUMMARY:Day', 'DTSTART;VALUE=DATE:20260301', 'DTEND;VALUE=DATE:20260302'])), { now: NOW })
    expect(one.events).toHaveLength(1)
  })

  it('splits timed events across midnight', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:Night', 'DTSTART:20260301T220000', 'DTEND:20260302T060000'])), { now: NOW })
    expect(r.events.map((e) => [e.date, e.start, e.end])).toEqual([['2026-03-01', '22:00', '23:59'], ['2026-03-02', '00:00', '06:00']])
  })

  it('caps span at 31 days', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:Long', 'DTSTART;VALUE=DATE:20260101', 'DTEND;VALUE=DATE:20261201'])), { now: NOW })
    expect(r.events).toHaveLength(31)
  })

  it('expands weekly COUNT and BYDAY, daily UNTIL, monthly', () => {
    const w = parseIcs(wrap(ev(['SUMMARY:W', 'UID:w', 'DTSTART:20260105T090000', 'RRULE:FREQ=WEEKLY;COUNT=3'])), { now: NOW })
    expect(w.events.map((e) => e.date)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19'])
    const b = parseIcs(wrap(ev(['SUMMARY:B', 'DTSTART;VALUE=DATE:20260105', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=4'])), { now: NOW })
    expect(b.events.map((e) => e.date)).toEqual(['2026-01-05', '2026-01-07', '2026-01-12', '2026-01-14'])
    const d = parseIcs(wrap(ev(['SUMMARY:D', 'DTSTART;VALUE=DATE:20260101', 'RRULE:FREQ=DAILY;UNTIL=20260104T000000Z'])), { now: NOW })
    expect(d.events).toHaveLength(4)
    const m = parseIcs(wrap(ev(['SUMMARY:M', 'DTSTART;VALUE=DATE:20260131', 'RRULE:FREQ=MONTHLY;COUNT=3'])), { now: NOW })
    expect(m.events.map((e) => e.date)).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('limits unbounded rules to one year ahead and honours EXDATE', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:Y', 'DTSTART;VALUE=DATE:20260101', 'RRULE:FREQ=MONTHLY', 'EXDATE;VALUE=DATE:20260201'])), { now: NOW })
    expect(r.events[0].date).toBe('2026-01-01')
    expect(r.events.some((e) => e.date === '2026-02-01')).toBe(false)
    expect(r.events.at(-1)!.date <= '2027-01-01').toBe(true)
  })

  it('skips exotic rules, cancelled events and reports them', () => {
    const r = parseIcs(wrap([ev(['SUMMARY:Ex', 'DTSTART:20260101T100000', 'RRULE:FREQ=MONTHLY;BYDAY=2TU']), ev(['SUMMARY:Yr', 'DTSTART:20260101T100000', 'RRULE:FREQ=YEARLY']), ev(['SUMMARY:X', 'STATUS:CANCELLED', 'DTSTART:20260101T100000']), ev(['SUMMARY:Ok', 'DTSTART:20260101T100000'])].join('\r\n')), { now: NOW })
    expect(r.events.map((e) => e.title)).toEqual(['Ok'])
    expect(r.skipped.map((s) => s.title)).toEqual(['Ex', 'Yr', 'X'])
    expect(r.total).toBe(4)
  })

  it('applies RECURRENCE-ID overrides and ignores VALARM contents', () => {
    const r = parseIcs(wrap([ev(['SUMMARY:S', 'UID:s', 'DTSTART:20260105T090000', 'RRULE:FREQ=WEEKLY;COUNT=2', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'DESCRIPTION:alarm', 'END:VALARM']), ev(['SUMMARY:S moved', 'UID:s', 'RECURRENCE-ID:20260112T090000', 'DTSTART:20260112T150000'])].join('\r\n')), { now: NOW })
    expect(r.events.map((e) => [e.title, e.date, e.start])).toEqual([['S', '2026-01-05', '09:00'], ['S moved', '2026-01-12', '15:00']])
    expect(r.events[0].notes).toBeUndefined()
  })

  it('reports events without a readable start', () => {
    const r = parseIcs(wrap(ev(['SUMMARY:Bad', 'DTSTART:garbage'])), { now: NOW })
    expect(r.events).toEqual([])
    expect(r.skipped[0].title).toBe('Bad')
  })
})
