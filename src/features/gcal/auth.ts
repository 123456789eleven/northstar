// Google Identity Services token model. The access token lives in module memory only.
export const GSI_SRC = 'https://accounts.google.com/gsi/client'
export const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly'

interface TokenResponse { access_token?: string; expires_in?: number | string; error?: string; error_description?: string }
interface TokenClient { requestAccessToken: (o?: { prompt?: string }) => void }
interface GoogleOAuth2 {
  initTokenClient: (c: {
    client_id: string
    scope: string
    callback: (r: TokenResponse) => void
    error_callback?: (e: { type?: string; message?: string }) => void
  }) => TokenClient
  revoke: (token: string, done?: () => void) => void
}
declare global {
  interface Window { google?: { accounts: { oauth2: GoogleOAuth2 } } }
}

let token: { value: string; expiresAt: number } | null = null
let client: TokenClient | null = null
let clientFor = ''
let pending: { resolve: (t: string) => void; reject: (e: Error) => void } | null = null
let scriptPromise: Promise<void> | null = null

export const hasToken = () => !!token && token.expiresAt > Date.now() + 30_000
export const clearToken = () => { token = null }
/** Test helper. */
export function _resetAuth() { token = null; client = null; clientFor = ''; pending = null; scriptPromise = null }

export function loadGsi(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { scriptPromise = null; s.remove(); reject(new Error('Could not load the Google sign-in script. Check your connection.')) }
    document.head.appendChild(s)
  })
  return scriptPromise
}

function ensureClient(clientId: string): TokenClient {
  if (client && clientFor === clientId) return client
  const oauth = window.google!.accounts.oauth2
  client = oauth.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: (r) => {
      const p = pending
      pending = null
      if (!p) return
      if (r.error || !r.access_token) return p.reject(new Error(r.error || r.error_description || 'Google did not return an access token.'))
      token = { value: r.access_token, expiresAt: Date.now() + (Number(r.expires_in) || 3600) * 1000 }
      p.resolve(r.access_token)
    },
    error_callback: (e) => {
      const p = pending
      pending = null
      p?.reject(new Error(e.type || e.message || 'Sign-in failed.'))
    },
  })
  clientFor = clientId
  return client
}

/** Interactive consent (prompt 'consent' first time) or silent refresh (prompt ''). */
export async function requestToken(clientId: string, prompt: '' | 'consent' = ''): Promise<string> {
  await loadGsi()
  const c = ensureClient(clientId)
  return new Promise<string>((resolve, reject) => {
    pending = { resolve, reject }
    c.requestAccessToken({ prompt })
  })
}

/** Returns a live token, silently refreshing if expired. Never persisted. */
export async function getToken(clientId: string): Promise<string> {
  if (token && hasToken()) return token.value
  return requestToken(clientId, '')
}

export function revokeToken(): Promise<void> {
  const t = token?.value
  token = null
  if (!t || !window.google?.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve) => window.google!.accounts.oauth2.revoke(t, () => resolve()))
}
