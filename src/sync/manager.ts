// App-side glue for sync: config, account, unlocking, the background loop and the status other modules read.
// Nothing here runs unless the person turns sync on in Settings.
import Dexie from 'dexie'
import { db, getSetting, setSetting } from '../db'
import { envConfig, getSupabase, OfflineError, supabaseBackend, validateConfig, type SyncBackend, type SyncConfig } from './client'
import {
  createVault, DecryptError, resetPassphrase, unlockWithPassphrase, unlockWithRecoveryCode, type CreatedVault, type VaultKeys,
} from './crypto'
import { CURSOR_KEY, DEVICE_KEY, SyncEngine } from './engine'
import { OUTBOX, outboxController, setTracking, SYNC_META, withSyncSuppressed } from './outbox'

export type SyncState = 'off' | 'locked' | 'syncing' | 'up-to-date' | 'offline' | 'error'
export interface SyncStatus {
  state: SyncState
  lastSyncedAt: string | null
  pending: number
  error?: string
}

export const STATUS_KEY = 'sync.status'
export const CONFIG_KEY = 'sync.config'
export const ENABLED_KEY = 'sync.enabled'
export const RESTORED_KEY = 'sync.restoredBackup'
const VAULT_KEY = 'sync.vault' // { userId, createdAt } of the vault this device is linked to

// ---------- small observable for in-memory state (session, unlocked) ----------
interface Live { email: string | null; userId: string | null; unlocked: boolean; checked: boolean }
let live: Live = { email: null, userId: null, unlocked: false, checked: false }
const listeners = new Set<() => void>()
function setLive(p: Partial<Live>) {
  live = { ...live, ...p }
  listeners.forEach((l) => l())
}
export const liveStore = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l) } },
  get: () => live,
}

// ---------- remembered key (separate IndexedDB, never in backups) ----------
interface StoredKeys { id: 'vault'; dataKey: CryptoKey; idKey: CryptoKey; userId: string; createdAt: string }
const keyDb = new Dexie('northstar-vault-key') as Dexie & { keys: Dexie.Table<StoredKeys, string> }
keyDb.version(1).stores({ keys: 'id' })

let keys: VaultKeys | null = null
let engine: SyncEngine | null = null
let backend: SyncBackend | null = null

export async function getConfig(): Promise<SyncConfig | null> {
  return envConfig() ?? (await getSetting<SyncConfig | null>(CONFIG_KEY, null))
}
export const configFromEnv = () => envConfig() !== null

export async function saveConfig(cfg: SyncConfig) {
  const err = validateConfig(cfg)
  if (err) throw new Error(err)
  await setSetting(CONFIG_KEY, { url: cfg.url.trim().replace(/\/$/, ''), anonKey: cfg.anonKey.trim() })
}

async function client() {
  const cfg = await getConfig()
  if (!cfg) throw new Error('Add your Supabase project URL and anon key first.')
  return getSupabase(cfg)
}

export async function writeStatus(p: Partial<SyncStatus>) {
  const prev = await getSetting<SyncStatus>(STATUS_KEY, { state: 'off', lastSyncedAt: null, pending: 0 })
  const pending = await db.table(OUTBOX).count()
  const next: SyncStatus = { ...prev, pending, ...p }
  if (next.state !== 'error' && next.state !== 'offline') delete next.error
  await setSetting(STATUS_KEY, next)
}

// ---------- account ----------
export async function refreshSession() {
  const sb = await client()
  const { data } = await sb.auth.getSession()
  const u = data.session?.user ?? null
  setLive({ email: u?.email ?? null, userId: u?.id ?? null, checked: true })
  backend = u ? supabaseBackend(sb, u.id) : null
  return u
}

export async function signUp(email: string, password: string) {
  const sb = await client()
  const { data, error } = await sb.auth.signUp({ email, password })
  if (error) throw new Error(error.message)
  await refreshSession()
  return { needsConfirm: !data.session }
}

