// Test double: an in-memory stand-in for the Supabase vault tables, with the same rules as the SQL migration
// (server-assigned increasing seq on every write, keep-the-later client_updated_at on conflict). It also records
// every byte the client sent, so tests can assert that no plaintext ever leaves the device. Used only by tests.
import Dexie from 'dexie'
import { OfflineError, type PulledRow, type SyncBackend, type VaultRow } from './client'
import type { VaultMeta } from './crypto'
import { installOutbox, setTracking } from './outbox'

export class FakeVault implements SyncBackend {
  rows = new Map<string, PulledRow>()
  meta: (VaultMeta & { createdAt: string }) | null = null
  seq = 0
  offline = false
  /** JSON of every request body sent to the "server". */
  sent: string[] = []

  private guard() {
    if (this.offline) throw new OfflineError()
  }

  async getMeta() {
    this.guard()
    return this.meta
  }
  async createMeta(meta: VaultMeta) {
    this.guard()
    this.sent.push(JSON.stringify(meta))
    if (this.meta) throw new Error('duplicate key value violates unique constraint "vault_meta_pkey"')
    this.meta = { ...meta, createdAt: new Date().toISOString() }
  }
  async updateMeta(meta: VaultMeta) {
    this.guard()
    this.sent.push(JSON.stringify(meta))
    if (this.meta) this.meta = { ...this.meta, ...meta }
  }
  async push(rows: VaultRow[]) {
    this.guard()
    this.sent.push(JSON.stringify(rows))
    for (const r of rows) {
      const id = `${r.table_name}/${r.record_id}`
      const old = this.rows.get(id)
      if (old && r.client_updated_at < old.client_updated_at) continue // the trigger's last-writer-wins guard
      this.rows.set(id, { ...r, seq: ++this.seq })
    }
  }
  async pull(afterSeq: number, limit: number) {
    this.guard()
    return [...this.rows.values()].filter((r) => r.seq > afterSeq).sort((a, b) => a.seq - b.seq).slice(0, limit).map((r) => ({ ...r }))
  }
  async deleteAll() {
    this.guard()
    this.rows.clear()
    this.meta = null
  }
}

/** A second "device": a separate IndexedDB with the app's exact schema and the outbox installed. */
export function cloneDevice(source: Dexie, name: string): Dexie {
  const stores: Record<string, string> = {}
  for (const t of source.tables) {
    const spec = (i: { name: string; keyPath?: string | string[] | null; auto?: boolean; unique?: boolean; multi?: boolean; compound?: boolean }, primary: boolean) => {
      const path = Array.isArray(i.keyPath) ? `[${i.keyPath.join('+')}]` : (i.keyPath ?? i.name)
      if (primary) return (i.auto ? '++' : '') + path
      return (i.unique ? '&' : '') + (i.multi ? '*' : '') + path
    }
    stores[t.name] = [spec(t.schema.primKey, true), ...t.schema.indexes.map((i) => spec(i, false))].join(', ')
  }
  const d = new Dexie(name)
  d.version(source.verno).stores(stores)
  installOutbox(d)
  setTracking(d, true)
  return d
}
