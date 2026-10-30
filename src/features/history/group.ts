import type { LifeEvent } from '../../db'
import { addDays, formatDate, parseISODate, startOfWeek, toISODate, today } from '../../lib/dates'

export const dayOf = (e: LifeEvent) => toISODate(new Date(e.at))

export interface DayGroup { day: string; items: LifeEvent[] }
export interface WeekGroup { weekOf: string; days: DayGroup[]; count: number }

/** Newest-first events grouped into weeks (Monday start) and, inside each, days. */
export function groupByWeek(events: LifeEvent[]): WeekGroup[] {
  const out: WeekGroup[] = []
  for (const e of events) {
    const d = dayOf(e)
    const w = startOfWeek(d)
    let wk = out[out.length - 1]
    if (!wk || wk.weekOf !== w) { wk = { weekOf: w, days: [], count: 0 }; out.push(wk) }
    wk.count++
    const last = wk.days[wk.days.length - 1]
    if (last && last.day === d) last.items.push(e)
    else wk.days.push({ day: d, items: [e] })
  }
  return out
}

export function weekLabel(weekOf: string, now = today()): string {
  const thisWeek = startOfWeek(now)
  if (weekOf === thisWeek) return 'This week'
  if (weekOf === addDays(thisWeek, -7)) return 'Last week'
  const end = addDays(weekOf, 6)
  const same = weekOf.slice(0, 7) === end.slice(0, 7)
  const range = `${formatDate(weekOf)} – ${same ? parseISODate(end).getDate() : formatDate(end)}`
  return weekOf.slice(0, 4) === now.slice(0, 4) ? range : `${range}, ${end.slice(0, 4)}`
}

/** Per-area milestone counts for a list, most frequent first. */
export function countByArea(events: LifeEvent[]): [string, number][] {
  const m = new Map<string, number>()
  for (const e of events) m.set(e.area, (m.get(e.area) ?? 0) + 1)
  return [...m].sort((a, b) => b[1] - a[1])
}
