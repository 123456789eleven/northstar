// The only code that talks to the network for sync. Everything it sends is already encrypted, except the
// account email (auth) and row metadata (table name, opaque record id, timestamps, sizes).
// @supabase/supabase-js is imported lazily so the offline app never loads it unless sync is turned on.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { VaultMeta } from './crypto'

export interface VaultRow {
  table_name: string
  record_id: string
  ciphertext: string
  nonce: string
  deleted: boolean
  client_updated_at: string
}

export interface PulledRow extends VaultRow {
  seq: number
}

/** The whole surface the sync engine needs from a backend. Tests implement it in memory. */
export interface SyncBackend {
  getMeta(): Promise<(VaultMeta & { createdAt: string }) | null>
  /** Fails if a vault already exists for this account. */
  createMeta(meta: VaultMeta): Promise<void>
  updateMeta(meta: VaultMeta): Promise<void>
  /** Upsert by (table_name, record_id). The server keeps whichever has the later client_updated_at. */
  push(rows: VaultRow[]): Promise<void>
  /** Rows with seq > afterSeq, ascending. */
  pull(afterSeq: number, limit: number): Promise<PulledRow[]>
  /** Deletes every vault row and the vault meta for this account. */
  deleteAll(): Promise<void>
}

export interface SyncConfig {
  url: string
  anonKey: string
}

export class OfflineError extends Error {
  constructor() {
    super('Offline')
    this.name = 'OfflineError'
  }
}

export function envConfig(): SyncConfig | null {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined
  return url && anonKey ? { url, anonKey } : null
}

/** Only https://<ref>.supabase.co is allowed (the CSP allows nothing else anyway). */
export function validateConfig(cfg: SyncConfig): string | null {
  let u: URL
  try {
    u = new URL(cfg.url)
  } catch {
    return 'That is not a valid URL.'
  }
  if (u.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(u.hostname) || (u.pathname !== '/' && u.pathname !== '')) return 'Use your project URL, like https://abcd1234.supabase.co'
  if (!/^[A-Za-z0-9._-]{20,}$/.test(cfg.anonKey.trim())) return 'That does not look like an anon (public) key.'
  if (/service_role/.test(atobSafe(cfg.anonKey.split('.')[1] ?? ''))) return 'That is the service-role key. Never put it in an app: use the anon (public) key.'
  return null
}

function atobSafe(s: string) {
  try {
    return atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  } catch {
    return ''
  }
}

let cached: { key: string; client: Promise<SupabaseClient> } | null = null

export function getSupabase(cfg: SyncConfig): Promise<SupabaseClient> {
  const key = `${cfg.url}|${cfg.anonKey}`
  if (!cached || cached.key !== key) {
    cached = {
      key,
      client: import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(cfg.url, cfg.anonKey.trim(), {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'northstar.sync.auth' },
        }),
      ),
    }
  }
  return cached.client
}

function check<T extends { error: { message: string; code?: string } | null }>(res: T): T {
  if (res.error) {
    if (/fetch|network/i.test(res.error.message)) throw new OfflineError()
    throw new Error(res.error.message)
  }
  return res
}

const CHUNK = 200

export function supabaseBackend(sb: SupabaseClient, userId: string): SyncBackend {
  return {
    async getMeta() {
      const res = check(await sb.from('vault_meta').select('*').eq('user_id', userId).maybeSingle())
      const r = res.data as Record<string, unknown> | null
      if (!r) return null
      return {
        version: Number(r.version), kdf: r.kdf as 'PBKDF2-SHA256', iterations: Number(r.kdf_iterations),
        salt: String(r.salt), wrappedKey: String(r.wrapped_key), recoverySalt: String(r.recovery_salt),
        wrappedKeyRecovery: String(r.wrapped_key_recovery), createdAt: String(r.created_at),
      }
    },
    async createMeta(m) {
      check(await sb.from('vault_meta').insert({
        user_id: userId, version: m.version, kdf: m.kdf, kdf_iterations: m.iterations, salt: m.salt,
        wrapped_key: m.wrappedKey, recovery_salt: m.recoverySalt, wrapped_key_recovery: m.wrappedKeyRecovery,
      }))
    },
    async updateMeta(m) {
      check(await sb.from('vault_meta').update({ salt: m.salt, wrapped_key: m.wrappedKey }).eq('user_id', userId))
    },
    async push(rows) {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map((r) => ({ ...r, user_id: userId }))
        check(await sb.from('vault_records').upsert(chunk, { onConflict: 'user_id,table_name,record_id' }))
      }
    },
    async pull(afterSeq, limit) {
      const res = check(await sb.from('vault_records')
        .select('table_name,record_id,ciphertext,nonce,deleted,client_updated_at,seq')
        .eq('user_id', userId).gt('seq', afterSeq).order('seq', { ascending: true }).limit(limit))
      return (res.data ?? []).map((r) => ({ ...(r as PulledRow), seq: Number((r as PulledRow).seq) }))
    },
    async deleteAll() {
      check(await sb.from('vault_records').delete().eq('user_id', userId))
      check(await sb.from('vault_meta').delete().eq('user_id', userId))
    },
  }
}
