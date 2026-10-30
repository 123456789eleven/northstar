// Journal persistence. One entry row per date. Privacy: the timeline only ever gets a text-free
// 'Journal entry' event, once per day.
import { db, logEvent, type ISODate, type JournalEntry } from '../../db'
import { today } from '../../lib/dates'
import { extractTags } from './stats'

export type EntryPatch = Partial<Pick<JournalEntry, 'text' | 'mood' | 'energy'>>

export async function saveEntry(date: ISODate, patch: EntryPatch): Promise<number> {
  return db.transaction('rw', db.journal, db.events, async () => {
    const existing = await db.journal.where('date').equals(date).first()
    const next = { ...existing, ...patch }
    const text = next.text ?? ''
    const tags = extractTags(text)
    let id: number
    if (existing?.id != null) {
      id = existing.id
      await db.journal.update(id, { ...patch, tags })
    } else {
      id = (await db.journal.add({ date, text, mood: patch.mood, energy: patch.energy, tags, createdAt: new Date().toISOString() })) as number
    }
    if (text.trim()) {
      const logged = await db.events.where('area').equals('personal').filter((e) => e.kind === 'journal.entry' && e.refKey === date).first()
      if (!logged) await logEvent({ area: 'personal', kind: 'journal.entry', title: 'Journal entry', refTable: 'journal', refId: id, refKey: date })
    }
    return id
  })
}

/** Append a line to today's entry (used by the capture bar). Returns an undo that restores the previous text. */
export async function appendToToday(line: string): Promise<() => Promise<void>> {
  const date = today()
  const prev = await db.journal.where('date').equals(date).first()
  const before = prev?.text ?? ''
  await saveEntry(date, { text: before.trim() ? `${before.replace(/\s+$/, '')}\n${line}` : line })
  return async () => {
    const cur = await db.journal.where('date').equals(date).first()
    if (cur?.id == null) return
    if (!before.trim() && cur.mood == null && cur.energy == null) {
      await db.transaction('rw', db.journal, db.events, async () => {
        await db.journal.delete(cur.id!)
        await db.events.where('area').equals('personal').filter((e) => e.kind === 'journal.entry' && e.refKey === date).delete()
      })
    } else {
      await db.journal.update(cur.id, { text: before, tags: extractTags(before) })
    }
  }
}
