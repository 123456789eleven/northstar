// Talks to YOUR relay (a Supabase Edge Function). Never talks to SimpleFIN directly and never logs anything.
// The access URL is a secret: it lives only in the local-only setting `simplefin.accessUrl` and is sent only to the relay.
import { db, getSetting, setSetting } from '../../db'
import { getConfig, liveStore } from '../../sync/manager'
import { getSupabase } from '../../sync/client'
import { undoImport } from '../finance/importActions'
import { ACCESS_URL_KEY, FeedError, REQUESTS_KEY, STATUS_KEY, dateWindows } from './help'
import { mergeResponses, SFIN_PREFIX, type SfinResponse } from './map'

export interface FeedStatus {
  lastSyncedAt?: string
  lastAdded?: number
  messages?: string[]
}

// Test-only switches, set at build time (undefined in the real build): a fake relay address, and skipping sign-in.
const OVERRIDE = (import.meta.env?.VITE_SIMPLEFIN_RELAY_URL as string | undefined) || ''
const TEST_BYPASS = import.meta.env?.VITE_SIMPLEFIN_TEST_BYPASS === '1'

export async function relayUrl(): Promise<string | null> {
  if (OVERRIDE) return OVERRIDE
  const cfg = await getConfig()
  return cfg ? `${cfg.url.replace(/\/$/, '')}/functions/v1/simplefin-relay` : null
}

export async function accessToken(): Promise<string | null> {
  if (TEST_BYPASS) return 'test'
  const cfg = await getConfig()
  if (!cfg) return null
  const sb = await getSupabase(cfg)
  const { data } = await sb.auth.getSession()
  return data.session?.access_token ?? null
}

export const isSignedIn = () => TEST_BYPASS || !!liveStore.get().userId

async function post(body: unknown): Promise<unknown> {
  const url = await relayUrl()
  const token = await accessToken()
  if (!url) throw new FeedError(401)
  if (!token) throw new FeedError(401)
  const cfg = await getConfig()
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(cfg ? { apikey: cfg.anonKey } : {}) },
      body: JSON.stringify(body),
    })
  } catch {
    throw new FeedError(0)
  }
  if (!res.ok) throw new FeedError(res.status)
  try {
    return await res.json()
  } catch {
    throw new FeedError(502)
  }
}

/** Sends an empty-but-invalid request: a deployed relay answers 400 (signed in) or 401, a missing one 404. */
export async function testRelay(): Promise<{ ok: boolean; status: number }> {
  try {
    await post({ action: 'ping' })
    return { ok: true, status: 200 }
  } catch (e) {
    const status = e instanceof FeedError ? e.status : 0
    return { ok: status === 400, status }
  }
}

export async function claimSetupToken(setupToken: string): Promise<string> {
  const r = (await post({ action: 'claim', setupToken: setupToken.trim() })) as { accessUrl?: unknown }
  if (typeof r?.accessUrl !== 'string' || !r.accessUrl) throw new FeedError(502)
  await setSetting(ACCESS_URL_KEY, r.accessUrl)
  return r.accessUrl
}

export const hasAccessUrl = async () => !!(await getSetting<string>(ACCESS_URL_KEY, ''))

async function noteRequests(n: number) {
  const now = Date.now()
  const prev = (await getSetting<number[]>(REQUESTS_KEY, [])).filter((t) => now - t < 86_400_000)
  await setSetting(REQUESTS_KEY, [...prev, ...Array(n).fill(now)])
}

/** Fetches the last `days` days, in windows of 90 days (the Bridge's limit per request). */
export async function fetchAccounts(days: number): Promise<SfinResponse> {
  const accessUrl = await getSetting<string>(ACCESS_URL_KEY, '')
  if (!accessUrl) throw new FeedError(400)
  const parts: SfinResponse[] = []
  const windows = dateWindows(Date.now(), days)
  for (const w of windows) {
    try {
      parts.push((await post({ action: 'accounts', accessUrl, startDate: w.start, endDate: w.end })) as SfinResponse)
    } finally {
      await noteRequests(1)
    }
  }
  return mergeResponses(parts)
}

export async function setStatus(s: FeedStatus) {
  await setSetting(STATUS_KEY, s)
}

/** Forgets the access URL. Optionally removes the transactions this feed imported (each batch is undone properly). */
export async function disconnect(removeTransactions: boolean): Promise<number> {
  let removed = 0
  if (removeTransactions) {
    const rows = await db.transactions.filter((t) => !!t.fitid?.startsWith(SFIN_PREFIX)).toArray()
    for (const b of new Set(rows.map((r) => r.importBatch).filter((b): b is string => !!b))) removed += await undoImport(b)
    const left = rows.filter((r) => r.id != null && !r.importBatch)
    if (left.length) {
      await db.transactions.bulkDelete(left.map((r) => r.id!))
      removed += left.length
    }
  }
  await db.settings.delete(ACCESS_URL_KEY)
  await db.settings.delete(STATUS_KEY)
  await db.settings.delete(REQUESTS_KEY)
  return removed
}
