// You hub (/you): your player card, then Trophies, Season, Intel, Settings, Data and Ontology.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { useNow } from '../components/useNow'
import { PageHeader, Skeleton } from '../components/ui'
import { usePlayerState } from '../features/game/ui/playerContext'
import { LevelBadge } from '../features/game/ui/Ring'
import { WeekDots, XpBar } from '../features/game/ui/Meters'
import { HubCard } from '../features/hubs/HubCard'
import { Constellation } from '../features/game/ui/Constellation'
import { NextTrophyRow } from '../features/history/TrophyShelf'
import { ExportEncryptedModal } from '../features/settings/BackupModals'
import { BACKUP_LAST_ENCRYPTED_KEY, BACKUP_LAST_KEY, BACKUP_REMIND_DAYS, getReminderDays } from '../lib/backup'
import '../features/hubs/hubs.css'
import '../features/you/you.css'

const quarter = () => {
  const n = new Date()
  return `Q${Math.floor(n.getMonth() / 3) + 1} ${n.getFullYear()}`
}

const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function BackupStatus() {
  const info = useLiveQuery(async () => {
    const at = await getSetting<string | null>(BACKUP_LAST_KEY, null)
    const encrypted = await getSetting<boolean | null>(BACKUP_LAST_ENCRYPTED_KEY, null)
    return { at, encrypted, remind: await getReminderDays() }
  }, [])
  const now = useNow()
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState('')
  if (!info) return <section className="card you-backup"><Skeleton lines={2} label="Loading backup status" /></section>
  const age = info.at ? Math.floor((now.getTime() - new Date(info.at).getTime()) / 86_400_000) : null
  const overdue = (info.remind || 0) > 0 && (age === null || age > (info.remind || BACKUP_REMIND_DAYS))
  return (
    <section className="card you-backup" aria-labelledby="you-backup-h" data-testid="backup-status">
      <h2 id="you-backup-h" className="you-section-h">Backup status</h2>
      <div className="you-backup-row">
        <div>
          <div>{info.at ? `Last backup ${fmtWhen(info.at)}` : 'No backup yet'}</div>
          <div className="you-backup-note">
            {info.at ? (info.encrypted ? 'Encrypted with your passphrase.' : 'Not encrypted. Prefer an encrypted backup.') : 'Your data lives only on this device.'}
            {overdue && info.at ? ` ${age} days ago.` : ''}
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>Export encrypted backup</button>
      </div>
      {done && <p className="you-ok small" role="status" style={{ margin: 0 }}>{done}</p>}
      {open && <ExportEncryptedModal onClose={() => setOpen(false)} onDone={(n) => setDone(`Exported ${n.toLocaleString()} rows, encrypted.`)} />}
    </section>
  )
}

export default function YouHub() {
  const p = usePlayerState()
  const trophies = useLiveQuery(() => db.events.filter((e) => e.milestone).count(), [])
  const reviews = useLiveQuery(() => db.reviews.count(), [])
  return (
    <>
      <PageHeader title="You" sub="Your progress, your season, and how Northstar runs on this device." />
      {!p.calm ? (
        <div className="you-top">
          <section className="card you-profile" aria-label="Your profile">
            <div className="you-profile-row">
              <LevelBadge level={p.level} progress={p.xpForNext ? p.xpIntoLevel / p.xpForNext : 0} size={64} tone="reward" label={`Level ${p.level}`} />
              <div className="you-star">
                <XpBar info={p} label={`Level ${p.level} · ${p.xp} XP total`} />
                <div className="you-weeks"><b>{p.streak.weeksInRow}</b>{p.streak.weeksInRow === 1 ? 'week' : 'weeks'} in a row · {p.streak.daysThisWeek} of {p.streak.target} days this week</div>
              </div>
            </div>
            <WeekDots streak={p.streak} />
          </section>
          <section className="card you-star" aria-label="Constellation">
            <h2 className="you-section-h">Constellation</h2>
            <Constellation skills={p.skills} compact interactive={false} />
          </section>
        </div>
      ) : null}
      <div className="you-mid">
        {!p.calm && (
          <section className="card" aria-labelledby="you-next-h">
            <h2 id="you-next-h" className="you-section-h">Next trophies</h2>
            <NextTrophyRow max={3} className="tr-next-stack" />
          </section>
        )}
        <BackupStatus />
      </div>
      <div className="hub-grid">
        <HubCard to="/history" icon="trophy" title="Trophies" sub="Milestones and your timeline" stat={trophies} />
        <HubCard to="/review" icon="review" title="Season" sub={`${quarter()} · weekly recaps`} stat={reviews} />
        <HubCard to="/ops" icon="command" title="Intel" sub="Suggestions and briefings from your data" />
        <HubCard to="/settings" icon="settings" title="Settings" sub="Game, sync, backup and preferences" />
        <HubCard to="/data" icon="data" title="Data" sub="Import, export and what is stored here" />
        <HubCard to="/ontology" icon="ontology" title="Ontology" sub="Every object type and how they link" />
      </div>
    </>
  )
}
