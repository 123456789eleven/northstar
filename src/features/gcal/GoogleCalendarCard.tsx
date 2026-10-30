// Google Calendar connection card. Mounted by the Data Hub.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'
import { Card, Field } from '../../components/ui'
import { requestToken, revokeToken, getToken } from './auth'
import {
  fetchCalendarList,
  getClientId,
  getSelected,
  getStatus,
  removeGoogleEvents,
  runSync,
  setStatus,
  type CalendarInfo,
  type GcalStatus,
} from './sync'
import './gcal.css'

const ORIGINS = ['https://123456789eleven.github.io', 'http://localhost:5180', 'http://localhost:5173']

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true)
            setTimeout(() => setDone(false), 1500)
          })
          .catch(() => {})
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function SetupGuide() {
  return (
    <ol className="gcal-steps">
      <li>Create a Google Cloud project at console.cloud.google.com.</li>
      <li>Enable the Google Calendar API (APIs and Services, Library).</li>
      <li>Configure the OAuth consent screen: User type External, then add your own Google account as a test user.</li>
      <li>
        Create credentials, OAuth client ID, type Web application. Add these Authorized JavaScript origins:
        {ORIGINS.map((o) => (
          <div className="gcal-origin" key={o}>
            <code>{o}</code>
            <CopyBtn text={o} />
          </div>
        ))}
      </li>
      <li>Paste the Client ID below.</li>
    </ol>
  )
}

export default function GoogleCalendarCard() {
  const status = useLiveQuery(getStatus, [], { state: 'off' } as GcalStatus)
  const selected = useLiveQuery(getSelected, [], ['primary'])
  const eventCount = useLiveQuery(() => db.calendar.where('uid').startsWith('g:').count(), [], 0)
  const [envId, setEnvId] = useState('')
  const [clientId, setClientId] = useState('')
  const [fixedId, setFixedId] = useState(false)
  const [cals, setCals] = useState<CalendarInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    void getClientId().then((id) => {
      setEnvId(id)
      setClientId(id)
      setFixedId(!!import.meta.env?.VITE_GOOGLE_CLIENT_ID)
    })
  }, [])
  void envId

  const connected = status.state !== 'off'
  const id = clientId.trim()
  const fail = (e: unknown) => setErr(e instanceof Error ? e.message : 'Something went wrong.')

  async function loadCalendars() {
    setCals(await fetchCalendarList(await getToken(id)))
  }

  async function connect() {
    setBusy(true)
    setErr('')
    try {
      await setSetting('gcal.clientId', id)
      await requestToken(id, 'consent')
      await setStatus({ state: 'connected' })
      await loadCalendars().catch(fail)
      const r = await runSync(id)
      if (r.state === 'error') setErr(r.message ?? '')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    setErr('')
    try {
      const r = await runSync(id)
      if (r.state === 'error') setErr(r.message ?? '')
      else await loadCalendars().catch(() => {})
    } finally {
      setBusy(false)
    }
  }

  async function toggle(c: CalendarInfo) {
    const primaryId = cals.find((x) => x.primary)?.id
    const cur = new Set(selected.map((s) => (s === 'primary' && primaryId ? primaryId : s)))
    if (cur.has(c.id)) cur.delete(c.id)
    else cur.add(c.id)
    if (!cur.size) return
    await setSetting('gcal.calendars', [...cur])
  }

  async function disconnect() {
    const remove = window.confirm(
      `Disconnect Google Calendar?\n\nPress OK to also remove the ${eventCount} events imported from Google. Press Cancel to disconnect but keep them.`,
    )
    setBusy(true)
    try {
      await revokeToken()
      if (remove) await removeGoogleEvents()
      await setStatus({ state: 'off' })
      setCals([])
    } finally {
      setBusy(false)
    }
  }

  const stateLabel =
    status.state === 'syncing' ? 'Syncing' : status.state === 'connected' ? 'Connected' : status.state === 'error' ? 'Needs attention' : 'Not connected'
  const last = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const shownErr = err || (status.state === 'error' ? status.message : '')

  return (
    <Card title="Google Calendar" action={<span className={`chip ${status.state === 'connected' ? 'chip-accent' : ''}`}>{stateLabel}</span>}>
      <p className="muted small" style={{ margin: 0 }}>
        Events load directly from Google into this device. Northstar only requests read-only access, never stores your token, and the Google script loads only when you connect.
      </p>

      {!fixedId && !connected && <SetupGuide />}
      {!fixedId && (
        <Field label="Google OAuth Client ID">
          <input
            className="input"
            value={clientId}
            placeholder="123...apps.googleusercontent.com"
            onChange={(e) => setClientId(e.target.value)}
            disabled={connected}
          />
        </Field>
      )}

      {connected && (
        <>
          {cals.length > 0 && (
            <div className="gcal-cals">
              {cals.map((c) => {
                const on = selected.includes(c.id) || (c.primary && selected.includes('primary'))
                return (
                  <label className="gcal-cal" key={c.id}>
                    <input type="checkbox" checked={!!on} onChange={() => void toggle(c)} />
                    <span>{c.summary}</span>
                  </label>
                )
              })}
            </div>
          )}
          <div className="muted small" style={{ marginTop: 8 }}>
            {eventCount} events{last ? `, last synced ${last}` : ''}
          </div>
        </>
      )}

      {shownErr && (
        <div className="gcal-err" role="alert">
          {shownErr}
        </div>
      )}

      <div className="gcal-actions">
        {!connected && (
          <button className="btn btn-primary" disabled={busy || !id} onClick={() => void connect()}>
            Connect
          </button>
        )}
        {connected && (
          <button className="btn btn-primary btn-sm" disabled={busy || status.state === 'syncing'} onClick={() => void syncNow()}>
            Sync now
          </button>
        )}
        {status.state === 'error' && (
          <button className="btn btn-sm" disabled={busy} onClick={() => void connect()}>
            Reconnect
          </button>
        )}
        {connected && (
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void disconnect()}>
            Disconnect
          </button>
        )}
      </div>
    </Card>
  )
}
