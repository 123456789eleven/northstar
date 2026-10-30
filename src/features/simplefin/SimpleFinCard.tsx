// Opt-in live bank feed (SimpleFIN Bridge) via your own Supabase relay. Mounted by the Data Hub, lazy-loaded.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../../db'
import { Card, Field } from '../../components/ui'
import { today } from '../../lib/dates'
import { liveStore, refreshSession } from '../../sync/manager'
import { allRules, RULES_KEY, type Rule } from '../finance/categories'
import { commitImport } from '../finance/importActions'
import { claimSetupToken, disconnect, fetchAccounts, hasAccessUrl, isSignedIn, setStatus, testRelay, type FeedStatus } from './client'
import {
  DEFAULT_DAYS,
  FIRST_SYNC_DAYS,
  LINKS,
  REQUESTS_KEY,
  STATUS_KEY,
  dateWindows,
  friendlyFeedError,
  summarizeStatus,
  syncGate,
} from './help'
import { balanceSnapshots, feedMessages, mapAccounts, SFIN_LABEL, SFIN_PREFIX, splitNew, type FeedRow, type SfinResponse } from './map'
import '../gcal/gcal.css'
import './simplefin.css'

interface Preview {
  fresh: FeedRow[]
  already: number
  pending: number
  invalid: number
  messages: string[]
  resp: SfinResponse
}

