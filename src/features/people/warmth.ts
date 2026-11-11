// Pure maths for circle warmth, the 8-week form guide and the records strip. No React, no DB.
// Warmth is derived only from cadence and contact dates the app already stores.
import type { Interaction, ISODate, Person } from '../../db'
import { addDays, daysBetween, startOfWeek } from '../../lib/dates'

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** 1 on the day you spoke, 0.5 on the due date, 0 at twice the cadence. Never contacted = 0. No cadence = null (not counted). */
export function personWarmth(p: Pick<Person, 'cadenceDays' | 'lastContact'>, now: ISODate): number | null {
  if (!(p.cadenceDays > 0)) return null
  if (!p.lastContact) return 0
  return clamp01(1 - Math.max(0, daysBetween(p.lastContact, now)) / (2 * p.cadenceDays))
}

/** A person is warm while their cadence has not run out. */
export const isWarm = (p: Pick<Person, 'cadenceDays' | 'lastContact'>, now: ISODate) =>
  p.cadenceDays > 0 && !!p.lastContact && daysBetween(p.lastContact, now) < p.cadenceDays

export interface CircleWarmth { pct: number | null; tracked: number; warm: number; cooling: number; untracked: number }

export function circleWarmth(people: Pick<Person, 'cadenceDays' | 'lastContact'>[], now: ISODate): CircleWarmth {
  const vals = people.map((p) => personWarmth(p, now)).filter((v): v is number => v !== null)
  const warm = people.filter((p) => isWarm(p, now)).length
  return {
    pct: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) : null,
    tracked: vals.length,
    warm,
    cooling: vals.length - warm,
    untracked: people.length - vals.length,
  }
}

export type FormMark = 'W' | 'D' | 'L'
export interface FormWeek { start: ISODate; reached: number; total: number; mark: FormMark; current: boolean }
export const FORM_RULE = 'W: you reached at least half of the people you track that week. D: you reached some. L: nobody. The current week is still open until Sunday.'

/** Last `weeks` weeks (Monday start), oldest first. */
export function formGuide(people: Person[], interactions: Pick<Interaction, 'personId' | 'date'>[], now: ISODate, weeks = 8): FormWeek[] {
  const tracked = new Set(people.filter((p) => p.cadenceDays > 0).map((p) => p.id!))
  if (tracked.size === 0) return []
  const thisWeek = startOfWeek(now)
  const out: FormWeek[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i)
    const end = addDays(start, 6)
    const seen = new Set<number>()
    for (const x of interactions) if (tracked.has(x.personId) && x.date >= start && x.date <= end) seen.add(x.personId)
    const reached = seen.size
    out.push({ start, reached, total: tracked.size, mark: reached === 0 ? 'L' : reached * 2 >= tracked.size ? 'W' : 'D', current: i === 0 })
  }
  return out
}

/** Every date we know you were in touch with each person: logged interactions plus the stored last contact. */
function contactDates(people: Person[], interactions: Pick<Interaction, 'personId' | 'date'>[]): Map<number, ISODate[]> {
  const m = new Map<number, Set<ISODate>>()
  for (const p of people) if (p.id != null) m.set(p.id, new Set(p.lastContact ? [p.lastContact] : []))
  for (const x of interactions) m.get(x.personId)?.add(x.date)
  return new Map([...m].map(([id, s]) => [id, [...s].sort()]))
}

export interface Records {
  warmStretch: { days: number; start: ISODate; end: ISODate } | null
  busiestMonth: { count: number; month: string } | null
  oldestReconnect: { name: string; days: number; date: ISODate } | null
}

export const RECONNECT_DAYS = 60
export const MILESTONE_DAYS = 180

/** Records from the full contact history. Stretch = consecutive days on which everyone you were already tracking was inside their cadence. */
export function records(people: Person[], interactions: Pick<Interaction, 'personId' | 'date'>[], now: ISODate): Records {
  const dates = contactDates(people, interactions)

  let oldest: Records['oldestReconnect'] = null
  const perMonth = new Map<string, Set<number>>()
  for (const p of people) {
    const ds = dates.get(p.id!) ?? []
    for (let i = 0; i < ds.length; i++) {
      const month = ds[i].slice(0, 7)
      if (!perMonth.has(month)) perMonth.set(month, new Set())
      perMonth.get(month)!.add(p.id!)
      if (i > 0) {
        const gap = daysBetween(ds[i - 1], ds[i])
        if (gap >= RECONNECT_DAYS && (!oldest || gap > oldest.days)) oldest = { name: p.name, days: gap, date: ds[i] }
      }
    }
  }
  let busiest: Records['busiestMonth'] = null
  for (const [month, set] of perMonth) if (!busiest || set.size > busiest.count || (set.size === busiest.count && month > busiest.month)) busiest = { count: set.size, month }

  const tracked = people.filter((p) => p.cadenceDays > 0 && (dates.get(p.id!)?.length ?? 0) > 0)
  let stretch: Records['warmStretch'] = null
  if (tracked.length) {
    const first = tracked.reduce((m, p) => { const d = dates.get(p.id!)![0]; return d < m ? d : m }, now)
    const from = daysBetween(first, now) > 730 ? addDays(now, -730) : first
    const ptr = new Map(tracked.map((p) => [p.id!, 0]))
    let run = 0
    let runStart = from
    for (let d = from; d <= now; d = addDays(d, 1)) {
      let included = 0
      let allWarm = true
      for (const p of tracked) {
        const ds = dates.get(p.id!)!
        let k = ptr.get(p.id!)!
        while (k + 1 < ds.length && ds[k + 1] <= d) k++
        ptr.set(p.id!, k)
        if (ds[k] > d) continue
        included++
        if (daysBetween(ds[k], d) >= p.cadenceDays) allWarm = false
      }
      if (included > 0 && allWarm) {
        if (run === 0) runStart = d
        run++
        if (!stretch || run > stretch.days) stretch = { days: run, start: runStart, end: d }
      } else run = 0
    }
  }
  return { warmStretch: stretch, busiestMonth: busiest, oldestReconnect: oldest }
}
