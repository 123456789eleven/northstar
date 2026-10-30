// Local-first sync: Dexie stays the source of truth. The engine pushes encrypted copies of locally changed
// records and pulls other devices' encrypted changes by a server sequence cursor. Per-record last-writer-wins
// on the timestamp inside the ciphertext (ties broken consistently with the server: the later arrival wins).
import type Dexie from 'dexie'
import type { Table, Transaction } from 'dexie'
import type { SyncBackend, VaultRow } from './client'
import { decryptRecord, DecryptError, deterministicId, encryptRecord, type VaultKeys } from './crypto'
import { INTERNAL_TABLES, isLocalOnlySetting, markApplying, OUTBOX, SYNC_META, type OutboxRow, type SyncMetaRow } from './outbox'
import { applyRank, foreignKeysOf, naturalKey, uniqueLookup } from './schema'

/** Timestamp for records queued by a first-sync merge: any version already in the cloud wins over them. */
export const MERGE_TS = '1970-01-01T00:00:00.000Z'
export const CURSOR_KEY = 'sync.cursor'
export const DEVICE_KEY = 'sync.deviceId'
const PUSH_BATCH = 200
const PULL_PAGE = 500
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/** What is inside every ciphertext. */
export interface Payload {
  updatedAt: string
  device: string
  deleted?: boolean
  data?: Record<string, unknown>
  /** Foreign keys as target syncIds (local ids mean nothing on another device). */
  refs?: Record<string, string>
}

export interface SyncResult {
  pushed: number
  pulled: number
  applied: number
  conflicts: number
  skippedUnknownTables: number
}

type Key = number | string
type AnyRecord = Record<string, unknown>

function isPayload(p: unknown): p is Payload {
  if (!p || typeof p !== 'object') return false
  const o = p as Payload
  if (typeof o.updatedAt !== 'string' || !ISO.test(o.updatedAt) || typeof o.device !== 'string') return false
  if (o.deleted) return true
  if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) return false
  if (o.refs !== undefined && (typeof o.refs !== 'object' || o.refs === null || Object.values(o.refs).some((v) => typeof v !== 'string'))) return false
  return true
}

export class SyncEngine {
  private readonly db: Dexie
  private readonly backend: SyncBackend
  private readonly keys: VaultKeys
  private running: Promise<SyncResult> | null = null
  private deviceId: string | null = null

  constructor(db: Dexie, backend: SyncBackend, keys: VaultKeys) {
    this.db = db
    this.backend = backend
    this.keys = keys
  }

  private get outbox(): Table<OutboxRow, [string, Key]> { return this.db.table(OUTBOX) }
  private get meta(): Table<SyncMetaRow, [string, Key]> { return this.db.table(SYNC_META) }
  private get settings(): Table<{ key: string; value: unknown }, string> { return this.db.table('settings') }

  private synced = (name: string) => !INTERNAL_TABLES.has(name) && this.db.tables.some((t) => t.name === name)
  private syncedTables = () => this.db.tables.filter((t) => !INTERNAL_TABLES.has(t.name))
  private isAuto = (table: string) => !!this.db.table(table).schema.primKey.auto
  private pkPath = (table: string) => this.db.table(table).schema.primKey.keyPath as string

  private async device(): Promise<string> {
    if (this.deviceId) return this.deviceId
    const row = await this.settings.get(DEVICE_KEY)
    if (typeof row?.value === 'string') return (this.deviceId = row.value)
    const id = crypto.randomUUID()
    await this.settings.put({ key: DEVICE_KEY, value: id })
    return (this.deviceId = id)
  }

  async pendingCount(): Promise<number> {
    return this.outbox.count()
  }

  /** One full round: pull remote changes, then push local ones. Concurrent calls share the same run. */
  sync(): Promise<SyncResult> {
    if (!this.running) {
      this.running = (async () => {
        const r: SyncResult = { pushed: 0, pulled: 0, applied: 0, conflicts: 0, skippedUnknownTables: 0 }
        await this.pull(r)
        await this.push(r)
        return r
      })().finally(() => { this.running = null })
    }
    return this.running
  }

