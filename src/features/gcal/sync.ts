// Google Calendar sync: fetch -> map -> upsert by uid. Only ever touches rows whose uid starts with "g:".
import { useEffect } from 'react'
import { db, getSetting, logEvent, setSetting } from '../../db'
import type { CalendarEvent } from '../../db'
import { addDays, today } from '../../lib/dates'
import { clearToken, getToken, hasToken } from './auth'
import { GCAL_PREFIX, mapGoogleEvent, type GoogleEvent } from './map'

const API = 'https://www.googleapis.com/calendar/v3'
export const DAYS_BACK = 30
export const DAYS_AHEAD = 180
export const AUTO_SYNC_MS = 15 * 60_000

export type GcalState = 'off' | 'connected' | 'syncing' | 'error'
export interface GcalStatus { state: GcalState; lastSyncedAt?: string; count?: number; message?: string }
export interface CalendarInfo { id: string; summary: string; primary?: boolean }

export type GcalErrorKind = 'auth' | 'forbidden' | 'offline' | 'rate' | 'server' | 'other'
export class GcalError extends Error {
  kind: GcalErrorKind
  constructor(kind: GcalErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

export interface Deps {
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  maxRetries?: number
}
const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export async function apiGet<T>(url: string, token: string, deps: Deps = {}): Promise<T> {
  const f = deps.fetch ?? fetch
  const sleep = deps.sleep ?? defaultSleep
  const max = deps.maxRetries ?? 3
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await f(url, { headers: { Authorization: `Bearer ${token}` } })
    } catch {
      throw new GcalError('offline', "Can't reach Google. Check your connection and try again.")
    }
    if (res.ok) return (await res.json()) as T
    if ((res.status === 429 || res.status >= 500) && attempt < max) {
      await sleep(Math.min(8000, 500 * 2 ** attempt))
      continue
    }
    if (res.status === 401) throw new GcalError('auth', 'Your Google session expired. Reconnect to continue.')
    if (res.status === 403)
      throw new GcalError('forbidden', 'Google refused access. Make sure the Google Calendar API is enabled for your project and that you granted calendar access.')
    if (res.status === 429) throw new GcalError('rate', 'Google is rate limiting requests. Try again in a few minutes.')
    if (res.status >= 500) throw new GcalError('server', 'Google had a server problem. Try again shortly.')
    throw new GcalError('other', `Google returned an error (${res.status}).`)
  }
}

