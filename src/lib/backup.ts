// User-initiated backup: export every Dexie table to a JSON file, import one back.
// Nothing here touches the network — the file goes wherever the user saves it.
import { db, getSetting, setSetting } from '../db'
import { today } from './dates'

export interface BackupFile {
  app: 'northstar'
  version: number
  exportedAt: string
  tables: Record<string, unknown[]>
}

export const BACKUP_LAST_KEY = 'backup.lastAt'
export const BACKUP_REMIND_DAYS = 14

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tables[t.name] = await t.toArray()
  })
  return { app: 'northstar', version: db.verno, exportedAt: new Date().toISOString(), tables }
}

/** Builds the backup, triggers a download, and records the time. */
export async function exportBackup() {
  // Record the time first so the file itself carries it (otherwise a restore reverts to "never backed up").
  await setSetting(BACKUP_LAST_KEY, new Date().toISOString())
  const data = await buildBackup()
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `northstar-backup-${today()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return data
}

export interface ParsedBackup {
  data: BackupFile
  counts: { table: string; rows: number }[]
  /** Tables in the file this version of the app doesn't know about (ignored on import). */
  unknown: string[]
}

export const MAX_BACKUP_BYTES = 50 * 1024 * 1024

/** Parses and validates a backup file. Throws an Error with a plain-language message on failure. */
export async function parseBackup(file: File): Promise<ParsedBackup> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error(`This file is ${(file.size / 1048576).toFixed(0)} MB, which is too large for a Northstar backup (limit 50 MB).`)
  if (!/.json$/i.test(file.name) && file.type && !/json|text/.test(file.type)) throw new Error('This does not look like a backup file. Choose a northstar-backup-....json file.')
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!raw || typeof raw !== 'object') throw new Error('This file is not a Northstar backup.')
  const obj = raw as Partial<BackupFile>
  if (obj.app !== 'northstar') throw new Error('This file is not a Northstar backup.')
  if (typeof obj.version !== 'number') throw new Error('The backup is missing its version number.')
  if (obj.version > db.verno) throw new Error(`This backup came from a newer version of Northstar (v${obj.version}). Update the app first.`)
  if (!obj.tables || typeof obj.tables !== 'object') throw new Error('The backup has no tables.')

  const known = new Set(db.tables.map((t) => t.name))
  const counts: ParsedBackup['counts'] = []
  const unknown: string[] = []
  for (const [name, rows] of Object.entries(obj.tables)) {
    if (!Array.isArray(rows)) throw new Error(`Table "${name}" is malformed.`)
    if (!rows.every((r) => r && typeof r === 'object')) throw new Error(`Table "${name}" contains invalid rows.`)
    if (known.has(name)) counts.push({ table: name, rows: rows.length })
    else unknown.push(name)
  }
  return { data: obj as BackupFile, counts, unknown }
}

/** Replaces ALL local data with the backup's contents in one transaction. */
export async function importBackup(data: BackupFile) {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      await t.clear()
      const rows = data.tables[t.name]
      if (rows?.length) await t.bulkAdd(rows as never[])
    }
  })
}

export async function eraseAll() {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
  })
}

/** Days since the last export, or null if never exported. */
export async function daysSinceBackup(): Promise<number | null> {
  const at = await getSetting<string | null>(BACKUP_LAST_KEY, null)
  if (!at) return null
  return Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000)
}