export async function signIn(email: string, password: string) {
  const sb = await client()
  const { error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  await refreshSession()
}

export async function signOut() {
  await lock()
  stopLoop()
  const sb = await client()
  await sb.auth.signOut()
  setLive({ email: null, userId: null })
  backend = null
  await writeStatus({ state: 'off' })
}

function needBackend(): SyncBackend {
  if (!backend) throw new Error('Sign in first.')
  return backend
}

export async function remoteVaultExists(): Promise<boolean> {
  return (await needBackend().getMeta()) !== null
}

// ---------- vault ----------
let draft: CreatedVault | null = null

/** Step 1: make the keys and recovery code locally. Nothing is uploaded until confirmVault(). */
export async function startNewVault(passphrase: string): Promise<string> {
  draft = await createVault(passphrase)
  return draft.recoveryCode
}

/** Step 2 (after the person confirms they saved the recovery code): upload the wrapped key and start syncing. */
export async function confirmVault(remember: boolean) {
  if (!draft) throw new Error('Start again: no vault is being set up.')
  const b = needBackend()
  await b.createMeta(draft.meta)
  const meta = await b.getMeta()
  await linkVault(draft.keys, meta!.createdAt, remember)
  draft = null
}

export function cancelNewVault() {
  draft = null
}

export async function unlock(secret: string, kind: 'passphrase' | 'recovery', remember: boolean, newPassphrase?: string) {
  const b = needBackend()
  let meta = await b.getMeta()
  if (!meta) throw new Error('There is no vault in this account yet.')
  if (kind === 'recovery' && newPassphrase) {
    const updated = await resetPassphrase(meta, secret, newPassphrase)
    await b.updateMeta(updated)
    meta = { ...meta, ...updated }
  }
  const k = kind === 'passphrase' ? await unlockWithPassphrase(meta, secret) : await unlockWithRecoveryCode(meta, secret)
  await linkVault(k, meta.createdAt, remember)
}

async function linkVault(k: VaultKeys, createdAt: string, remember: boolean) {
  const userId = live.userId!
  const prev = await getSetting<{ userId: string; createdAt: string } | null>(VAULT_KEY, null)
  const firstLink = !prev || prev.userId !== userId || prev.createdAt !== createdAt
  if (firstLink) await resetLocalSyncState()
  await setSetting(VAULT_KEY, { userId, createdAt })
  keys = k
  if (remember) await keyDb.keys.put({ id: 'vault', dataKey: k.dataKey, idKey: k.idKey, userId, createdAt })
  else await keyDb.keys.clear()
  engine = new SyncEngine(db, needBackend(), k)
  setTracking(db, true)
  // First sync on this device: merge. Cloud versions win conflicts; records only here are added.
  if (firstLink) await engine.enqueueAll('merge')
  await setSetting(ENABLED_KEY, true)
  setLive({ unlocked: true })
  startLoop()
  void syncNow()
}

/** Forget the key on this device (data and queue stay; unlock again to resume). */
export async function lock() {
  keys = null
  engine = null
  await keyDb.keys.clear()
  setLive({ unlocked: false })
  stopLoop()
  if (await getSetting(ENABLED_KEY, false)) await writeStatus({ state: 'locked' })
}

async function resetLocalSyncState() {
  await db.transaction('rw', [db.table(OUTBOX), db.table(SYNC_META), db.settings], async () => {
    await db.table(OUTBOX).clear()
    await db.table(SYNC_META).clear()
    await db.settings.delete(CURSOR_KEY)
    await db.settings.delete(DEVICE_KEY)
    await db.settings.delete(RESTORED_KEY)
  })
}

/** Pause network sync. Local changes keep being queued so nothing is missed when it resumes. */
export async function setEnabled(on: boolean) {
  await setSetting(ENABLED_KEY, on)
  if (on && engine) {
    startLoop()
    void syncNow()
  } else {
    stopLoop()
    await writeStatus({ state: on ? 'locked' : 'off' })
  }
}

/** Unlink this device: stop tracking and forget the key and all sync bookkeeping. Local data is untouched. */
export async function disconnectDevice() {
  stopLoop()
  setTracking(db, false)
  keys = null
  engine = null
  await keyDb.keys.clear()
  await resetLocalSyncState()
  await db.settings.delete(VAULT_KEY)
  await setSetting(ENABLED_KEY, false)
  setLive({ unlocked: false })
  await writeStatus({ state: 'off', lastSyncedAt: null })
}

/** Deletes every encrypted row and the wrapped key from the cloud, then unlinks this device. Local data stays. */
export async function deleteCloudData() {
  await needBackend().deleteAll()
  await disconnectDevice()
}

// ---------- backups ----------

/** Restore a backup without queueing its rows, then ask how to reconcile with the cloud. */
export async function restoreWithoutSync(fn: () => Promise<void>) {
  // This device's sync settings (config, link, status) are not part of what a backup restores.
  const isSyncKey = (k: string) => k.startsWith('sync.')
  const keep = await db.settings.filter((s) => isSyncKey(s.key)).toArray()
  await withSyncSuppressed(db, async () => {
    await fn()
    await db.transaction('rw', db.settings, async () => {
      await db.settings.filter((s) => isSyncKey(s.key)).delete()
      if (keep.length) await db.settings.bulkPut(keep)
    })
  })
  if (await getSetting(VAULT_KEY, null)) {
    await db.transaction('rw', db.settings, async () => {
      await db.settings.delete(CURSOR_KEY)
      await db.settings.delete(DEVICE_KEY)
    })
    await setSetting(RESTORED_KEY, true)
  }
}

export async function resolveRestore(choice: 'merge' | 'replace') {
  if (!engine) throw new Error('Unlock sync first.')
  await setSetting(RESTORED_KEY, false)
  if (choice === 'replace') {
    await runSync(() => engine!.replaceCloudWithLocal())
  } else {
    await engine.enqueueAll('merge')
    await syncNow()
  }
}

export async function eraseLocalWithoutSync(fn: () => Promise<void>) {
  await withSyncSuppressed(db, fn)
}

// ---------- loop ----------
let timer: ReturnType<typeof setTimeout> | null = null
let interval: ReturnType<typeof setInterval> | null = null
let failures = 0
let listening = false

function scheduleSoon(ms = 3000) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void syncNow() }, ms)
}

