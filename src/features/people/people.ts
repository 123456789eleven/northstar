import { db, logEvent, type Interaction, type ISODate, type Person } from '../../db'
import { addDays, daysBetween, parseISODate, toISODate, today } from '../../lib/dates'

export const CADENCES: { days: number; label: string }[] = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: 'Every 2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
  { days: 0, label: 'No reminder' },
]

export const KINDS: { value: Interaction['kind']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'call', label: 'Call' },
  { value: 'in-person', label: 'In person' },
  { value: 'other', label: 'Other' },
]

export function cadenceLabel(days: number) {
  return CADENCES.find((c) => c.days === days)?.label ?? `Every ${days} days`
}

export interface PersonStatus {
  /** Days until due; negative = overdue. null = no cadence. */
  dueIn: number | null
  text: string
  overdue: boolean
}

export function personStatus(p: Person, now: ISODate = today()): PersonStatus {
  if (!p.cadenceDays) return { dueIn: null, text: p.lastContact ? `Last contact ${ago(p.lastContact, now)}` : 'No reminder', overdue: false }
  if (!p.lastContact) return { dueIn: 0, text: 'Due now · never logged', overdue: true }
  const dueIn = daysBetween(now, addDays(p.lastContact, p.cadenceDays))
  if (dueIn < 0) return { dueIn, text: `Due ${plural(-dueIn, 'day')} ago`, overdue: true }
  if (dueIn === 0) return { dueIn, text: 'Due today', overdue: true }
  return { dueIn, text: `Due in ${plural(dueIn, 'day')}`, overdue: false }
}

/** Most overdue first; people without a cadence last, alphabetically. */
export function sortPeople(list: Person[], now: ISODate = today()) {
  return [...list]
    .map((p) => ({ p, s: personStatus(p, now) }))
    .sort((a, b) => {
      if (a.s.dueIn === null && b.s.dueIn === null) return a.p.name.localeCompare(b.p.name)
      if (a.s.dueIn === null) return 1
      if (b.s.dueIn === null) return -1
      return a.s.dueIn - b.s.dueIn || a.p.name.localeCompare(b.p.name)
    })
}

export function ago(d: ISODate, now: ISODate = today()) {
  const n = daysBetween(d, now)
  if (n <= 0) return 'today'
  if (n === 1) return 'yesterday'
  return `${plural(n, 'day')} ago`
}

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

/** Next occurrence of an MM-DD birthday on or after `from`. */
export function nextBirthday(mmdd: string, from: ISODate = today()): ISODate | null {
  const m = /^(\d{2})-(\d{2})$/.exec(mmdd)
  if (!m) return null
  const year = parseISODate(from).getFullYear()
  for (const y of [year, year + 1]) {
    const d = toISODate(new Date(y, Number(m[1]) - 1, Number(m[2])))
    if (d >= from) return d
  }
  return null
}

const EVENT_VERB: Record<Interaction['kind'], string> = {
  call: 'Called',
  text: 'Texted',
  'in-person': 'Saw',
  other: 'Caught up with',
}

export async function logContact(p: Person, kind: Interaction['kind'], note?: string, date: ISODate = today()) {
  if (p.id == null) return
  const clean = note?.trim() || undefined
  await db.transaction('rw', db.interactions, db.people, db.events, async () => {
    await db.interactions.add({ personId: p.id!, date, kind, note: clean })
    if (!p.lastContact || date > p.lastContact) await db.people.update(p.id!, { lastContact: date })
    await logEvent({
      area: 'relationships',
      kind: 'person.contact',
      title: `${EVENT_VERB[kind]} ${p.name}${clean ? ` — ${clean}` : ''}`,
      refTable: 'people',
      refId: p.id,
      ...(date === today() ? {} : { at: new Date(parseISODate(date).setHours(12)).toISOString() }),
    })
  })
}

export async function deleteInteraction(i: Interaction) {
  if (i.id == null) return
  await db.transaction('rw', db.interactions, db.people, async () => {
    await db.interactions.delete(i.id!)
    const rest = await db.interactions.where('personId').equals(i.personId).toArray()
    const last = rest.reduce<string | undefined>((m, r) => (!m || r.date > m ? r.date : m), undefined)
    await db.people.update(i.personId, { lastContact: last })
  })
}

export async function deletePerson(p: Person) {
  if (p.id == null) return
  await db.transaction('rw', db.people, db.interactions, async () => {
    await db.interactions.where('personId').equals(p.id!).delete()
    await db.people.delete(p.id!)
  })
}