function Ext({ href, children }: { href: string; children: string }) {
  return (
    <a className="btn btn-sm" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function Disclosure() {
  return (
    <div className="sfin-box">
      <b>What leaves this device, and what does not</b>
      <ul>
        <li>Your Setup Token (once), later your access URL, and the date range you ask for go to your own relay in your Supabase project.</li>
        <li>Your bank transactions come back through that relay. SimpleFIN, the service that talks to your bank, can see them. The relay stores and logs nothing.</li>
        <li>The access URL is a secret. It is kept only on this device: never synced, never in a backup file, never shown again.</li>
        <li>Your bank username and password are never given to Northstar. Your existing Northstar records are never sent.</li>
      </ul>
    </div>
  )
}

export default function SimpleFinCard() {
  const live = useSyncExternalStore(liveStore.subscribe, liveStore.get)
  const connected = useLiveQuery(hasAccessUrl, [], false)
  const status = useLiveQuery(() => getSetting<FeedStatus>(STATUS_KEY, {}), [], {} as FeedStatus)
  const feedCount = useLiveQuery(() => db.transactions.filter((t) => !!t.fitid?.startsWith(SFIN_PREFIX)).count(), [], 0)
  const [step, setStep] = useState(0)
  const [relay, setRelay] = useState<{ ok: boolean; text: string } | null>(null)
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [addBalances, setAddBalances] = useState(true)
  const [gated, setGated] = useState(false)

  useEffect(() => {
    if (!live.checked) void refreshSession().catch(() => {})
  }, [live.checked])

  const signedIn = isSignedIn() || !!live.userId
  const fail = (e: unknown) => setErr(friendlyFeedError(e))

  async function runTest() {
    setBusy(true)
    setErr('')
    setRelay(null)
    const r = await testRelay()
    if (r.ok) setRelay({ ok: true, text: 'Pass. The relay is deployed and accepted your sign-in.' })
    else setRelay({ ok: false, text: `Fail. ${friendlyFeedError(r.status)}` })
    setBusy(false)
  }

  async function connect() {
    if (!token.trim()) return
    setBusy(true)
    setErr('')
    try {
      await claimSetupToken(token)
      setToken('')
      setStep(0)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function sync(force: boolean) {
    setBusy(true)
    setErr('')
    setInfo('')
    setGated(false)
    setPreview(null)
    try {
      const first = !status.lastSyncedAt
      const days = first ? FIRST_SYNC_DAYS : DEFAULT_DAYS
      const requests = await getSetting<number[]>(REQUESTS_KEY, [])
      const gate = syncGate(status.lastSyncedAt, requests, Date.now(), force, dateWindows(Date.now(), days).length)
      if (!gate.allowed) {
        setInfo(gate.reason ?? '')
        setGated(!force)
        return
      }
      const resp = await fetchAccounts(days)
      const rules = allRules(await getSetting<Rule[]>(RULES_KEY, []))
      const mapped = mapAccounts(resp, rules)
      const existing = await db.transactions.filter((t) => !!t.fitid?.startsWith(SFIN_PREFIX)).toArray()
      const { fresh, already } = splitNew(mapped.rows, existing.map((t) => t.fitid))
      setPreview({ fresh, already: already + mapped.duplicates, pending: mapped.pending, invalid: mapped.invalid, messages: feedMessages(resp), resp })
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function commit() {
    if (!preview) return
    setBusy(true)
    try {
      if (preview.fresh.length) await commitImport(SFIN_LABEL, preview.fresh, preview.already, preview.invalid)
      if (addBalances) {
        const date = today()
        for (const s of balanceSnapshots(preview.resp, date)) {
          const same = await db.balances.where('date').equals(date).filter((b) => b.name === s.name).first()
          if (same?.id != null) await db.balances.update(same.id, { balance: s.balance, kind: s.kind })
          else await db.balances.add(s)
        }
      }
      await setStatus({ lastSyncedAt: new Date().toISOString(), lastAdded: preview.fresh.length, messages: preview.messages })
      setInfo(preview.fresh.length ? `Added ${preview.fresh.length} transactions. Undo is in Import history below.` : 'Nothing new to add.')
      setPreview(null)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function doDisconnect() {
    let remove = false
    if (feedCount > 0) remove = window.confirm(`Disconnect SimpleFIN?\n\nOK: also remove the ${feedCount} transactions imported by the feed.\nCancel: stop here (you will be asked again whether to keep them).`)
    if (!remove && !window.confirm('Disconnect SimpleFIN and keep the transactions already imported? This forgets the access URL on this device.')) return
    setBusy(true)
    try {
      const n = await disconnect(remove)
      setPreview(null)
      setErr('')
      setInfo(remove ? `Disconnected. Removed ${n} transactions.` : 'Disconnected. The access URL was deleted from this device.')
    } finally {
      setBusy(false)
    }
  }

  const stateLabel = connected ? 'Connected' : 'Off'
  const STEPS = ['Get a SimpleFIN account and Setup Token', 'Deploy the relay', 'Paste the Setup Token and connect']
  const state = (i: number) => (i < step ? 'done' : i === step ? 'current' : 'todo')

  return (
    <Card title="Live bank feed (SimpleFIN)" action={<span className={`chip ${connected ? 'chip-accent' : ''}`}>{stateLabel}</span>}>
      <p className="muted small" style={{ margin: 0 }}>
        Off by default and optional. Bank files you import yourself stay the main way in. This pulls transactions straight from your bank through SimpleFIN Bridge, a paid service you sign up for yourself.
      </p>
      <Disclosure />

      {!signedIn && (
        <p className="gcal-err" role="alert">
          This needs your sync account. <Link to="/settings">Sign in under Settings</Link> (you do not have to turn sync on), then come back.
        </p>
      )}

      {signedIn && !connected && (
        <ol className="gcal-stepper">
          {STEPS.map((title, i) => (
            <li key={title} className={`gcal-step ${state(i)}`} aria-current={state(i) === 'current' ? 'step' : undefined}>
              <span className="gcal-num" aria-hidden>{state(i) === 'done' ? '✓' : i + 1}</span>
              <div className="gcal-step-body">
                <b>{title}</b>
                {state(i) === 'done' && (
                  <button className="gcal-linkbtn" onClick={() => setStep(i)}>Show again</button>
                )}
                {state(i) === 'current' && i === 0 && (
                  <>
                    <p className="muted small">Create a SimpleFIN Bridge account, link your bank there, then create a Setup Token. Keep that page open; you paste it in step 3.</p>
                    <div className="gcal-actions">
                      <Ext href={LINKS.signup}>Open SimpleFIN sign-up</Ext>
                      <Ext href={LINKS.info}>About SimpleFIN</Ext>
                      <button className="btn btn-sm btn-primary" onClick={() => setStep(1)}>Done, next</button>
                    </div>
                  </>
                )}
                {state(i) === 'current' && i === 1 && (
                  <>
                    <p className="muted small">
                      SimpleFIN cannot be called from a browser, so a tiny relay runs in your own Supabase project. Follow <code>docs/simplefin-setup.md</code> (code and click-by-click steps are in <code>supabase/functions/simplefin-relay/README.md</code>), then test it.
                    </p>
                    <div className="gcal-actions">
                      <button className="btn btn-sm" disabled={busy} onClick={() => void runTest()}>{busy ? 'Testing...' : 'Test relay'}</button>
                      <button className="btn btn-sm btn-primary" disabled={!relay?.ok} onClick={() => setStep(2)}>Relay works, next</button>
                    </div>
                    {relay && <div className={relay.ok ? 'sfin-pass' : 'gcal-err'} role="status">{relay.text}</div>}
                  </>
                )}
                {state(i) === 'current' && i === 2 && (
                  <>
                    <Field label="Setup Token">
                      <input className="input" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste the long token" autoComplete="off" spellCheck={false} type="password" />
                    </Field>
                    <p className="muted small">A Setup Token works once. It is swapped for an access URL that stays only on this device.</p>
                    <div className="gcal-actions">
                      <button className="btn btn-sm btn-primary" disabled={busy || !token.trim()} onClick={() => void connect()}>{busy ? 'Connecting...' : 'Connect'}</button>
                    </div>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {connected && (
        <dl className="gcal-facts">
          <div><dt>Last synced</dt><dd>{summarizeStatus(status)}</dd></div>
          <div><dt>Imported</dt><dd>{feedCount} transactions</dd></div>
          <div><dt>Range</dt><dd>{status.lastSyncedAt ? `Last ${DEFAULT_DAYS} days` : `Last ${FIRST_SYNC_DAYS} days the first time`}. At most once per 6 hours.</dd></div>
        </dl>
      )}

      {status.messages?.map((m) => (
        <div className="gcal-err" key={m}>SimpleFIN says: {m}</div>
      ))}

      {preview && (
        <div className="sfin-preview" role="status">
          <b>{preview.fresh.length} new</b> · {preview.already} already imported
          {preview.pending > 0 && <> · {preview.pending} pending skipped</>}
          {preview.invalid > 0 && <> · {preview.invalid} unreadable skipped</>}
          {preview.fresh.length > 0 && (
            <ul className="sfin-rows">
              {preview.fresh.slice(0, 5).map((r) => (
                <li key={r.fitid}><span>{r.date}</span> <span className="sfin-desc">{r.description}</span> <span>{r.amount.toFixed(2)}</span></li>
              ))}
              {preview.fresh.length > 5 && <li className="muted">and {preview.fresh.length - 5} more</li>}
            </ul>
          )}
          <label className="gcal-cal">
            <input type="checkbox" checked={addBalances} onChange={(e) => setAddBalances(e.target.checked)} />
            <span>Also record today&rsquo;s account balances in Net worth</span>
          </label>
          <div className="gcal-actions">
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => void commit()}>
              {preview.fresh.length ? `Add ${preview.fresh.length} transactions` : 'Finish'}
            </button>
            <button className="btn btn-sm" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}

      {err && <div className="gcal-err" role="alert">{err}</div>}
      {info && <p className="muted small" role="status">{info}</p>}

      {connected && (
        <div className="gcal-actions">
          <button className="btn btn-primary btn-sm" disabled={busy || !signedIn} onClick={() => void sync(false)}>{busy ? 'Working...' : 'Sync now'}</button>
          {gated && <button className="btn btn-sm" disabled={busy} onClick={() => void sync(true)}>Sync anyway</button>}
          <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => void doDisconnect()}>Disconnect</button>
        </div>
      )}
    </Card>
  )
}
