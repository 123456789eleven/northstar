// Calendar / contacts import commit + undo. Records live in settings so Data Hub can list and undo batches.
import { db, getSetting, logEvent, setSetting, type CalendarEvent, type Person } from '../../db'
import { icsKey, type IcsEvent } from './ics'
import type { VcfContact } from './vcf'

export const DATA_IMPORTS_KEY = 'data.imports'
export const DATA_EVENT_KIND = 'data.import'

export interface DataImportRecord {
  id: string
  kind: 'calendar' | 'contacts'
  at: string
  file: string
  added: number
  skipped: number
  /** Person ids (contacts have no batch column). */
  ids?: number[]
}

const newBatch = () => `dat-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
const title = (kind: DataImportRecord['kind'], n: number, file: string) =>
  kind === 'calendar' ? `Imported ${n} calendar event${n === 1 ? '' : 's'} from ${file}` : `Imported ${n} contact${n === 1 ? '' : 's'} from ${file}`

export async function getDataImports() {
  return getSetting<DataImportRecord[]>(DATA_IMPORTS_KEY, [])
}

async function record(rec: DataImportRecord) {
  await setSetting(DATA_IMPORTS_KEY, [rec, ...(await getDataImports())].slice(0, 50))
  await logEvent({ area: 'personal', kind: DATA_EVENT_KIND, title: title(rec.kind, rec.added, rec.file), refKey: rec.id, at: rec.at })
}

/** Which of these events are not already in the calendar (by uid+date) or earlier in the same file. */
export async function newCalendarEvents(events: IcsEvent[]) {
  const have = new Set((await db.calendar.toArray()).map((e) => icsKey(e)))
  const fresh: IcsEvent[] = []
  for (const e of events) {
    const k = icsKey(e)
    if (have.has(k)) continue
    have.add(k)
    fresh.push(e)
  }
  return fresh
}

export async function commitCalendar(file: string, events: IcsEvent[]) {
  const fresh = await newCalendarEvents(events)
  const id = newBatch()
  const at = new Date().toISOString()
  await db.transaction('rw', db.calendar, db.settings, db.events, async () => {
    await db.calendar.bulkAdd(fresh.map((e): CalendarEvent => ({ ...e, importBatch: id })))
    await record({ id, kind: 'calendar', at, file, added: fresh.length, skipped: events.length - fresh.length })
  })
  return { batch: id, added: fresh.length, skipped: events.length - fresh.length }
}

export async function existingNames() {
  return new Set((await db.people.toArray()).map((p) => p.name.trim().toLowerCase()))
}

export async function commitContacts(file: string, contacts: VcfContact[]) {
  const names = await existingNames()
  const fresh: VcfContact[] = []
  for (const c of contacts) {
    const k = c.name.trim().toLowerCase()
    if (names.has(k)) continue
    names.add(k)
    fresh.push(c)
  }
  const id = newBatch()
  const at = new Date().toISOString()
  let ids: number[] = []
  await db.transaction('rw', db.people, db.settings, db.events, async () => {
    ids = (await db.people.bulkAdd(
      fresh.map((c): Person => ({ name: c.name, relation: c.relation, cadenceDays: 0, ...(c.birthday && { birthday: c.birthday }), ...(c.notes && { notes: c.notes }) })),
      { allKeys: true },
    )) as number[]
    await record({ id, kind: 'contacts', at, file, added: fresh.length, skipped: contacts.length - fresh.length, ids })
  })
  return { batch: id, added: fresh.length, skipped: contacts.length - fresh.length }
}

/** Removes an import's rows, its record and its History event. Returns rows removed. */
export async function undoDataImport(batch: string): Promise<number> {
  let removed = 0
  await db.transaction('rw', [db.calendar, db.people, db.settings, db.events], async () => {
    const records = await getDataImports()
    const rec = records.find((r) => r.id === batch)
    if (rec?.kind === 'contacts') {
      removed = await db.people.where('id').anyOf(rec.ids ?? []).count()
      await db.people.bulkDelete(rec.ids ?? [])
    } else {
      removed = await db.calendar.where('importBatch').equals(batch).count()
      await db.calendar.where('importBatch').equals(batch).delete()
    }
    await setSetting(DATA_IMPORTS_KEY, records.filter((r) => r.id !== batch))
    const evs = await db.events.where('area').equals('personal').filter((e) => e.kind === DATA_EVENT_KIND && e.refKey === batch).toArray()
    await db.events.bulkDelete(evs.map((e) => e.id!))
  })
  return removed
}
