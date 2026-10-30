// Pure helpers for the Google Calendar setup flow: client ID validation and plain-language errors.
export const CLIENT_ID_SUFFIX = '.apps.googleusercontent.com'
export const GCAL_DISMISS_KEY = 'gcal.promptDismissed'
export const PROD_ORIGIN = 'https://123456789eleven.github.io'

export const LINKS = {
  console: 'https://console.cloud.google.com/',
  api: 'https://console.cloud.google.com/apis/library/calendar-json.googleapis.com',
  consent: 'https://console.cloud.google.com/apis/credentials/consent',
  credentials: 'https://console.cloud.google.com/apis/credentials',
}

/** Returns an inline message, or '' when the ID looks valid (empty input is not an error: nothing typed yet). */
export function validateClientId(raw: string): string {
  const id = raw.trim()
  if (!id) return ''
  if (/\s/.test(id)) return 'A Client ID has no spaces. Copy it again from the credentials page.'
  if (!id.endsWith(CLIENT_ID_SUFFIX)) return `A Client ID ends in ${CLIENT_ID_SUFFIX}. You may have copied the client secret or the project ID instead.`
  if (id.length <= CLIENT_ID_SUFFIX.length + 10) return 'That Client ID looks too short. Copy the whole value.'
  return ''
}

export const isValidClientId = (raw: string) => !!raw.trim() && validateClientId(raw) === ''

/** The origins to authorize in Google Cloud: this page's origin plus the published site (deduplicated). */
export function originsToAuthorize(current: string): string[] {
  return [...new Set([current, PROD_ORIGIN].filter(Boolean))]
}

/** Maps a raw Google/GIS error (code or message) to something a person can act on. */
export function friendlyGcalError(raw: unknown): string {
  const text = (raw instanceof Error ? raw.message : typeof raw === 'string' ? raw : '').trim()
  const t = text.toLowerCase()
  if (!t) return 'Something went wrong. Try again.'
  if (t.includes('popup_failed_to_open') || t.includes('popup blocked') || t.includes('failed to open popup'))
    return 'Your browser blocked the Google sign-in window. Allow pop-ups for this site, then press Connect again.'
  if (t.includes('popup_closed') || t.includes('window was closed'))
    return 'The sign-in window was closed before finishing. Press Connect to try again.'
  if (t.includes('access_denied') || t.includes('access denied'))
    return 'Google denied access. If your app is in Testing mode, add your Google account under Test users on the OAuth consent screen, then try again. Also make sure you allowed calendar access.'
  if (t.includes('redirect_uri_mismatch') || t.includes('origin_mismatch') || t.includes('idpiframe') || t.includes('invalid_client') || t.includes('origin'))
    return 'Google does not recognize this web address. Add it under Authorized JavaScript origins for your OAuth client (use the copy buttons above), wait a minute, and try again.'
  if (t.includes('invalid_request') || t.includes('unauthorized_client'))
    return 'Google rejected the request. Check that the Client ID is a Web application client and that the Calendar API is enabled.'
  if (t.includes('expired') || t.includes('401') || t.includes('session'))
    return 'Your Google session expired. Press Reconnect to sign in again.'
  return text
}

/** Imported-from-Google rows are tagged by uid prefix; they are read-only mirrors. */
export const isGoogleEvent = (e: { uid?: string }) => !!e.uid?.startsWith('g:')