  // ---------- ids ----------

  private async syncIdOf(table: string, key: unknown): Promise<string | null> {
    if (key == null || (typeof key !== 'number' && typeof key !== 'string') || !this.synced(table)) return null
    const m = await this.meta.get([table, key])
    if (m) return m.syncId
    const rec = (await this.db.table(table).get(key)) as AnyRecord | undefined
    if (!rec) return null
    return this.assign(table, key, rec)
  }

  /** Gives a local record its cross-device id. Records first seen here are queued so they reach the cloud. */
  private async assign(table: string, key: Key, rec: AnyRecord): Promise<string> {
    const nk = await naturalKey(table, rec, (t, k) => this.syncIdOf(t, k))
    let id = nk != null ? await deterministicId(this.keys, table, nk) : crypto.randomUUID()
    if (nk != null && (await this.meta.where('[table+syncId]').equals([table, id]).first())) id = crypto.randomUUID()
    await this.meta.put({ table, key, syncId: id })
    if (!(await this.outbox.get([table, key]))) await this.outbox.put({ table, key, at: MERGE_TS, rev: 0 })
    return id
  }

  private async toWire(table: string, rec: AnyRecord, m: SyncMetaRow | undefined) {
    const data: AnyRecord = { ...rec }
    if (this.isAuto(table)) delete data[this.pkPath(table)]
    const refs: Record<string, string> = {}
    for (const [field, target] of Object.entries(foreignKeysOf(table, rec, this.synced))) {
      const v = rec[field]
      delete data[field]
      const sid = v != null ? await this.syncIdOf(target, v) : (m?.unresolved?.[field] ?? null)
      if (sid) refs[field] = sid
    }
    return { data, refs }
  }

  // ---------- push ----------

  private async push(r: SyncResult) {
    const device = await this.device()
    for (let round = 0; round < 1000; round++) {
      const entries = await this.outbox.orderBy('at').limit(PUSH_BATCH).toArray()
      if (!entries.length) return
      const rows: VaultRow[] = []
      const sent: { e: OutboxRow; deleted: boolean }[] = []
      for (const e of entries) {
        if (!this.synced(e.table) || (e.table === 'settings' && isLocalOnlySetting(e.key))) {
          await this.outbox.delete([e.table, e.key])
          continue
        }
        const rec = (await this.db.table(e.table).get(e.key)) as AnyRecord | undefined
        let m = await this.meta.get([e.table, e.key])
        let payload: Payload
        if (!rec) {
          if (!m) { await this.outbox.delete([e.table, e.key]); continue } // created and deleted before it was ever sent
          payload = { updatedAt: e.at, device, deleted: true }
        } else {
          if (!m) {
            await this.assign(e.table, e.key, rec)
            m = await this.meta.get([e.table, e.key])
          }
          payload = { updatedAt: e.at, device, ...(await this.toWire(e.table, rec, m)) }
        }
        const box = await encryptRecord(this.keys, e.table, m!.syncId, payload)
        rows.push({ table_name: e.table, record_id: m!.syncId, ...box, deleted: !rec, client_updated_at: e.at })
        sent.push({ e, deleted: !rec })
      }
      if (rows.length) await this.backend.push(rows)
      await this.db.transaction('rw', [this.outbox, this.meta], async () => {
        for (const { e, deleted } of sent) {
          const cur = await this.outbox.get([e.table, e.key])
          if (cur && cur.rev === e.rev && cur.at === e.at) await this.outbox.delete([e.table, e.key])
          await this.meta.update([e.table, e.key], { updatedAt: e.at, deleted })
        }
      })
      r.pushed += rows.length
    }
  }

  // ---------- pull ----------

