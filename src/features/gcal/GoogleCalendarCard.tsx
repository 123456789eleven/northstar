// Google Calendar connection card. Mounted by the Data Hub.
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setSetting } from '../../db'
import { Card, Field } from '../../components/ui'
import { requestToken, revokeToken, getToken } from './auth'
import {
  DAYS_AHEAD,
  DAYS_BACK,
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
import { friendlyGcalError, isValidClientId, LINKS, originsToAuthorize, validateClientId } from './help'
import './gcal.css'

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn-ghost btn-sm"
      aria-label={`Copy ${text}`}
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

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a className="btn btn-sm" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

const STEPS: { title: string; body: string; link?: [string, string] }[] = [
  { title: 'Create a project', body: 'Sign in to Google Cloud and create a project (any name, e.g. Northstar).', link: ['Open Google Cloud Console', LINKS.console] },
  { title: 'Enable the Calendar API', body: 'On the page that opens, make sure your project is selected and press Enable.', link: ['Open Calendar API page', LINKS.api] },
  { title: 'Set up the consent screen', body: 'Choose External, fill in an app name and your email, and add your own Google account under Test users. Leave it in Testing.', link: ['Open consent screen', LINKS.consent] },
  { title: 'Create an OAuth client', body: 'Create credentials, OAuth client ID, type Web application. Under Authorized JavaScript origins add both addresses below, then copy the Client ID.', link: ['Open credentials', LINKS.credentials] },
]

function Stepper({ step, setStep }: { step: number; setStep: (n: number) => void }) {
  const origins = originsToAuthorize(window.location.origin)
  return (
    <ol className="gcal-stepper">
      {STEPS.map((s, i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'todo'
        return (
          <li key={s.title} className={`gcal-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="gcal-num" aria-hidden>{state === 'done' ? '✓' : i + 1}</span>
            <div className="gcal-step-body">
              <b>{s.title}</b>
              <span className="sr-only">{state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ''}</span>
              {state === 'current' && (
                <>
                  <p className="muted small">{s.body}</p>
                  {i === 3 &&
                    origins.map((o) => (
                      <div className="gcal-origin" key={o}>
                        <code>{o}</code>
                        <CopyBtn text={o} />
                      </div>
                    ))}
                  <div className="gcal-actions">
                    {s.link && <Ext href={s.link[1]}>{s.link[0]}</Ext>}
                    <button className="btn btn-sm btn-primary" onClick={() => setStep(i + 1)}>
                      {i === STEPS.length - 1 ? 'I have the Client ID' : 'Done, next'}
                    </button>
                  </div>
                </>
              )}
              {state === 'done' && (
                <button className="gcal-linkbtn" onClick={() => setStep(i)}>
                  Show again
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default function GoogleCalendarCard() {
  const status = useLiveQuery(getStatus, [], { state: 'off' } as GcalStatus)
  const selected = useLiveQuery(getSelected, [], ['primary'])
  const eventCount = useLiveQuery(() => db.calendar.where('uid').startsWith('g:').count(), [], 0)
  const [clientId, setClientId] = useState('')
  const [fixedId, setFixedId] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [step, setStep] = useState(0)
  const [cals, setCals] = useState<CalendarInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    void getClientId().then((id) => {
      setClientId(id)
      setFixedId(!!import.meta.env?.VITE_GOOGLE_CLIENT_ID)
      setLoaded(true)
    })
  }, [])

  const connected = status.state !== 'off'
  const id = clientId.trim()
  const idMsg = validateClientId(id)
  const idOk = isValidClientId(id)
  const hasSaved = idOk && (connected || fixedId)
  const fail = (e: unknown) => setErr(friendlyGcalError(e))

  async function loadCalendars() {
    setCals(await fetchCalendarList(await getToken(id)))
  }

  async function connect() {
    if (!idOk) return
    setBusy(true)
    setErr('')
    try {
      await setSetting('gcal.clientId', id)
      await requestToken(id, 'consent')
      await setStatus({ state: 'connected' })
      await loadCalendars().catch(fail)
      const r = await runSync(id)
      if (r.state === 'error') setErr(friendlyGcalError(r.message))
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
      if (r.state === 'error') setErr(friendlyGcalError(r.message))
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
    if (!window.confirm(`Disconnect Google Calendar?\n\nThis forgets the Client ID and sign-in on this device and removes the ${eventCount} events imported from Google. Your own events are not touched.`)) return
    setBusy(true)
    try {
      await revokeToken()
      await removeGoogleEvents()
      await setSetting('gcal.clientId', '')
      await setSetting('gcal.calendars', [])
      await setStatus({ state: 'off' })
      setCals([])
      setClientId(fixedId ? clientId : '')
      setStep(0)
      setErr('')
    } finally {
      setBusy(false)
    }
  }

  const stateLabel =
    status.state === 'syncing' ? 'Syncing' : status.state === 'connected' ? 'Connected' : status.state === 'error' ? 'Needs attention' : 'Not connected'
  const last = status.lastSyncedAt
    ? new Date(status.lastSyncedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null
  const shownErr = err || (status.state === 'error' ? friendlyGcalError(status.message) : '')
  const account = cals.find((c) => c.primary)?.summary
  const idField = (
    <Field label="Google OAuth Client ID">
      <input
        className="input"
        value={clientId}
        placeholder="123...apps.googleusercontent.com"
        onChange={(e) => setClientId(e.target.value)}
        disabled={connected}
        aria-invalid={!!idMsg}
        autoComplete="off"
        spellCheck={false}
      />
      {idMsg && <div className="gcal-err" role="alert">{idMsg}</div>}
    </Field>
  )

  return (
    <Card title="Google Calendar" action={<span className={`chip ${status.state === 'connected' ? 'chip-accent' : ''}`}>{stateLabel}</span>}>
      <p className="muted small" style={{ margin: 0 }}>
        Read-only: Northstar can view your events but never change them. Events load straight from Google into this device, your sign-in is never stored, and the Google script loads only when you press Connect.
      </p>

      {loaded && !fixedId && !hasSaved && (
        <>
          <Stepper step={step} setStep={setStep} />
          <div className={`gcal-step ${step >= STEPS.length ? 'current' : 'todo'} gcal-last`}>
            <span className="gcal-num" aria-hidden>{STEPS.length + 1}</span>
            <div className="gcal-step-body">
              <b>Paste the Client ID and connect</b>
              {step >= STEPS.length && idField}
            </div>
          </div>
        </>
      )}

      {loaded && !fixedId && hasSaved && (
        <details className="gcal-how">
          <summary>How to get a Client ID</summary>
          <Stepper step={STEPS.length} setStep={() => {}} />
        </details>
      )}

      {connected && (
        <>
          <dl className="gcal-facts">
            <div><dt>Account</dt><dd>{account ?? 'Primary calendar'}</dd></div>
            <div><dt>Last synced</dt><dd>{last ?? 'Not yet'}</dd></div>
            <div><dt>Imported</dt><dd>{eventCount} events</dd></div>
            <div><dt>Range</dt><dd>{DAYS_BACK} days back, {DAYS_AHEAD} days ahead</dd></div>
          </dl>
          {cals.length > 0 ? (
            <div className="gcal-cals" role="group" aria-label="Calendars to import">
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
          ) : (
            <p className="muted small">Importing your primary calendar. Press Sync now to choose others.</p>
          )}
        </>
      )}

      {shownErr && (
        <div className="gcal-err" role="alert">
          {shownErr}
        </div>
      )}

      <div className="gcal-actions">
        {!connected && (
          <button className="btn btn-primary" disabled={busy || !idOk || (!fixedId && step < STEPS.length)} onClick={() => void connect()}>
            {busy ? 'Waiting for Google...' : 'Connect'}
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
      {fixedId && !connected && <p className="muted small">This build has a Client ID built in.</p>}
    </Card>
  )
}
