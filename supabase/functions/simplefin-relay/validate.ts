// Pure validation helpers for the SimpleFIN relay. No Deno or DOM APIs, so vitest imports this file directly
// (src/features/simplefin/relay.test.ts) and the Edge Function imports the very same code.

export const MAX_FIELD = 2048
export const MAX_BODY_BYTES = 8192
export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024
export const TIMEOUT_MS = 20_000
export const MAX_RANGE_SECONDS = 366 * 86_400

export const ALLOWED_ORIGINS = [
  'https://123456789eleven.github.io',
  'http://localhost:5173',
  'http://localhost:5180',
  'http://localhost:4173',
]

export function isAllowedOrigin(origin: string | null | undefined): boolean {
  return !!origin && ALLOWED_ORIGINS.includes(origin)
}

/** SimpleFIN hosts only: simplefin.org itself or any subdomain. A trailing dot or lookalike suffix fails. */
export function isSimplefinHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  return h === 'simplefin.org' || h.endsWith('.simplefin.org')
}

export interface SafeTarget {
  /** https URL with the credentials removed, no query or fragment. */
  url: string
  /** "Basic ..." header value when the URL carried a username:password, else null. */
  authorization: string | null
}

export type UrlResult = { ok: true; target: SafeTarget } | { ok: false; reason: string }

function toBase64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/**
 * Validates a claim URL (allowCredentials=false) or an access URL (allowCredentials=true) and splits the
 * credentials into a Basic auth header so they never travel in the URL.
 */
export function parseSimplefinUrl(raw: unknown, allowCredentials: boolean): UrlResult {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_FIELD) return { ok: false, reason: 'bad_url' }
  if (/[\s\u0000-\u001f]/.test(raw)) return { ok: false, reason: 'bad_url' }
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return { ok: false, reason: 'bad_url' }
  }
  if (u.protocol !== 'https:') return { ok: false, reason: 'not_https' }
  if (!isSimplefinHost(u.hostname)) return { ok: false, reason: 'host_not_allowed' }
  if (u.port !== '') return { ok: false, reason: 'port_not_allowed' }
  if (u.hash) return { ok: false, reason: 'bad_url' }
  const hasCreds = u.username !== '' || u.password !== ''
  if (hasCreds && !allowCredentials) return { ok: false, reason: 'credentials_not_allowed' }
  if (allowCredentials && u.username === '') return { ok: false, reason: 'credentials_missing' }
  let authorization: string | null = null
  if (hasCreds) {
    try {
      authorization = 'Basic ' + toBase64Utf8(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`)
    } catch {
      return { ok: false, reason: 'bad_url' }
    }
  }
  // Rebuild from parts we checked; credentials and query are dropped.
  const clean = `https://${u.hostname}${u.pathname.replace(/\/+$/, '')}`
  return { ok: true, target: { url: clean, authorization } }
}

/** Setup tokens are base64 (standard or URL-safe, padding optional) of the claim URL. */
export function decodeSetupToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const t = token.trim()
  if (!t || t.length > MAX_FIELD || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(t)) return null
  try {
    let b = t.replace(/-/g, '+').replace(/_/g, '/')
    while (b.length % 4) b += '='
    const bin = atob(b)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

export type RelayRequest =
  | { action: 'claim'; setupToken: string }
  | { action: 'accounts'; accessUrl: string; startDate?: number; endDate?: number }

export type RequestResult = { ok: true; req: RelayRequest } | { ok: false; reason: string }

const isEpoch = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 4_102_444_800

/** Strict body validation. Unknown keys are rejected so nothing unexpected is ever forwarded. */
export function validateRequest(body: unknown): RequestResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, reason: 'bad_body' }
  const b = body as Record<string, unknown>
  const keys = Object.keys(b)
  if (b.action === 'claim') {
    if (keys.some((k) => k !== 'action' && k !== 'setupToken')) return { ok: false, reason: 'bad_body' }
    if (typeof b.setupToken !== 'string' || !b.setupToken.trim() || b.setupToken.length > MAX_FIELD) return { ok: false, reason: 'bad_token' }
    return { ok: true, req: { action: 'claim', setupToken: b.setupToken } }
  }
  if (b.action === 'accounts') {
    if (keys.some((k) => !['action', 'accessUrl', 'startDate', 'endDate'].includes(k))) return { ok: false, reason: 'bad_body' }
    if (typeof b.accessUrl !== 'string' || !b.accessUrl || b.accessUrl.length > MAX_FIELD) return { ok: false, reason: 'bad_url' }
    const { startDate, endDate } = b
    if (startDate !== undefined && !isEpoch(startDate)) return { ok: false, reason: 'bad_date' }
    if (endDate !== undefined && !isEpoch(endDate)) return { ok: false, reason: 'bad_date' }
    if (startDate !== undefined && endDate !== undefined && (endDate < startDate || endDate - startDate > MAX_RANGE_SECONDS)) return { ok: false, reason: 'bad_date' }
    return { ok: true, req: { action: 'accounts', accessUrl: b.accessUrl, startDate: startDate as number | undefined, endDate: endDate as number | undefined } }
  }
  return { ok: false, reason: 'bad_action' }
}

/** GET {accessUrl}/accounts?start-date=..&end-date=.. (epoch seconds). Transactions are included. */
export function buildAccountsUrl(baseUrl: string, startDate?: number, endDate?: number): string {
  const q: string[] = []
  if (startDate !== undefined) q.push(`start-date=${startDate}`)
  if (endDate !== undefined) q.push(`end-date=${endDate}`)
  return `${baseUrl}/accounts${q.length ? '?' + q.join('&') : ''}`
}