  private async cursor(): Promise<number> {
    const v = (await this.settings.get(CURSOR_KEY))?.value
    return typeof v === 'number' ? v : 0
  }

  private async pull(r: SyncResult) {
    let cursor = await this.cursor()
    for (;;) {
      const rows = await this.backend.pull(cursor, PULL_PAGE)
      if (!rows.length) return
      // Decrypt the whole page before touching local data: any failure aborts with nothing applied (fail closed).
      const decoded: { table: string; syncId: string; p: Payload }[] = []
      for (const row of rows) {
        if (!this.synced(row.table_name)) { r.skippedUnknownTables++; continue }
        const p = await decryptRecord(this.keys, row.table_name, row.record_id, row.ciphertext, row.nonce)
        if (!isPayload(p)) throw new DecryptError('A cloud record decrypted to something that is not a Northstar record.')
        decoded.push({ table: row.table_name, syncId: row.record_id, p })
      }
      const maxSeq = rows.reduce((n, row) => Math.max(n, row.seq), cursor)
      decoded.sort((a, b) => applyRank(a.table) - applyRank(b.table))
      const me = await this.device()
      await this.db.transaction('rw', this.db.tables, async (tx: Transaction) => {
        markApplying(tx as unknown as { idbtrans: unknown })
        for (const d of decoded) {
          const outcome = await this.applyOne(d.table, d.syncId, d.p, me)
          if (outcome === 'applied') r.applied++
          else if (outcome === 'conflict') r.conflicts++
        }
        await this.resolvePending()
        await this.settings.put({ key: CURSOR_KEY, value: maxSeq })
      })
      r.pulled += rows.length
      cursor = maxSeq
      if (rows.length < PULL_PAGE) return
    }
  }

  private fkTarget(table: string, field: string, data: AnyRecord): string | null {
    return foreignKeysOf(table, data, this.synced)[field] ?? null
  }

  private async lookup(table: string, syncId: string) {
    return this.meta.where('[table+syncId]').equals([table, syncId]).first()
  }

  private async applyOne(table: string, syncId: string, p: Payload, me: string): Promise<'applied' | 'skipped' | 'conflict'> {
    const T = this.db.table(table)
    const auto = this.isAuto(table)
    const pk = this.pkPath(table)
    const m = await this.lookup(table, syncId)
    const data: AnyRecord = p.deleted ? {} : { ...p.data }
    if (auto) delete data[pk]
    if (table === 'settings' && !p.deleted && isLocalOnlySetting(data.key)) return 'skipped'

    const unresolved: Record<string, string> = {}
    if (!p.deleted) {
      for (const [field, sid] of Object.entries(p.refs ?? {})) {
        const target = this.fkTarget(table, field, data)
        if (!target) continue
        const tm = await this.lookup(target, sid)
        if (tm && !tm.deleted) data[field] = tm.key
        else unresolved[field] = sid
      }
    }

    // Which local row is this?
    let key: Key | undefined = m?.key
    if (key == null && !p.deleted) {
      if (table === 'settings') key = data.key as string
      else {
        const u = uniqueLookup(table, data)
        const existing = u ? ((await T.where(u.index).equals(u.value as never).first()) as AnyRecord | undefined) : undefined
        if (existing) key = existing[pk] as Key
      }
      if (key != null) {
        const other = await this.meta.get([table, key])
        if (other && other.syncId !== syncId) return 'conflict'
      }
    }
    if (key == null && p.deleted) return 'skipped'

    // Last writer wins.
    const pending = key != null ? await this.outbox.get([table, key]) : undefined
    const localTs = pending?.at ?? m?.updatedAt
    if (localTs) {
      if (p.updatedAt < localTs) return 'skipped'
      if (p.updatedAt === localTs && (p.device === me || pending)) return 'skipped'
    }

    if (p.deleted) {
      await T.delete(key!)
      await this.outbox.delete([table, key!])
      await this.meta.put({ table, key: key!, syncId, updatedAt: p.updatedAt, deleted: true })
      return 'applied'
    }

    // A different local row already holds this unique value (e.g. a budget renamed on another device): keep ours.
    const u = uniqueLookup(table, data)
    if (u) {
      const clash = (await T.where(u.index).equals(u.value as never).first()) as AnyRecord | undefined
      if (clash && clash[pk] !== key) return 'conflict'
    }

    if (key != null) await T.put(auto ? { ...data, [pk]: key } : data)
    else key = (await T.add(data)) as Key
    await this.outbox.delete([table, key])
    await this.meta.put({ table, key, syncId, updatedAt: p.updatedAt, ...(Object.keys(unresolved).length ? { unresolved } : {}) })
    return 'applied'
  }

