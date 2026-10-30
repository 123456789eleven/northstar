// Settings > Sync: opt-in, end-to-end encrypted sync between this person's own devices.
// The Supabase client only loads after the person chooses to set sync up.
import { useEffect, useState, useSyncExternalStore, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting } from '../../db'
import { Card, Field, Modal } from '../../components/ui'
import { MIN_PASSPHRASE } from '../../sync/crypto'
import * as sync from '../../sync/manager'
import type { SyncStatus } from '../../sync/manager'

const STATE_LABEL: Record<SyncStatus['state'], string> = {
  off: 'Off', locked: 'Locked', syncing: 'Syncing', 'up-to-date': 'Up to date', offline: 'Offline', error: 'Error',
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const MIN_ACCOUNT_PASSWORD = 8
const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.')

type Step = 'idle' | 'config' | 'account' | 'checking' | 'create' | 'code' | 'unlock' | 'on'

export function SyncSection() {
  const status = useLiveQuery(() => getSetting<SyncStatus>(sync.STATUS_KEY, { state: 'off', lastSyncedAt: null, pending: 0 }), [])
  const enabled = useLiveQuery(() => getSetting<boolean>(sync.ENABLED_KEY, false), [])
  const restored = useLiveQuery(() => getSetting<boolean>(sync.RESTORED_KEY, false), [])
  const live = useSyncExternalStore(sync.liveStore.subscribe, sync.liveStore.get)
  const [step, setStep] = useState<Step>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('')
    try { await fn() } catch (e) { setError(errMsg(e)) } finally { setBusy(false) }
  }

  // Work out where the person is in the flow. Only loads the network client if sync was started before.
  async function resolveStep() {
    const cfg = await sync.getConfig()
    if (!cfg) return setStep('config')
    setStep('checking')
    const user = await sync.refreshSession()
    if (!user) return setStep('account')
    if (sync.isUnlocked()) return setStep('on')
    setStep((await sync.remoteVaultExists()) ? 'unlock' : 'create')
  }

  useEffect(() => {
    if (!enabled) return
    const t = setTimeout(() => void run(resolveStep), 0)
    return () => clearTimeout(t)
  }, [enabled])

  // Once unlocked, any setup step gives way to the controls.
  const view: Step = live.unlocked && step !== 'idle' ? 'on' : step

  const st = status ?? { state: 'off', lastSyncedAt: null, pending: 0 }

  return (
    <Card title="Sync" className="set-sync">
      <p className="set-text">
        Optional. Keeps your devices in step through your own Supabase project. Everything is encrypted on this device with a key made from
        your passphrase before it is sent, so Supabase only stores ciphertext. Sync is off by default and Northstar works fully offline.
      </p>
      <dl className="set-kv">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={st.state === 'error' ? 'warn' : st.state === 'up-to-date' ? 'good' : undefined}>{STATE_LABEL[st.state]}</span>
            {st.error ? <span className="faint"> · {st.error}</span> : null}
          </dd>
        </div>
        {st.state !== 'off' && (
          <>
            <div><dt>Last synced</dt><dd>{st.lastSyncedAt ? fmtWhen(st.lastSyncedAt) : 'Not yet'}</dd></div>
            <div><dt>Waiting to send</dt><dd>{st.pending.toLocaleString()} {st.pending === 1 ? 'change' : 'changes'}</dd></div>
          </>
        )}
        {live.email && <div><dt>Account</dt><dd>{live.email}</dd></div>}
      </dl>

      {restored && live.unlocked && <RestoreChoice busy={busy} run={run} />}

      {view === 'idle' && (
        <div className="row wrap">
          <button className="btn" onClick={() => run(resolveStep)} disabled={busy}>{enabled ? 'Show sync options' : 'Set up sync…'}</button>
        </div>
      )}
      {view === 'checking' && <p className="set-text small faint">Checking your account…</p>}
      {view === 'config' && <ConfigStep busy={busy} run={run} next={resolveStep} />}
      {view === 'account' && <AccountStep busy={busy} run={run} next={resolveStep} />}
      {view === 'create' && <CreateStep busy={busy} run={run} onCode={() => setStep('code')} />}
      {view === 'code' && <CodeStep busy={busy} run={run} back={() => setStep('create')} />}
      {view === 'unlock' && <UnlockStep busy={busy} run={run} />}
      {view === 'on' && <OnStep busy={busy} run={run} enabled={!!enabled} done={() => setStep('idle')} />}

      {error && <p className="set-error" role="alert">{error}</p>}
    </Card>
  )
}

interface StepProps {
  busy: boolean
  run: (fn: () => Promise<unknown>) => Promise<void>
}

