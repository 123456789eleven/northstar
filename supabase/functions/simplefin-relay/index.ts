// SimpleFIN relay: a stateless, authenticated pass-through for Northstar's opt-in live bank feed.
// SimpleFIN's server sends no CORS headers, so browsers cannot call it directly. This function does the call.
// It stores nothing, reads no database, and logs only the action name and a status code.
import {
  MAX_BODY_BYTES,
  MAX_RESPONSE_BYTES,
  TIMEOUT_MS,
  buildAccountsUrl,
  decodeSetupToken,
  isAllowedOrigin,
  parseSimplefinUrl,
  validateRequest,
  type SafeTarget,
} from './validate.ts'

function corsHeaders(origin: string | null): Record<string, string> {
  const h: Record<string, string> = { Vary: 'Origin' }
  if (isAllowedOrigin(origin)) {
    h['Access-Control-Allow-Origin'] = origin as string
    h['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info'
    h['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    h['Access-Control-Max-Age'] = '600'
  }
  return h
}

function respond(origin: string | null, status: number, body: unknown, action = '-'): Response {
  console.log(`simplefin-relay action=${action} status=${status}`)
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/** Confirms the bearer token belongs to a real signed-in user (the gateway's JWT check alone would also pass the anon key). */
async function isSignedInUser(authHeader: string | null): Promise<boolean> {
  const m = /^Bearer (.+)$/i.exec(authHeader ?? '')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!m || !url || !anon) return false
  try {
    const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: `Bearer ${m[1]}`, apikey: anon } })
    if (!res.ok) return false
    const user = await res.json()
    return typeof user?.id === 'string' && user.id.length > 0 && user.is_anonymous !== true
  } catch {
    return false
  }
}

class RelayError extends Error {
  status: number
  code: string
  constructor(status: number, code: string) {
    super(code)
    this.status = status
    this.code = code
  }
}

/** One outbound call. Redirects are refused outright; the body is size-capped; time is capped. */
async function callSimplefin(method: 'GET' | 'POST', target: SafeTarget, url: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'application/json, text/plain' }
  if (target.authorization) headers.Authorization = target.authorization
  let res: Response
  try {
    res = await fetch(url, { method, headers, body: method === 'POST' ? '' : undefined, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch (e) {
    throw new RelayError((e as Error)?.name === 'TimeoutError' ? 504 : 502, 'upstream_unreachable')
  }
  if (res.status >= 300 && res.status < 400) throw new RelayError(502, 'redirect_refused')
  if (res.status === 402 || res.status === 403) throw new RelayError(res.status, 'simplefin_auth')
  if (res.status === 401) throw new RelayError(403, 'simplefin_auth')
  if (res.status === 429) throw new RelayError(429, 'rate_limited')
  if (!res.ok) throw new RelayError(502, 'upstream_error')
  const declared = Number(res.headers.get('content-length') ?? 0)
  if (declared > MAX_RESPONSE_BYTES) throw new RelayError(502, 'response_too_large')
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel()
      throw new RelayError(502, 'response_too_large')
    }
    chunks.push(value)
  }
  const all = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    all.set(c, off)
    off += c.byteLength
  }
  return new TextDecoder().decode(all)
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') {
    return isAllowedOrigin(origin) ? new Response(null, { status: 204, headers: corsHeaders(origin) }) : new Response(null, { status: 403 })
  }
  // A browser request from any other site is refused before anything else happens.
  if (origin && !isAllowedOrigin(origin)) return respond(null, 403, { error: 'origin_not_allowed' })
  if (req.method !== 'POST') return respond(origin, 405, { error: 'method_not_allowed' })
  if (!(await isSignedInUser(req.headers.get('Authorization')))) return respond(origin, 401, { error: 'not_signed_in' })

  let action = '-'
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return respond(origin, 400, { error: 'bad_request' })
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return respond(origin, 400, { error: 'bad_request' })
    }
    const v = validateRequest(json)
    if (!v.ok) return respond(origin, 400, { error: v.reason })
    action = v.req.action

    if (v.req.action === 'claim') {
      const claimUrl = decodeSetupToken(v.req.setupToken)
      const parsed = claimUrl ? parseSimplefinUrl(claimUrl, false) : null
      if (!parsed || !parsed.ok) return respond(origin, 400, { error: 'bad_token' }, action)
      const accessUrl = (await callSimplefin('POST', parsed.target, parsed.target.url)).trim()
      // The result is a secret the browser keeps; make sure it is a genuine SimpleFIN access URL before returning it.
      const check = parseSimplefinUrl(accessUrl, true)
      if (!check.ok) return respond(origin, 502, { error: 'upstream_error' }, action)
      return respond(origin, 200, { accessUrl }, action)
    }

    const parsed = parseSimplefinUrl(v.req.accessUrl, true)
    if (!parsed.ok) return respond(origin, 400, { error: parsed.reason }, action)
    const body = await callSimplefin('GET', parsed.target, buildAccountsUrl(parsed.target.url, v.req.startDate, v.req.endDate))
    try {
      JSON.parse(body)
    } catch {
      return respond(origin, 502, { error: 'upstream_error' }, action)
    }
    console.log(`simplefin-relay action=${action} status=200`)
    return new Response(body, { status: 200, headers: { ...corsHeaders(origin), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (e instanceof RelayError) return respond(origin, e.status, { error: e.code }, action)
    return respond(origin, 500, { error: 'relay_error' }, action)
  }
})
