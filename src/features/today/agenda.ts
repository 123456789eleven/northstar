// Today's agenda as a flat, time-ordered list for the mini time-rail (pure).
import type { CalendarEvent, ISODate } from '../../db'
import { allDayOn, daySegments, fmtTime } from '../planner/layout'
import { blockMeta } from '../planner/timeBlock'
import { isGoogleEvent } from '../gcal/help'

export type AgendaState = 'past' | 'now' | 'next' | 'later'
export type AgendaKind = 'event' | 'block' | 'training' | 'google' | 'allday'
export interface AgendaItem { key: string; title: string; label: string; start: number | null; end: number | null; state: AgendaState; kind: AgendaKind }

const kindOf = (e: CalendarEvent): AgendaKind => {
  const m = blockMeta(e)
  return m ? (m.kind === 'training' ? 'training' : 'block') : isGoogleEvent(e) ? 'google' : 'event'
}

export function agendaForDay(events: CalendarEvent[], date: ISODate, nowMin: number): AgendaItem[] {
  const allDay: AgendaItem[] = allDayOn(events, date).map((e) => ({ key: `a${e.id}`, title: e.title, label: 'All day', start: null, end: null, state: 'later', kind: 'allday' }))
  const timed: AgendaItem[] = daySegments(events, date).map((s) => ({
    key: `t${s.event.id}-${s.continued}`,
    title: s.event.title,
    label: `${fmtTime(s.start)} - ${fmtTime(s.end >= 1440 ? 1439 : s.end)}`,
    start: s.start,
    end: s.end,
    state: s.end <= nowMin ? 'past' : s.start <= nowMin ? 'now' : 'later',
    kind: kindOf(s.event),
  }))
  const nextIdx = timed.findIndex((i) => i.state === 'later')
  if (nextIdx >= 0 && !timed.some((i) => i.state === 'now')) timed[nextIdx].state = 'next'
  return [...allDay, ...timed]
}
