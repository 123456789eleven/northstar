import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../../db'
import { Card, Field, Modal } from '../../components/ui'
import { demoCounts, removeDemo } from '../../lib/demo'
import { loadDemoWithConfirm } from '../onboarding/demoActions'
import { BACKUP_LAST_KEY, BACKUP_REMIND_DAYS, eraseAll, exportBackup, importBackup, parseBackup, type ParsedBackup } from '../../lib/backup'
import { openSetup } from '../onboarding/setupLogic'
import * as sync from '../../sync/manager'
import { eraseLocalWithoutSync, restoreWithoutSync } from '../../sync/manager'

const TABLE_LABEL: Record<string, string> = {
  tasks: 'Tasks', goals: 'Goals', meals: 'Meals', favoriteMeals: 'Favorite meals', transactions: 'Transactions',
  budgets: 'Budgets', balances: 'Balances', learning: 'Learning items', studySessions: 'Study sessions',
  people: 'People', interactions: 'Interactions', events: 'History events', reviews: 'Reviews', settings: 'Settings',
  outbox: 'Sync queue', syncMeta: 'Sync ids',
}
const label = (t: string) => TABLE_LABEL[t] ?? t

function fmtBytes(n?: number) {
  if (n == null) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function ProfileSection() {
  const stored = useLiveQuery(() => getSetting('profile.name', ''), [])
  const [name, setName] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const value = name ?? stored ?? ''
  const dirty = name !== null && name.trim() !== (stored ?? '')

  async function save() {
    await setSetting('profile.name', value.trim())
    setName(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <Card title="Preferences">
      <form className="set-profile-row" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <Field label="Display name (used for the greeting on Today)">
          <input className="input" value={value} placeholder="What should Northstar call you?" onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <button className="btn" type="submit" disabled={!dirty}>Save</button>
      </form>
      <div className="row-between" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
        <span className="small muted">Guided setup: goals, habits, budgets, people and first tasks.</span>
        <button className="btn btn-sm" onClick={openSetup}>Run setup</button>
      </div>
      <p className="set-text tiny faint" style={{ marginTop: 8 }} role="status">{saved ? 'Saved.' : 'Northstar is dark only and has no other display options. The name stays on this device unless you turn on Sync.'}</p>
    </Card>
  )
}

export function BackupSection() {
  const backupInfo = useLiveQuery(async () => {
    const at = await getSetting<string | null>(BACKUP_LAST_KEY, null)
    return { at, ageDays: at ? Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000) : null }
  }, [])
  const lastAt = backupInfo?.at
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [pending, setPending] = useState<ParsedBackup | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const ageDays = backupInfo?.ageDays ?? null
  const overdue = backupInfo !== undefined && (ageDays === null || ageDays > BACKUP_REMIND_DAYS)

  async function onExport() {
    setBusy(true); setError(''); setDone('')
    try {
      const data = await exportBackup()
      const rows = Object.values(data.tables).reduce((n, r) => n + r.length, 0)
      setDone(`Exported ${rows.toLocaleString()} rows.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
    } finally {
      setBusy(false)
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setError(''); setDone('')
    try {
      setPending(await parseBackup(f))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that file.')
    }
  }

  async function onConfirmImport() {
    if (!pending) return
    setBusy(true)
    try {
      // Restoring is not a burst of new edits: it is not queued for sync (Settings > Sync then asks how to reconcile).
      await restoreWithoutSync(() => importBackup(pending.data))
      setDone(`Restored backup from ${fmtWhen(pending.data.exportedAt)}.`)
      setPending(null)
    } catch (e) {
      setError(e instanceof Error ? `Import failed, nothing was changed: ${e.message}` : 'Import failed, nothing was changed.')
      setPending(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Backup & restore">
      {overdue && (
        <div className="set-notice" style={{ marginBottom: 14 }}>
          <span>{ageDays === null ? 'You have never made a backup.' : `Last backup was ${ageDays} days ago.`}</span>
          <button className="btn btn-sm" onClick={onExport} disabled={busy}>Back up now</button>
        </div>
      )}
      <p className="set-text">
        A backup is a single JSON file with everything in Northstar, saved by your browser to your own device. Keep a copy somewhere safe (a USB drive,
        your own cloud folder). To move to another device or browser, export here and import there. Importing replaces what is in this browser.
      </p>
      <dl className="set-kv">
        <dt>Last backup</dt>
        <dd>{lastAt ? fmtWhen(lastAt) : 'Never'}</dd>
      </dl>
      <div className="row wrap">
        <button className="btn btn-primary" onClick={onExport} disabled={busy}>Export backup</button>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Import backup…</button>
        <input ref={fileRef} className="set-file" type="file" accept="application/json,.json" onChange={onPick} tabIndex={-1} aria-hidden />
      </div>
      {error && <p className="set-error" role="alert">{error}</p>}
      {done && <p className="set-ok" role="status">{done}</p>}

      {pending && (
        <Modal title="Restore this backup?" onClose={() => !busy && setPending(null)}>
          <p className="set-text">
            Exported {fmtWhen(pending.data.exportedAt)}. Restoring <strong>replaces all data</strong> currently in this browser. Export a backup first if you might want it back.
          </p>
          <div className="set-counts">
            {pending.counts.map((c) => (
              <div key={c.table}><span className="muted">{label(c.table)}</span><span className="mono">{c.rows.toLocaleString()}</span></div>
            ))}
          </div>
          {pending.unknown.length > 0 && (
            <p className="set-text small">Ignored (not used by this version): {pending.unknown.join(', ')}</p>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setPending(null)} disabled={busy}>Cancel</button>
            <button className="btn btn-primary" onClick={onConfirmImport} disabled={busy}>{busy ? 'Restoring…' : 'Replace and restore'}</button>
          </div>
        </Modal>
      )}
    </Card>
  )
}

export function StorageSection() {
  const demo = useLiveQuery(async () => ({ v: await demoCounts() }), [])
  const rows = useLiveQuery(async () => {
    let n = 0
    for (const t of db.tables) n += await t.count()
    return n
  }, [])
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoMsg, setDemoMsg] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [est, setEst] = useState<{ usage?: number; quota?: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [tick, setTick] = useState(0)
  const supported = typeof navigator !== 'undefined' && !!navigator.storage

  useEffect(() => {
    if (!supported) return
    let alive = true
    Promise.all([
      navigator.storage.persisted().catch(() => null),
      navigator.storage.estimate().catch(() => null),
    ]).then(([p, e]) => {
      if (!alive) return
      setPersisted(p)
      setEst(e)
    })
    return () => { alive = false }
  }, [supported, tick])

  async function request() {
    try {
      const ok = await navigator.storage.persist()
      setMsg(ok ? 'The browser agreed to keep this data.' : 'The browser declined for now. Installing Northstar as an app, or using it often, usually changes that.')
    } catch {
      setMsg('This browser does not support the request.')
    }
    setTick((t) => t + 1)
  }

  return (
    <Card title="Data on this device">
      <p className="set-text">
        Your data lives in this browser, on this device. Unless you turn on Sync, it is not copied anywhere. Clearing site data, uninstalling
        the browser, or using a private window will remove it. Backups (and, if you choose, encrypted sync) are how you protect it or move it.
      </p>
      {supported ? (
        <>
          <dl className="set-kv">
            <dt>Rows stored</dt>
            <dd>{rows == null ? '—' : rows.toLocaleString()}</dd>
            <dt>Protected from cleanup</dt>
            <dd>{persisted === null ? 'Unknown' : persisted ? <span className="good">Yes</span> : 'No'}</dd>
            <dt>Used</dt>
            <dd>{fmtBytes(est?.usage)}{est?.quota ? <span className="faint"> of {fmtBytes(est.quota)} available</span> : null}</dd>
          </dl>
          {persisted === false && (
            <>
              <p className="set-text small">Without protection the browser may delete this data when the device is low on space.</p>
              <button className="btn" onClick={request}>Ask browser to keep data</button>
            </>
          )}
          {msg && <p className="set-text small" style={{ marginTop: 10 }}>{msg}</p>}
        </>
      ) : (
        <p className="set-text small">This browser does not report storage details.</p>
      )}
      {demo && (
        <div className="set-sub">
          <div className="row-between wrap">
            <p className="set-text" style={{ margin: 0 }}>
              {demo.v
                ? `Sample data is loaded (${demo.v.rows.toLocaleString()} rows). You can remove it under Danger zone.`
                : 'Demo data fills the app with a fictional three months so you can see how it works. Removable at any time.'}
            </p>
            {!demo.v && (
              <button className="btn" disabled={demoBusy} onClick={() => { setDemoBusy(true); void loadDemoWithConfirm().then((r) => setDemoMsg(r === 'loaded' ? 'Demo data loaded.' : '')).finally(() => setDemoBusy(false)) }}>Load demo data</button>
            )}
          </div>
          <p className="set-text tiny faint" style={{ marginTop: 8 }}>Demo data stays on this device and never syncs, even if sync is on.</p>
          {demoMsg && <p className="set-ok" role="status">{demoMsg}</p>}
        </div>
      )}
    </Card>
  )
}

export function StatusStrip() {
  const syncStatus = useLiveQuery(() => getSetting<sync.SyncStatus>(sync.STATUS_KEY, { state: 'off', lastSyncedAt: null, pending: 0 }), [])
  const syncOn = useLiveQuery(() => getSetting<boolean>(sync.ENABLED_KEY, false), [])
  const lastBackup = useLiveQuery(async () => {
    const at = await getSetting<string | null>(BACKUP_LAST_KEY, null)
    return { at, ageDays: at ? Math.floor((Date.now() - new Date(at).getTime()) / 86_400_000) : null }
  }, [])
  const demo = useLiveQuery(async () => ({ v: await demoCounts() }), [])
  if (!syncStatus || !lastBackup || !demo) return <div className="set-status" aria-hidden style={{ minHeight: 64 }} />
  const ageDays = lastBackup.ageDays
  const stale = ageDays === null || ageDays > BACKUP_REMIND_DAYS
  const syncLabel = !syncOn || syncStatus.state === 'off' ? 'Off' : ({ locked: 'Locked', syncing: 'Syncing', 'up-to-date': 'On, up to date', offline: 'On, offline', error: 'Error' } as Record<string, string>)[syncStatus.state] ?? 'On'
  return (
    <dl className="set-status" aria-label="Status">
      <div>
        <dt>Sync</dt>
        <dd className={syncStatus.state === 'error' ? 'warn' : undefined}>{syncLabel}</dd>
        <span className="set-status-note">{syncOn && syncStatus.lastSyncedAt ? `Last ${fmtWhen(syncStatus.lastSyncedAt)}` : 'Nothing leaves this device'}</span>
      </div>
      <div>
        <dt>Last backup</dt>
        <dd className={stale ? 'warn' : undefined}>{lastBackup.at ? fmtWhen(lastBackup.at) : 'Never'}</dd>
        <span className="set-status-note">{ageDays === null ? 'Export one under Backup' : ageDays === 0 ? 'Today' : `${ageDays} ${ageDays === 1 ? 'day' : 'days'} ago`}</span>
      </div>
      <div>
        <dt>Demo data</dt>
        <dd>{demo.v ? 'Present' : 'None'}</dd>
        <span className="set-status-note">{demo.v ? `${demo.v.rows.toLocaleString()} sample rows` : 'Only your own data'}</span>
      </div>
    </dl>
  )
}

export function DangerSection() {
  const [open, setOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const counts = useLiveQuery(async () => {
    let n = 0
    for (const t of db.tables) n += await t.count()
    return n
  }, [])
  const demo = useLiveQuery(async () => ({ v: await demoCounts() }), [])

  async function erase() {
    setBusy(true)
    // Erasing this device never deletes the cloud copy; that is a separate action under Sync.
    await eraseLocalWithoutSync(eraseAll)
    setBusy(false)
    setOpen(false)
    setTyped('')
    setMsg('All data erased.')
  }

  async function dropDemo() {
    setBusy(true)
    try {
      setMsg(`Removed ${await removeDemo()} demo rows. Your own data was not touched.`)
      setRemoveOpen(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title="Danger zone" className="set-danger">
      <p className="set-text small">These actions change data on this device. Each one asks you to confirm first.</p>
      {demo?.v && (
        <div className="row-between wrap set-danger-row">
          <p className="set-text" style={{ margin: 0 }}><strong>Remove demo data.</strong> Deletes only the {demo.v.rows.toLocaleString()} sample rows. Your own entries stay.</p>
          <button className="btn btn-danger" onClick={() => { setRemoveOpen(true); setMsg('') }}>Remove demo data…</button>
        </div>
      )}
      <div className="row-between wrap set-danger-row">
        <p className="set-text" style={{ margin: 0 }}><strong>Erase all data.</strong> Permanently deletes everything stored in this browser{counts ? ` (${counts.toLocaleString()} rows)` : ''}, including your own entries.</p>
        <button className="btn btn-danger" onClick={() => { setOpen(true); setMsg('') }}>Erase all data…</button>
      </div>
      {msg && <p className="set-ok" role="status">{msg}</p>}
      {removeOpen && (
        <Modal title="Remove demo data" onClose={() => !busy && setRemoveOpen(false)}>
          <p className="set-text">This deletes the {demo?.v?.rows.toLocaleString()} sample rows that were loaded for the demo. Anything you added yourself stays. It cannot be undone, but you can load the demo again later.</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={() => setRemoveOpen(false)} disabled={busy}>Cancel</button>
            <button type="button" className="btn btn-danger" onClick={() => void dropDemo()} disabled={busy}>{busy ? 'Removing…' : 'Remove demo data'}</button>
          </div>
        </Modal>
      )}
      {open && (
        <Modal title="Erase all data" onClose={() => !busy && setOpen(false)}>
          <p className="set-text">This deletes every task, goal, transaction, meal, person, review and history entry on this device. It cannot be undone. It does not touch an encrypted cloud copy if you use Sync (delete that under Sync). Export a backup first if you might want any of it.</p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (typed === 'ERASE') void erase() }}>
            <Field label="Type ERASE to confirm">
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters" />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={typed !== 'ERASE' || busy}>{busy ? 'Erasing…' : 'Erase everything'}</button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  )
}

export function AboutSection() {
  return (
    <Card title="About & privacy">
      <p className="set-text">
        Northstar is a private, local-first dashboard. With sync off (the default) nothing you enter leaves this device: no accounts, no servers,
        no analytics. If you turn on Sync, records are encrypted on this device before being sent to your Supabase project, which stores only
        ciphertext. Supabase can still see your account email, how many records each section has, when they change, and their encrypted sizes,
        but not what they say. Bank data only enters through CSV files you choose to import, and no bank credentials are ever stored.
      </p>
      <p className="set-text small faint">Data format version {db.verno}.</p>
    </Card>
  )
}
