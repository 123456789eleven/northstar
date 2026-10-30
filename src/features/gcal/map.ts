// Pure mapping from Google Calendar API events to Northstar CalendarEvent rows.
import type { CalendarEvent } from '../../db'
import { addDays, toISODate } from '../../lib/dates'

export interface GoogleEvent {
  id: string
  status?: string
  summary?: string
  location?: string
  description?: string
  start?: { date?: string; dateTime?: string; timeZone?: string }
  end?: { date?: string; dateTime?: string; timeZone?: string }
}

export const GCAL_BATCH = 'gcal'
export const GCAL_PREFIX = 'g:'
export const MAX_DAYS = 31
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

export const uidFor = (calendarId: string, id: string, date: string) => `${GCAL_PREFIX}${calendarId}:${id}:${date}`

export function mapGoogleEvent(ev: GoogleEvent, calendarId: string): CalendarEvent[] {
  if (ev.status === 'cancelled' || !ev.start) return []
  const title = ev.summary?.trim() || 'Busy'
  const base = {
    title,
    ...(ev.location ? { location: ev.location } : {}),
    ...(ev.description?.trim() ? { notes: ev.description.trim().slice(0, 500) } : {}),
    importBatch: GCAL_BATCH,
  }
  const out: CalendarEvent[] = []
  if (ev.start.date) {
    const first = ev.start.date
    const endExcl = ev.end?.date && ev.end.date > first ? ev.end.date : addDays(first, 1)
    for (let d = first, i = 0; d < endExcl && i < MAX_DAYS; d = addDays(d, 1), i++)
      out.push({ ...base, date: d, allDay: true, uid: uidFor(calendarId, ev.id, d) })
    return out
  }
  if (!ev.start.dateTime) return []
  // Instants are converted to the device's local zone; the event's own timeZone only matters to Google.
  const s = new Date(ev.start.dateTime)
  const e = ev.end?.dateTime ? new Date(ev.end.dateTime) : s
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return []
  const firstDay = toISODate(s)
  let lastDay = toISODate(e)
  // An event ending exactly at local midnight belongs to the previous day.
  if (lastDay > firstDay && hhmm(e) === '00:00') lastDay = addDays(lastDay, -1)
  for (let d = firstDay, i = 0; d <= lastDay && i < MAX_DAYS; d = addDays(d, 1), i++) {
    const isFirst = d === firstDay
    const isLast = d === lastDay
    out.push({
      ...base,
      date: d,
      allDay: false,
      start: isFirst ? hhmm(s) : '00:00',
      end: isLast ? (hhmm(e) === '00:00' && !isFirst ? '23:59' : hhmm(e)) : '23:59',
      uid: uidFor(calendarId, ev.id, d),
    })
  }
  return out
}