function ConfigStep({ busy, run, next }: StepProps & { next: () => Promise<void> }) {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(async () => { await sync.saveConfig({ url, anonKey: key }); await next() }) }}>
      <p className="set-text small">
        Create a free Supabase project and apply Northstar&apos;s database setup (see supabase/README.md), then paste the project URL and
        the <strong>anon public</strong> key. The anon key is meant to be public; your rows are protected by row-level security and encryption.
        Never paste the service-role key.
      </p>
      <Field label="Project URL">
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd1234.supabase.co" autoComplete="off" inputMode="url" />
      </Field>
      <Field label="Anon public key">
        <input className="input" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} />
      </Field>
      <div className="row"><button className="btn btn-primary" type="submit" disabled={busy || !url || !key}>Save</button></div>
    </form>
  )
}

function AccountStep({ busy, run, next }: StepProps & { next: () => Promise<void> }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [note, setNote] = useState('')
  const submit = (kind: 'in' | 'up') => (e?: FormEvent) => {
    e?.preventDefault()
    setNote('')
    void run(async () => {
      if (kind === 'in') {
        await sync.signIn(email, pw)
        await next()
      } else {
        const r = await sync.signUp(email, pw)
        if (r.needsConfirm) setNote('Check your email to confirm, then sign in.')
        else await next()
      }
    })
  }
  return (
    <form className="stack" onSubmit={submit('in')}>
      <p className="set-text small">
        Your account password signs you in to Supabase. It is separate from the encryption passphrase you set next, which never leaves this device.
      </p>
      <Field label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
      <Field label="Account password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" minLength={MIN_ACCOUNT_PASSWORD} /></Field>
      <p className="set-text small faint">
        {pw.length < MIN_ACCOUNT_PASSWORD ? `Password: at least ${MIN_ACCOUNT_PASSWORD} characters (${MIN_ACCOUNT_PASSWORD - pw.length} more). ` : ''}
        Supabase may require a stronger one and will say so if it does.
      </p>
      <div className="row wrap">
        <button className="btn btn-primary" type="submit" disabled={busy || !email || pw.length < MIN_ACCOUNT_PASSWORD}>Sign in</button>
        <button className="btn" type="button" onClick={() => submit('up')()} disabled={busy || !email || pw.length < MIN_ACCOUNT_PASSWORD}>Create account</button>
      </div>
      {note && <p className="set-ok" role="status">{note}</p>}
    </form>
  )
}

const LOSS_WARNING = 'If you lose both your passphrase and your recovery code, nobody can decrypt the cloud copy, not you, not Supabase, not Northstar. The data on each device stays readable there; only the cloud copy becomes useless.'

function CreateStep({ busy, run, onCode }: StepProps & { onCode: () => void }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const ok = p1.length >= MIN_PASSPHRASE && p1 === p2
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); if (ok) void run(async () => { shownCode = await sync.startNewVault(p1); onCode() }) }}>
      <p className="set-text small">
        Choose an encryption passphrase (at least {MIN_PASSPHRASE} characters; a few unrelated words works well). You will type it once on each
        new device. It is never sent anywhere.
      </p>
      <Field label="Passphrase"><input className="input" type="password" value={p1} onChange={(e) => setP1(e.target.value)} autoComplete="new-password" /></Field>
      <Field label="Passphrase again"><input className="input" type="password" value={p2} onChange={(e) => setP2(e.target.value)} autoComplete="new-password" /></Field>
      <p className="set-text small warn">{LOSS_WARNING}</p>
      <div className="row"><button className="btn btn-primary" type="submit" disabled={busy || !ok}>{busy ? 'Creating keys…' : 'Continue'}</button></div>
    </form>
  )
}

/** Held in memory only, between CreateStep and CodeStep. */
let shownCode = ''
function CodeStep({ busy, run, back }: StepProps & { back: () => void }) {
  const [code] = useState(() => shownCode)
  const [saved, setSaved] = useState(false)
  const [typed, setTyped] = useState('')
  const [remember, setRemember] = useState(true)
  const lastGroup = code.split('-').pop() ?? ''
  const ok = saved && typed.trim().toUpperCase() === lastGroup
  return (
    <div className="stack">
      <p className="set-text small">
        This is your recovery code. It is shown <strong>once</strong>. Write it down or store it in a password manager. It can unlock your
        data if you forget the passphrase.
      </p>
      <p className="set-code mono" aria-label="Recovery code">{code}</p>
      <label className="row small"><input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} /> I have saved the recovery code somewhere safe</label>
      <Field label="Type the last five characters of the code to confirm">
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" maxLength={5} />
      </Field>
      <label className="row small"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Stay unlocked on this device</label>
      <p className="set-text small faint">Staying unlocked keeps a non-exportable key in this browser so sync runs without asking. Turn it off on shared devices.</p>
      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => run(async () => { await sync.confirmVault(remember); shownCode = '' })} disabled={busy || !ok}>Turn on sync</button>
        <button className="btn btn-ghost" onClick={() => { sync.cancelNewVault(); shownCode = ''; back() }} disabled={busy}>Cancel</button>
      </div>
    </div>
  )
}

