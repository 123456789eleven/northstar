import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../db'
import { agendaForDay } from './agenda'

const e = (id: number, title: string, start?: string, end?: string, uid?: string): CalendarEvent => ({ id, title, date: '2026-11-04', allDay: !start, start, end, uid })

describe('agendaForDay', () => {
  const evs = [e(1, 'Standup', '09:00', '09:30'), e(2, 'Lift', '12:00', '13:00', 'tb:training:0:abc'), e(3, 'Review', '15:00', '16:00', 'g:cal:x:2026-11-04'), e(4, 'Holiday')]
  it('orders all-day first, then by time, with kinds', () => {
    const a = agendaForDay(evs, '2026-11-04', 8 * 60)
    expect(a.map((i) => [i.title, i.kind])).toEqual([['Holiday', 'allday'], ['Standup', 'event'], ['Lift', 'training'], ['Review', 'google']])
  })
  it('marks past, now and next', () => {
    expect(agendaForDay(evs, '2026-11-04', 9 * 60 + 10).map((i) => i.state)).toEqual(['later', 'now', 'later', 'later'])
    expect(agendaForDay(evs, '2026-11-04', 10 * 60).map((i) => i.state)).toEqual(['later', 'past', 'next', 'later'])
  })
  it('is empty for a free day', () => {
    expect(agendaForDay([], '2026-11-04', 0)).toEqual([])
  })
})
