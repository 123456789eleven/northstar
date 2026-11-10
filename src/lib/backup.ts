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

/** Settings whose key starts with any of these hold secrets: excluded from backups and kept across a restore.
 *  'market.finnhubKey' is the owner's own Finnhub API key (other market.* settings are plain preferences). */
export const SECRET_PREFIXES = ['simplefin.', 'market.finnhubKey'] as const
export const isSecretSetting = (key: unknown): boolean => typeof key === 'string' && SECRET_PREFIXES.some((p) => key.startsWith(p))
export const BACKUP_LAST_KEY = 'backup.lastAt'
export const BACKUP_LAST_ENCRYPTED_KEY = 'backup.lastEncrypted'
export const BACKUP_REMIND_KEY = 'backup.reminderDays'
export const BACKUP_REMIND_DAYS = 14
/** Reminder choices in days; 0 turns the reminder off. */
export const REMINDER_OPTIONS = [7, 14, 30, 0] as const

/** Days after which the backup nudge appears (0 = off). Device-local setting. */
export async function getReminderDays(): Promise<number> {
  const v = await getSetting<number>(BACKUP_REMIND_KEY, BACKUP_REMIND_DAYS)
  return (REMINDER_OPTIONS as readonly number[]).includes(v) ? v : BACKUP_REMIND_DAYS
}

export async function buildBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  await db.transaction('r', db.tables, async () => {
    for (const t of db.tables) tables[t.name] = await t.toArray()
  })
  // Device-only secrets (the SimpleFIN access URL, the Finnhub key) never go into a backup file.
  tables.settings = (tables.settings ?? []).filter((r) => !isSecretSetting((r as { key?: unknown }).key))
  return { app: 'northstar', version: db.verno, exportedAt: new Date().toISOString(), tables }
}

/** Hands bytes to the browser as a download. Nothing is uploaded anywhere. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Records when (and how) the last backup was made, before building it so the file itself carries it. */
export async function markBackup(encrypted: boolean) {
  await setSetting(BACKUP_LAST_KEY, new Date().toISOString())
  await setSetting(BACKUP_LAST_ENCRYPTED_KEY, encrypted)
}

/** Builds the plain (unencrypted) backup, triggers a download, and records the time. */
export async function exportBackup() {
  await markBackup(false)
  const data = await buildBackup()
  downloadBlob(new Blob([JSON.stringify(data)], { type: 'application/json' }), `northstar-backup-${today()}.json`)
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
  return parseBackupText(await file.text())
}

/** Validates the text of a plain backup file. */
export function parseBackupText(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
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
    const secrets = await db.settings.filter((r) => isSecretSetting(r.key)).toArray()
    for (const t of db.tables) {
      await t.clear()
      const rows = data.tables[t.name]
      if (rows?.length) await t.bulkAdd((t.name === 'settings' ? rows.filter((r) => !isSecretSetting((r as { key?: unknown }).key)) : rows) as never[])
    }
    if (secrets.length) await db.settings.bulkPut(secrets)
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
