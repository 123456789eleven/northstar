// Change tracking for the optional encrypted sync. Installed on the Dexie instance in db.ts.
//
// A DBCore middleware (the layer Dexie's own hooks are built on) sees every add/put/update/delete/clear on the
// synced tables and writes one outbox row per changed record *in the same transaction*, so a change can never be
// lost between the write and the queue. The outbox stores only (table, key, time): the payload is read and
// encrypted at push time. Nothing here touches the network and nothing is recorded until sync is set up.
import type Dexie from 'dexie'
import type { DBCore, DBCoreMutateRequest, DBCoreMutateResponse, DBCoreTable, DBCoreTransaction, Middleware } from 'dexie'

export const OUTBOX = 'outbox'
export const SYNC_META = 'syncMeta'
export const INTERNAL_TABLES = new Set([OUTBOX, SYNC_META])

/** Settings that describe this device, not the person: never synced. */
const LOCAL_SETTING_PREFIXES = ['sync.', 'gcal.']
const LOCAL_SETTING_KEYS = new Set(['backup.lastAt', 'ops.autolog', 'food.lookup.optin'])
export function isLocalOnlySetting(key: unknown): boolean {
  return typeof key !== 'string' || LOCAL_SETTING_KEYS.has(key) || LOCAL_SETTING_PREFIXES.some((p) => key.startsWith(p))
}

export interface OutboxRow {
  table: string
  key: number | string
  /** ISO time of the local change: the last-writer-wins timestamp. */
  at: string
  /** Changes on every write so a push only clears entries it actually sent. */
  rev: number
}

export interface SyncMetaRow {
  table: string
  key: number | string
  /** Stable id shared by every device (random uuid, or keyed-hash of a natural key). */
  syncId: string
  /** Timestamp of the version this device last pushed or applied. */
  updatedAt?: string
  deleted?: boolean
  /** Foreign keys whose target has not arrived on this device yet: field -> target syncId. */
  unresolved?: Record<string, string>
}

export interface OutboxController {
  /** Record changes into the outbox (true once sync has been set up on this device). */
  tracking: boolean
  /** >0 while a backup import or similar bulk replace runs: changes are not queued. */
  suppress: number
  /** Called after a tracked change (used to schedule a background sync). */
  onChange?: () => void
}

const controllers = new WeakMap<object, OutboxController>()
const APPLYING = '__northstarSyncApply'

export function outboxController(db: Dexie): OutboxController {
  let c = controllers.get(db)
  if (!c) {
    c = { tracking: false, suppress: 0 }
    controllers.set(db, c)
  }
  return c
}

/** Runs fn with change tracking suppressed (backup import, local erase). */
export async function withSyncSuppressed<T>(db: Dexie, fn: () => Promise<T>): Promise<T> {
  const c = outboxController(db)
  c.suppress++
  try {
    return await fn()
  } finally {
    c.suppress--
  }
}

/** Marks the current Dexie transaction as "applying pulled data" so its writes are not queued back. */
export function markApplying(tx: { idbtrans?: unknown } | null | undefined) {
  if (tx?.idbtrans) (tx.idbtrans as Record<string, unknown>)[APPLYING] = true
}

let lastAt = 0
let revSeq = 0
/** Strictly increasing ISO timestamps on this device, so two quick edits never tie. */
export function nextChangeTime(): string {
  const now = Math.max(Date.now(), lastAt + 1)
  lastAt = now
  return new Date(now).toISOString()
}

function nextRev() {
  revSeq = (revSeq + 1) % 1_000_000
  return Date.now() * 1000 + revSeq
}

function createMiddleware(ctl: OutboxController): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'northstar-sync-outbox',
    create(down) {
      const widened = new WeakSet<DBCoreTransaction>()
      return {
        ...down,
        transaction(stores, mode, options) {
          const touchesSynced = mode === 'readwrite' && ctl.tracking && stores.some((s) => !INTERNAL_TABLES.has(s))
          const finalStores = touchesSynced && !stores.includes(OUTBOX) ? [...stores, OUTBOX] : stores
          const trans = down.transaction(finalStores, mode, options)
          if (touchesSynced || (mode === 'readwrite' && stores.includes(OUTBOX))) widened.add(trans)
          return trans
        },
        table(name) {
          const table = down.table(name)
          if (INTERNAL_TABLES.has(name)) return table
          const outbox = (): DBCoreTable => down.table(OUTBOX)
          const isSettings = name === 'settings'
          return {
            ...table,
            async mutate(req: DBCoreMutateRequest): Promise<DBCoreMutateResponse> {
              const trans = req.trans as DBCoreTransaction & Record<string, unknown>
              if (!ctl.tracking || ctl.suppress > 0 || trans[APPLYING] || !widened.has(req.trans)) return table.mutate(req)

              let keys: unknown[] = []
              if (req.type === 'deleteRange') {
                const res = await table.query({ trans: req.trans, values: false, query: { index: table.schema.primaryKey, range: req.range } })
                keys = res.result
              } else if (req.type === 'delete') {
                keys = req.keys
              }
              const res = await table.mutate(req)
              if (req.type === 'add' || req.type === 'put') {
                const fromValues = req.values.map((v, i) => res.results?.[i] ?? req.keys?.[i] ?? table.schema.primaryKey.extractKey?.(v))
                keys = [...fromValues, ...((req.type === 'put' ? req.updates?.keys : undefined) ?? [])].filter((_, i) => i >= req.values.length || !res.failures[i])
              }
              const at = nextChangeTime()
              const rows: OutboxRow[] = []
              const seen = new Set<unknown>()
              for (const key of keys) {
                if (key == null || seen.has(key) || (typeof key !== 'number' && typeof key !== 'string')) continue
                if (isSettings && isLocalOnlySetting(key)) continue
                seen.add(key)
                rows.push({ table: name, key, at, rev: nextRev() })
              }
              if (rows.length) {
                await outbox().mutate({ type: 'put', trans: req.trans, values: rows })
                if (ctl.onChange) setTimeout(ctl.onChange, 0)
              }
              return res
            },
          }
        },
      }
    },
  }
}

const LOCAL_FLAG = 'northstar.sync.tracking'

function readLocalFlag(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCAL_FLAG) === '1'
  } catch {
    return false
  }
}

/** Persists the tracking flag in localStorage (device-local, readable synchronously before the first write). */
export function setTracking(db: Dexie, on: boolean) {
  outboxController(db).tracking = on
  try {
    if (typeof localStorage !== 'undefined') {
      if (on) localStorage.setItem(LOCAL_FLAG, '1')
      else localStorage.removeItem(LOCAL_FLAG)
    }
  } catch {
    // Storage blocked: tracking still works for this session.
  }
}

/** Called once from db.ts, before the database opens. */
export function installOutbox(db: Dexie, opts: { autoStart?: boolean } = {}) {
  const ctl = outboxController(db)
  ctl.tracking = readLocalFlag()
  db.use(createMiddleware(ctl))
  // Background sync only loads (lazily, with the Supabase client) when sync was turned on for this device.
  if (opts.autoStart && ctl.tracking && typeof window !== 'undefined') {
    setTimeout(() => {
      void import('./manager').then((m) => m.autoStart()).catch(() => undefined)
    }, 1500)
  }
}
