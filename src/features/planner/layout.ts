// Pure planner date/grid logic. Dates are local YYYY-MM-DD; times are HH:MM 24h.
import type { CalendarEvent, ISODate } from '../../db'
import { addDays, startOfWeek } from '../../lib/dates'

export const DAY_MIN = 1440
export const DEFAULT_LEN = 60

export function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function fmtTime(min: number): string {
  const m = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN
  const h = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`.replace(':00 ', ' ')
}

/** Monday..Sunday of the week containing `anchor`. addDays works on local calendar dates, so DST weeks stay 7 distinct days. */
export const weekDates = (anchor: ISODate): ISODate[] => {
  const s = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

export interface Segment {
  event: CalendarEvent
  /** Minutes from midnight on the rendered day. */
  start: number
  end: number
  /** True when this is the spill-over of an event that began the previous day. */
  continued: boolean
}

/**
 * Timed segments that appear on `date`. An event whose end is at or before its start runs past midnight:
 * it is clipped to 24:00 on its own day and continues from 00:00 to its end time the next day.
 */
export function daySegments(events: CalendarEvent[], date: ISODate): Segment[] {
  const out: Segment[] = []
  const prev = addDays(date, -1)
  for (const event of events) {
    if (event.allDay || !event.start) continue
    const start = toMin(event.start)
    const rawEnd = event.end ? toMin(event.end) : start + DEFAULT_LEN
    const overnight = !!event.end && rawEnd <= start
    if (event.date === date) out.push({ event, start, end: overnight ? DAY_MIN : Math.min(rawEnd, DAY_MIN), continued: false })
    else if (overnight && event.date === prev && rawEnd > 0) out.push({ event, start: 0, end: rawEnd, continued: true })
  }
  return out.sort((a, b) => a.start - b.start || b.end - a.end || (a.event.title).localeCompare(b.event.title))
}

export const allDayOn = (events: CalendarEvent[], date: ISODate) =>
  events.filter((e) => e.date === date && (e.allDay || !e.start)).sort((a, b) => a.title.localeCompare(b.title))

export interface Placed extends Segment {
  col: number
  cols: number
}

/** Side-by-side columns for overlapping segments; each overlap cluster shares its own column count. */
export function layoutSegments(segs: Segment[]): Placed[] {
  const sorted = [...segs].sort((a, b) => a.start - b.start || b.end - a.end)
  const placed: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -1
  const closeCluster = () => {
    const cols = Math.max(1, ...cluster.map((p) => p.col + 1))
    for (const p of cluster) p.cols = cols
    placed.push(...cluster)
    cluster = []
  }
  for (const s of sorted) {
    if (cluster.length && s.start >= clusterEnd) closeCluster()
    // Lowest column whose last event has ended.
    const ends: number[] = []
    for (const p of cluster) ends[p.col] = Math.max(ends[p.col] ?? 0, p.end)
    let col = 0
    while (col < ends.length && ends[col] > s.start) col++
    cluster.push({ ...s, col, cols: 1 })
    clusterEnd = Math.max(clusterEnd, s.end)
  }
  if (cluster.length) closeCluster()
  return placed
}

/** Visible hour range for the day grid: 7:00-21:00 by default, stretched to fit events. */
export function hourRange(segs: Segment[], lo = 7, hi = 21): [number, number] {
  let a = lo
  let b = hi
  for (const s of segs) {
    a = Math.min(a, Math.floor(s.start / 60))
    b = Math.max(b, Math.ceil(s.end / 60))
  }
  return [a, Math.min(24, b)]
}

export function sortedUpcoming(events: CalendarEvent[], fromDate: ISODate, nowMin: number): CalendarEvent[] {
  const key = (e: CalendarEvent) => `${e.date} ${e.allDay || !e.start ? '00:00' : e.start}`
  return events
    .filter((e) => {
      if (e.date < fromDate) return false
      if (e.date > fromDate || e.allDay || !e.start) return true
      const end = e.end && toMin(e.end) > toMin(e.start) ? toMin(e.end) : toMin(e.start) + DEFAULT_LEN
      return end > nowMin // today's events that already ended drop off
    })
    .sort((a, b) => key(a).localeCompare(key(b)) || a.title.localeCompare(b.title))
}

export const timeLabel = (e: CalendarEvent) => (e.allDay || !e.start ? 'All day' : e.end ? `${fmtTime(toMin(e.start))} - ${fmtTime(toMin(e.end))}` : fmtTime(toMin(e.start)))
