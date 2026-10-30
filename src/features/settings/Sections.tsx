import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting } from '../../db'
import { Card, Field, Modal } from '../../components/ui'
import { BACKUP_LAST_KEY, BACKUP_REMIND_DAYS, eraseAll, exportBackup, importBackup, parseBackup, type ParsedBackup } from '../../lib/backup'
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
    <Card title="Profile">
      <form className="set-profile-row" onSubmit={(e) => { e.preventDefault(); void save() }}>
        <Field label="Display name">
          <input className="input" value={value} placeholder="What should Northstar call you?" onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <button className="btn" type="submit" disabled={!dirty}>Save</button>
      </form>
      <p className="set-text tiny faint" style={{ marginTop: 8 }}>{saved ? 'Saved.' : 'Used for the greeting on Today.'}</p>
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
    <Card title="Backup">
      {overdue && (
        <div className="set-notice" style={{ marginBottom: 14 }}>
          <span>{ageDays === null ? 'You have never made a backup.' : `Last backup was ${ageDays} days ago.`}</span>
          <button className="btn btn-sm" onClick={onExport} disabled={busy}>Back up now</button>
        </div>
      )}
      <p className="set-text">
        A backup is a single JSON file with everything in Northstar. Save it somewhere safe (a USB drive, your own cloud folder).
        To move to another device or browser, export here and import there.
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
    <Card title="Storage">
      <p className="set-text">
        Your data lives in this browser, on this device. Unless you turn on Sync, it is not copied anywhere. Clearing site data, uninstalling
        the browser, or using a private window will remove it. Backups (and, if you choose, encrypted sync) are how you protect it or move it.
      </p>
      {supported ? (
        <>
          <dl className="set-kv">
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
    </Card>
  )
}

export function DangerSection() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const counts = useLiveQuery(async () => {
    let n = 0
    for (const t of db.tables) n += await t.count()
    return n
  }, [])

  async function erase() {
    setBusy(true)
    // Erasing this device never deletes the cloud copy; that is a separate action under Sync.
    await eraseLocalWithoutSync(eraseAll)
    setBusy(false)
    setOpen(false)
    setTyped('')
    setDone(true)
  }

  return (
    <Card title="Danger zone" className="set-danger">
      <div className="row-between wrap">
        <p className="set-text" style={{ margin: 0 }}>Permanently delete everything stored in this browser{counts ? ` (${counts.toLocaleString()} rows)` : ''}.</p>
        <button className="btn btn-danger" onClick={() => { setOpen(true); setDone(false) }}>Erase all data…</button>
      </div>
      {done && <p className="set-ok" role="status">All data erased.</p>}
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
    <Card title="About">
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
