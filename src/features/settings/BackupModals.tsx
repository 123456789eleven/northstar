// Passphrase dialogs for encrypted backups. The passphrase lives only in component state and is cleared on close.
import { useState } from 'react'
import { Field, Modal } from '../../components/ui'
import { ENC_MIN_PASSPHRASE, BackupCryptoError, exportEncryptedBackup, openEncryptedBackupText, passphraseHint } from '../../lib/encryptedBackup'
import type { ParsedBackup } from '../../lib/backup'

export function ExportEncryptedModal({ onClose, onDone }: { onClose: () => void; onDone: (rows: number) => void }) {
  const [pass, setPass] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hint = passphraseHint(pass)
  const mismatch = again.length > 0 && again !== pass
  const ok = pass.length >= ENC_MIN_PASSPHRASE && pass === again

  async function go() {
    if (!ok) return
    setBusy(true); setError('')
    try {
      const data = await exportEncryptedBackup(pass)
      onDone(Object.values(data.tables).reduce((n, r) => n + r.length, 0))
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Export encrypted backup" onClose={() => !busy && onClose()}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void go() }}>
        <p className="set-text">
          The file is encrypted on this device with your passphrase before it is saved. <strong>If you lose this passphrase the backup cannot be recovered. Northstar cannot reset it.</strong>
        </p>
        <Field label="Passphrase" hint={pass ? hint.text : `At least ${ENC_MIN_PASSPHRASE} characters.`}>
          <input className="input" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Confirm passphrase" error={mismatch ? 'The two passphrases do not match.' : undefined}>
          <input className="input" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} disabled={busy} />
        </Field>
        {error && <p className="set-error" role="alert">{error}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!ok || busy}>{busy ? 'Encrypting…' : 'Encrypt and download'}</button>
        </div>
      </form>
    </Modal>
  )
}

export function UnlockModal({ text, onClose, onOpened }: { text: string; onClose: () => void; onOpened: (p: ParsedBackup) => void }) {
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function go() {
    setBusy(true); setError('')
    try {
      onOpened(await openEncryptedBackupText(text, pass))
    } catch (e) {
      setError(e instanceof BackupCryptoError || e instanceof Error ? e.message : 'Could not open that file.')
      setBusy(false)
    }
  }

  return (
    <Modal title="Unlock encrypted backup" onClose={() => !busy && onClose()}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); void go() }}>
        <p className="set-text">This file is encrypted. Enter the passphrase you used when you exported it. Nothing leaves this device.</p>
        <Field label="Passphrase" error={error || undefined}>
          <input className="input" type="password" autoComplete="current-password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} disabled={busy} />
        </Field>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!pass || busy}>{busy ? 'Unlocking…' : 'Unlock'}</button>
        </div>
      </form>
    </Modal>
  )
}