const onOnline = () => scheduleSoon(500)
const onVisible = () => { if (document.visibilityState === 'visible') scheduleSoon(500) }

function startLoop() {
  outboxController(db).onChange = () => scheduleSoon()
  if (!interval) interval = setInterval(() => void syncNow(), 120_000)
  if (!listening && typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisible)
    listening = true
  }
}

function stopLoop() {
  outboxController(db).onChange = undefined
  if (timer) clearTimeout(timer)
  if (interval) clearInterval(interval)
  timer = null
  interval = null
  if (listening && typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    listening = false
  }
}

async function runSync(fn: () => Promise<unknown>) {
  if (!(await getSetting(ENABLED_KEY, false))) return
  if (!engine) return writeStatus({ state: 'locked' })
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return writeStatus({ state: 'offline' })
  await writeStatus({ state: 'syncing' })
  try {
    const meta = await needBackend().getMeta()
    const linked = await getSetting<{ createdAt: string } | null>(VAULT_KEY, null)
    if (!meta) throw new Error('The cloud vault no longer exists (it was deleted from another device). Disconnect this device, then set sync up again.')
    if (linked && meta.createdAt !== linked.createdAt) {
      await lock()
      throw new Error('The cloud vault was replaced. Unlock with the new passphrase.')
    }
    await fn()
    failures = 0
    await writeStatus({ state: 'up-to-date', lastSyncedAt: new Date().toISOString() })
  } catch (e) {
    failures++
    const offline = e instanceof OfflineError || (e instanceof TypeError && /fetch/i.test(e.message))
    const msg = e instanceof DecryptError ? `${e.message} Nothing was changed on this device.` : e instanceof Error ? e.message : 'Sync failed.'
    await writeStatus({ state: offline ? 'offline' : 'error', error: offline ? undefined : msg })
    // Back off: 5s, 10s, 20s ... up to 5 minutes.
    scheduleSoon(Math.min(300_000, 5000 * 2 ** Math.min(failures - 1, 6)))
  }
}

export async function syncNow() {
  await runSync(() => engine!.sync())
}

/** Called at app start (lazily, only when sync was set up on this device). */
export async function autoStart() {
  if (!(await getSetting(ENABLED_KEY, false))) return
  try {
    const user = await refreshSession()
    const stored = await keyDb.keys.get('vault')
    const linked = await getSetting<{ userId: string; createdAt: string } | null>(VAULT_KEY, null)
    if (!user || !stored || !linked || stored.userId !== user.id || stored.createdAt !== linked.createdAt) {
      await writeStatus({ state: 'locked' })
      return
    }
    keys = { dataKey: stored.dataKey, idKey: stored.idKey }
    engine = new SyncEngine(db, needBackend(), keys)
    setLive({ unlocked: true })
    startLoop()
    await syncNow()
  } catch {
    await writeStatus({ state: 'offline' })
  }
}

export const isUnlocked = () => keys !== null
