// Pure helpers for the SimpleFIN card: links, plain-language errors, sync pacing, date windows.
export const ACCESS_URL_KEY = 'simplefin.accessUrl'
export const STATUS_KEY = 'simplefin.status'
export const REQUESTS_KEY = 'simplefin.requests'

export const LINKS = {
  signup: 'https://beta-bridge.simplefin.org/auth/signup',
  info: 'https://www.simplefin.org/',
}

/** SimpleFIN allows about 24 requests per day and the Bridge limits each request to a 90 day window. */
export const MIN_SYNC_GAP_MS = 6 * 3_600_000
export const DAILY_REQUEST_LIMIT = 24
export const WINDOW_DAYS = 90
export const DEFAULT_DAYS = 90
export const FIRST_SYNC_DAYS = 365

export class FeedError extends Error {
  status: number
  constructor(status: number, message?: string) {
    super(message ?? `relay ${status}`)
    this.name = 'FeedError'
    this.status = status
  }
}

/** status 0 = the request never reached the relay (offline, blocked, or the address is wrong). Never includes secrets. */
export function friendlyFeedError(e: unknown): string {
  const status = e instanceof FeedError ? e.status : typeof e === 'number' ? e : -1
  if (status === 0) return "Can't reach the relay. Check your connection. If you are online, the relay may not be deployed yet (step 2)."
  if (status === 404) return 'The relay is not deployed in your Supabase project yet. Finish step 2, then press Test relay.'
  if (status === 401) return 'You are not signed in to your sync account, or the sign-in expired. Sign in under Settings, then try again.'
  if (status === 402 || status === 403) return 'SimpleFIN refused the token. A Setup Token works once, and it stops working if it was already used or revoked. Create a new Setup Token on the SimpleFIN site and connect again.'
  if (status === 429) return 'SimpleFIN is limiting requests (about 24 a day). Try again in a few hours.'
  if (status === 400) return 'The relay could not read that request. Paste the Setup Token again, exactly as SimpleFIN showed it.'
  if (status === 504) return 'SimpleFIN took too long to answer. Try again in a minute.'
  if (status >= 500) return 'The relay or SimpleFIN had a problem. Try again shortly.'
  if (status >= 400) return `The relay returned an error (${status}). Try again, or check the relay logs in Supabase.`
  return 'Something went wrong. Try again.'
}

export interface SyncGate {
  allowed: boolean
  reason?: string
}

/** Rate pacing: once per 6 hours unless forced, and never past the daily request budget. */
export function syncGate(lastSyncedAt: string | undefined, requests: number[], now: number, force: boolean, needed = 1): SyncGate {
  const recent = requests.filter((t) => now - t < 86_400_000).length
  if (recent + needed > DAILY_REQUEST_LIMIT) return { allowed: false, reason: 'You have used today\'s SimpleFIN request allowance. Try again tomorrow.' }
  if (!force && lastSyncedAt) {
    const wait = MIN_SYNC_GAP_MS - (now - new Date(lastSyncedAt).getTime())
    if (wait > 0) return { allowed: false, reason: `Synced recently. To stay within SimpleFIN limits, the next automatic sync is in about ${Math.ceil(wait / 3_600_000)} h. Use "Sync anyway" to override.` }
  }
  return { allowed: true }
}

/** Splits [now - days, now] into windows of at most WINDOW_DAYS, oldest first. Epoch seconds. */
export function dateWindows(nowMs: number, days: number): { start: number; end: number }[] {
  const end = Math.floor(nowMs / 1000)
  const startAll = end - days * 86400
  const out: { start: number; end: number }[] = []
  for (let s = startAll; s < end; s += WINDOW_DAYS * 86400) out.push({ start: s, end: Math.min(end, s + WINDOW_DAYS * 86400) })
  return out
}

export function summarizeStatus(s: { lastSyncedAt?: string } | undefined): string {
  return s?.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Not yet'
}