export async function fetchCalendarList(token: string, deps: Deps = {}): Promise<CalendarInfo[]> {
  const out: CalendarInfo[] = []
  let pageToken = ''
  do {
    const r = await apiGet<{ items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean }[]; nextPageToken?: string }>(
      `${API}/users/me/calendarList?minAccessRole=reader${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      token,
      deps,
    )
    for (const c of r.items ?? []) out.push({ id: c.id, summary: c.summaryOverride || c.summary || c.id, primary: c.primary })
    pageToken = r.nextPageToken ?? ''
  } while (pageToken)
  return out
}

export function windowFor(now = today()) {
  const startDate = addDays(now, -DAYS_BACK)
  const endDate = addDays(now, DAYS_AHEAD)
  return {
    startDate,
    endDate,
    timeMin: new Date(`${startDate}T00:00:00`).toISOString(),
    timeMax: new Date(`${addDays(endDate, 1)}T00:00:00`).toISOString(),
  }
}

export async function fetchEvents(token: string, calendarId: string, win: ReturnType<typeof windowFor>, deps: Deps = {}): Promise<GoogleEvent[]> {
  const out: GoogleEvent[] = []
  let pageToken = ''
  do {
    const q = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      showDeleted: 'true',
      maxResults: '250',
      timeMin: win.timeMin,
      timeMax: win.timeMax,
    })
    if (pageToken) q.set('pageToken', pageToken)
    const r = await apiGet<{ items?: GoogleEvent[]; nextPageToken?: string }>(
      `${API}/calendars/${encodeURIComponent(calendarId)}/events?${q}`,
      token,
      deps,
    )
    out.push(...(r.items ?? []))
    pageToken = r.nextPageToken ?? ''
  } while (pageToken)
  return out
}

/** Upsert by uid; delete g: rows that vanished (inside the window) or whose calendar is no longer selected. */
export async function applyEvents(rows: CalendarEvent[], selected: string[], win: { startDate: string; endDate: string }): Promise<number> {
  const fresh = new Map(rows.map((r) => [r.uid!, r]))
  await db.transaction('rw', db.calendar, async () => {
    const existing = await db.calendar.where('uid').startsWith(GCAL_PREFIX).toArray()
    const have = new Map<string, number>()
    const del: number[] = []
    for (const e of existing) {
      const uid = e.uid!
      if (fresh.has(uid) && !have.has(uid)) {
        have.set(uid, e.id!)
        continue
      }
      const calSelected = selected.some((c) => uid.startsWith(`${GCAL_PREFIX}${c}:`))
      const inWindow = e.date >= win.startDate && e.date <= win.endDate
      if (!calSelected || fresh.has(uid) || inWindow) del.push(e.id!)
    }
    if (del.length) await db.calendar.bulkDelete(del)
    for (const [uid, r] of fresh) {
      const id = have.get(uid)
      if (id) await db.calendar.put({ ...r, id })
      else await db.calendar.add(r)
    }
  })
  return db.calendar.where('uid').startsWith(GCAL_PREFIX).count()
}

export const getSelected = async () => {
  const s = await getSetting<string[]>('gcal.calendars', [])
  return s.length ? s : ['primary']
}
export const getClientId = async () =>
  (import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined) || (await getSetting<string>('gcal.clientId', ''))
export const getStatus = () => getSetting<GcalStatus>('gcal.status', { state: 'off' })
export const setStatus = (s: GcalStatus) => setSetting('gcal.status', s)

export async function syncWithToken(token: string, deps: Deps = {}, now = today()): Promise<number> {
  const selected = await getSelected()
  const win = windowFor(now)
  const rows: CalendarEvent[] = []
  for (const cal of selected) {
    for (const ev of await fetchEvents(token, cal, win, deps)) rows.push(...mapGoogleEvent(ev, cal))
  }
  return applyEvents(rows, selected, win)
}

export interface RunDeps extends Deps {
  getToken?: (clientId: string) => Promise<string>
  dropToken?: () => void
}

/** Full sync with status transitions and one silent-refresh retry on 401. */
export async function runSync(clientId: string, deps: RunDeps = {}): Promise<GcalStatus> {
  const prev = await getStatus()
  if (prev.state === 'syncing') return prev
  await setStatus({ ...prev, state: 'syncing', message: undefined })
  const tok = deps.getToken ?? getToken
  const drop = deps.dropToken ?? clearToken
  try {
    let count: number
    try {
      count = await syncWithToken(await tok(clientId), deps)
    } catch (e) {
      if (!(e instanceof GcalError && e.kind === 'auth')) throw e
      drop()
      count = await syncWithToken(await tok(clientId), deps)
    }
    const next: GcalStatus = { state: 'connected', lastSyncedAt: new Date().toISOString(), count }
    await setStatus(next)
    if (!(await db.events.filter((e) => e.kind === 'gcal.sync').count()))
      await logEvent({ area: 'personal', kind: 'gcal.sync', title: 'Connected Google Calendar', refTable: 'calendar' })
    return next
  } catch (e) {
    const next: GcalStatus = {
      state: 'error',
      lastSyncedAt: prev.lastSyncedAt,
      count: prev.count,
      message: e instanceof Error ? e.message : 'Sync failed.',
    }
    await setStatus(next)
    return next
  }
}

export async function removeGoogleEvents() {
  await db.calendar.where('uid').startsWith(GCAL_PREFIX).delete()
}

/** For pages to call: syncs if connected, last sync > 15 min ago, and a token is already in memory
 *  (never loads the Google script on its own). */
export function useGcalAutoSync() {
  useEffect(() => {
    void (async () => {
      const st = await getStatus()
      if (st.state !== 'connected' || !hasToken()) return
      if (st.lastSyncedAt && Date.now() - Date.parse(st.lastSyncedAt) < AUTO_SYNC_MS) return
      const id = await getClientId()
      if (id) await runSync(id)
    })()
  }, [])
}
