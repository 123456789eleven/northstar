// Settings floor hero: where sync and backups stand, with the one action that matters (an encrypted backup).
import { useState } from 'react'
import { StatusStrip } from './Sections'
import { ExportEncryptedModal } from './BackupModals'

export default function SettingsHero() {
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  return (
    <>
    <section className="card floor-hero set-hero" aria-label="Backup status" data-testid="backup-status">
      <StatusStrip />
      <div className="set-hero-row">
        <button className="btn btn-primary" onClick={() => setOpen(true)}>Export encrypted backup</button>
        <span className="small muted" role="status">{done}</span>
      </div>
    </section>
    {/* Outside the hero card so the sheet is not stacked under the cards below it. */}
    {open && <ExportEncryptedModal onClose={() => setOpen(false)} onDone={(n) => setDone(`Exported ${n.toLocaleString()} rows, encrypted.`)} />}
    </>
  )
}
