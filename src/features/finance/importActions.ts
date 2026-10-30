// CSV import commit/undo. Kept out of the React component so the History event stays in sync with the data.
import { db, getSetting, logEvent, setSetting, type Transaction } from '../../db'
import { IMPORTS_KEY, type ImportRecord } from './model'

export const IMPORT_EVENT_KIND = 'finance.import'

const importTitle = (n: number, file: string) => `Imported ${n} transaction${n === 1 ? '' : 's'} from ${file}`

export async function commitImport(file: string, txs: Omit<Transaction, 'id' | 'importBatch'>[], skipped: number, errors: number) {
  const batch = `imp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  const at = new Date().toISOString()
  await db.transaction('rw', db.transactions, db.settings, db.events, async () => {
    await db.transactions.bulkAdd(txs.map((t) => ({ ...t, importBatch: batch })))
    const rec: ImportRecord = { id: batch, at, file, added: txs.length, skipped, errors }
    await setSetting(IMPORTS_KEY, [rec, ...(await getSetting<ImportRecord[]>(IMPORTS_KEY, []))].slice(0, 50))
    await logEvent({ area: 'finance', kind: IMPORT_EVENT_KIND, title: importTitle(txs.length, file), refKey: batch, at })
  })
  return { batch, added: txs.length }
}

/** Removes an import's transactions, its record, and its History event. Returns transactions removed. */
export async function undoImport(batch: string): Promise<number> {
  let removed = 0
  await db.transaction('rw', db.transactions, db.settings, db.events, async () => {
    const records = await getSetting<ImportRecord[]>(IMPORTS_KEY, [])
    const rec = records.find((r) => r.id === batch)
    removed = await db.transactions.where('importBatch').equals(batch).count()
    await db.transactions.where('importBatch').equals(batch).delete()
    await setSetting(IMPORTS_KEY, records.filter((r) => r.id !== batch))

    const events = await db.events.where('area').equals('finance').filter((e) => e.kind === IMPORT_EVENT_KIND).toArray()
    const keyed = events.filter((e) => e.refKey === batch)
    if (keyed.length) {
      await db.events.bulkDelete(keyed.map((e) => e.id!))
    } else if (rec) {
      // Imports made before events carried a batch key: match on title and time, closest first.
      const want = importTitle(rec.added, rec.file)
      const t0 = new Date(rec.at).getTime()
      const near = events
        .filter((e) => e.refKey == null && e.title === want && Math.abs(new Date(e.at).getTime() - t0) <= 60_000)
        .sort((a, b) => Math.abs(new Date(a.at).getTime() - t0) - Math.abs(new Date(b.at).getTime() - t0))[0]
      if (near?.id != null) await db.events.delete(near.id)
    }
  })
  return removed
}