  /** Fills in foreign keys whose targets arrived later than the records pointing at them. */
  private async resolvePending() {
    const waiting = await this.meta.filter((m) => !!m.unresolved).toArray()
    for (const m of waiting) {
      if (!this.synced(m.table)) continue
      const T = this.db.table(m.table)
      const rec = (await T.get(m.key)) as AnyRecord | undefined
      if (!rec) continue
      const changes: AnyRecord = {}
      const left: Record<string, string> = {}
      for (const [field, sid] of Object.entries(m.unresolved!)) {
        const target = this.fkTarget(m.table, field, rec)
        const tm = target ? await this.lookup(target, sid) : undefined
        if (tm && !tm.deleted) changes[field] = tm.key
        else left[field] = sid
      }
      if (Object.keys(changes).length) {
        await T.update(m.key, changes)
        const next: SyncMetaRow = { ...m }
        if (Object.keys(left).length) next.unresolved = left
        else delete next.unresolved
        await this.meta.put(next)
      }
    }
  }

  // ---------- bulk operations ----------

  /**
   * Queues every local record. 'merge' (first sync, default) uses MERGE_TS so versions already in the cloud
   * win and records only on this device are added. 'replace' uses the current time so this device wins.
   */
  async enqueueAll(mode: 'merge' | 'replace') {
    const at = mode === 'merge' ? MERGE_TS : new Date().toISOString()
    for (const t of this.syncedTables()) {
      const keys = (await t.toCollection().primaryKeys()) as Key[]
      const rows: OutboxRow[] = []
      for (const key of keys) {
        if (t.name === 'settings' && isLocalOnlySetting(key)) continue
        if (mode === 'merge' && (await this.outbox.get([t.name, key]))) continue
        rows.push({ table: t.name, key, at, rev: 0 })
      }
      if (rows.length) await this.outbox.bulkPut(rows)
    }
  }

  /** Makes the cloud match this device exactly (after restoring a backup): tombstones cloud-only records, pushes everything. */
  async replaceCloudWithLocal(): Promise<SyncResult> {
    const device = await this.device()
    const now = new Date().toISOString()
    const toDelete: VaultRow[] = []
    let cursor = 0
    for (;;) {
      const rows = await this.backend.pull(cursor, PULL_PAGE)
      for (const row of rows) {
        if (row.deleted) continue
        const m = await this.lookup(row.table_name, row.record_id)
        const exists = m && this.synced(m.table) && (await this.db.table(m.table).get(m.key))
        if (!exists) {
          const box = await encryptRecord(this.keys, row.table_name, row.record_id, { updatedAt: now, device, deleted: true } satisfies Payload)
          toDelete.push({ table_name: row.table_name, record_id: row.record_id, ...box, deleted: true, client_updated_at: now })
        }
        cursor = Math.max(cursor, row.seq)
      }
      if (rows.length < PULL_PAGE) break
    }
    if (toDelete.length) await this.backend.push(toDelete)
    await this.enqueueAll('replace')
    await this.settings.put({ key: CURSOR_KEY, value: cursor })
    return this.sync()
  }
}
