// You hub (/you): profile summary, season line, consistency, backup status and links to Milestones, Season, Intel, Settings, Data and Ontology.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../db'
import { useNow } from '../components/useNow'
import { PageHeader, Progress, Skeleton } from '../components/ui'
import { today } from '../lib/dates'
import { usePlayerState } from '../features/game/ui/playerContext'
import { WeekDots } from '../features/game/ui/Meters'
import { HubCard } from '../features/hubs/HubCard'
import { seasonOf } from '../features/you/season'
import { NextTrophyRow } from '../features/history/MilestoneShelf'
import { ExportEncryptedModal } from '../features/settings/BackupModals'
import { BACKUP_LAST_ENCRYPTED_KEY, BACKUP_LAST_KEY, BACKUP_REMIND_DAYS, getReminderDays } from '../lib/backup'
import '../features/hubs/hubs.css'
import '../features/you/you.css'

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
  const season = seasonOf(today())
  const name = useLiveQuery(() => getSetting<string>('profile.name', ''), [])
  const milestones = useLiveQuery(() => db.events.filter((e) => e.milestone).count(), [])
  const reviews = useLiveQuery(() => db.reviews.count(), [])
  return (
    <>
      <PageHeader title="You" sub="Your season, your consistency, and how Northstar runs on this device." />
      <div className="you-top">
        <section className="card you-profile" aria-label="Profile summary" data-spec>
          <div className="you-who">
            <span className="you-name">{name === undefined ? '' : name || 'You'}</span>
            <span className="you-season">{season.name} · {season.daysLeft === 0 ? 'last day' : `${season.daysLeft} ${season.daysLeft === 1 ? 'day' : 'days'} left`}</span>
          </div>
          <Progress value={season.elapsed * 100} label={`${season.name}: ${Math.round(season.elapsed * 100)}% elapsed`} />
        </section>
        <section className="card you-star" aria-labelledby="you-cons-h">
          <h2 id="you-cons-h" className="you-section-h">Consistency</h2>
          {p.loading ? <Skeleton lines={2} label="Loading consistency" /> : (
            <>
              <div className="you-weeks"><b>{p.streak.daysThisWeek}</b>of {p.streak.target} days this week{p.streak.weeksInRow > 0 ? ` · ${p.streak.weeksInRow}-week run` : ''}</div>
              <WeekDots streak={p.streak} />
              <p className="you-life small muted">Lifetime activity <span className="mono">{p.xp.toLocaleString()}</span></p>
            </>
          )}
        </section>
      </div>
      <div className="you-mid">
        <section className="card" aria-labelledby="you-next-h">
          <h2 id="you-next-h" className="you-section-h">Next milestones</h2>
          <NextTrophyRow max={3} className="tr-next-stack" />
        </section>
        <BackupStatus />
      </div>
      <div className="hub-grid">
        <HubCard to="/history" icon="history" title="Milestones" sub="Your logbook of what you finished" stat={milestones} />
        <HubCard to="/review" icon="review" title="Season" sub={`${season.name} · weekly recaps`} stat={reviews} />
        <HubCard to="/ops" icon="command" title="Intel" sub="Suggestions and briefings from your data" />
        <HubCard to="/interview?full=1" icon="user" title="Interview" sub="The full set of questions, any time" />
        <HubCard to="/settings" icon="settings" title="Settings" sub="Progress, sync, backup and preferences" />
        <HubCard to="/data" icon="data" title="Data" sub="Import, export and what is stored here" />
        <HubCard to="/ontology" icon="ontology" title="Ontology" sub="Every object type and how they link" />
      </div>
    </>
  )
}