function UnlockStep({ busy, run }: StepProps) {
  const [kind, setKind] = useState<'passphrase' | 'recovery'>('passphrase')
  const [secret, setSecret] = useState('')
  const [newPass, setNewPass] = useState('')
  const [remember, setRemember] = useState(true)
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); void run(() => sync.unlock(secret, kind, remember, kind === 'recovery' && newPass ? newPass : undefined)) }}>
      <p className="set-text small">
        This account already has an encrypted vault. Unlock it with your passphrase to start syncing this device. Records here and in the
        cloud are merged; where both have the same record, the cloud version is kept.
      </p>
      {kind === 'passphrase' ? (
        <Field label="Passphrase"><input className="input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="current-password" /></Field>
      ) : (
        <>
          <Field label="Recovery code"><input className="input mono" value={secret} onChange={(e) => setSecret(e.target.value)} autoComplete="off" spellCheck={false} /></Field>
          <Field label={`New passphrase (optional, at least ${MIN_PASSPHRASE} characters)`}>
            <input className="input" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
          </Field>
        </>
      )}
      <label className="row small"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Stay unlocked on this device</label>
      <div className="row wrap">
        <button className="btn btn-primary" type="submit" disabled={busy || !secret || (newPass !== '' && newPass.length < MIN_PASSPHRASE)}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        <button className="btn btn-ghost" type="button" onClick={() => { setKind(kind === 'passphrase' ? 'recovery' : 'passphrase'); setSecret('') }}>
          {kind === 'passphrase' ? 'Use recovery code instead' : 'Use passphrase instead'}
        </button>
      </div>
      <p className="set-text small faint">{LOSS_WARNING}</p>
    </form>
  )
}

function RestoreChoice({ busy, run }: StepProps) {
  return (
    <div className="set-notice" style={{ marginBottom: 14 }}>
      <span>You restored a backup. How should it meet the cloud copy?</span>
      <div className="row wrap">
        <button className="btn btn-sm btn-primary" onClick={() => run(() => sync.resolveRestore('merge'))} disabled={busy}>Merge (recommended)</button>
        <button className="btn btn-sm" onClick={() => run(() => sync.resolveRestore('replace'))} disabled={busy}>Replace cloud with this device</button>
      </div>
    </div>
  )
}

function OnStep({ busy, run, enabled, done }: StepProps & { enabled: boolean; done: () => void }) {
  const [confirm, setConfirm] = useState<'delete' | null>(null)
  const [typed, setTyped] = useState('')
  return (
    <>
      <div className="row wrap">
        <button className="btn btn-primary" onClick={() => run(sync.syncNow)} disabled={busy || !enabled}>Sync now</button>
        <button className="btn" onClick={() => run(() => sync.setEnabled(!enabled))} disabled={busy}>{enabled ? 'Pause sync' : 'Resume sync'}</button>
        <button className="btn" onClick={() => run(async () => { await sync.lock(); done() })} disabled={busy}>Lock</button>
        <button className="btn btn-ghost" onClick={() => run(async () => { await sync.signOut(); done() })} disabled={busy}>Sign out</button>
      </div>
      <p className="set-text small faint" style={{ marginTop: 10 }}>
        Pausing stops all network traffic; changes keep being noted locally and go out when you resume. Lock forgets the key on this device.
      </p>
      <div className="row-between wrap" style={{ marginTop: 14 }}>
        <p className="set-text small" style={{ margin: 0 }}>Remove sync from this device only (local data stays).</p>
        <button className="btn btn-sm" onClick={() => run(async () => { await sync.disconnectDevice(); done() })} disabled={busy}>Disconnect this device</button>
      </div>
      <div className="row-between wrap" style={{ marginTop: 10 }}>
        <p className="set-text small" style={{ margin: 0 }}>Delete every encrypted record and key from the cloud. Data on your devices is not touched.</p>
        <button className="btn btn-sm btn-danger" onClick={() => setConfirm('delete')} disabled={busy}>Delete my cloud data…</button>
      </div>
      {confirm === 'delete' && (
        <Modal title="Delete cloud data" onClose={() => !busy && setConfirm(null)}>
          <p className="set-text">
            This removes all of your encrypted rows and the wrapped key from Supabase. Other devices will stop syncing. Your data on this and other
            devices stays where it is. Your Supabase account itself is not deleted (do that in the Supabase dashboard if you want).
          </p>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); if (typed === 'DELETE') void run(async () => { await sync.deleteCloudData(); setConfirm(null); done() }) }}>
            <Field label="Type DELETE to confirm">
              <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" autoCapitalize="characters" />
            </Field>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-danger" disabled={typed !== 'DELETE' || busy}>{busy ? 'Deleting…' : 'Delete cloud data'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
