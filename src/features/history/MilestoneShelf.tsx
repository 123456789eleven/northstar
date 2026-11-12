// The top of Milestones: the latest milestones as a dated logbook list (gold mark, title, area, date), then the plain
// targets still ahead. No rarity words, no "New" tags. Gold appears only on the mark.
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LifeEvent } from '../../db'
import { AREA_LABEL, Skeleton } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { useNextTrophies } from '../you/useNextTrophies'
import { dayOf } from './group'
import '../you/you.css'

const PAGE = 8

export function NextTrophyRow({ max = 5, className = '' }: { max?: number; className?: string }) {
  const next = useNextTrophies(max)
  if (!next || next.length === 0) return null
  return (
    <ul className={`tr-next ${className}`} aria-label="Next milestones" tabIndex={0}>
      {next.map((t) => (
        <li key={t.id} className="tr-next-card">
          <Link to={t.href} className="tr-next-link">
            <span className="tr-next-body">
              <span className="tr-next-title">{t.title}</span>
              <span className="tr-next-hint">{t.hint}</span>
              <span className="tr-bar" role="presentation"><span style={{ transform: `scaleX(${Math.max(0.03, t.progress)})` }} /></span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function MilestoneList({ limit = PAGE }: { limit?: number }) {
  const all = useLiveQuery(() => db.events.orderBy('at').reverse().filter((e) => e.milestone).toArray(), [])
  if (!all) return <Skeleton rows={3} label="Loading milestones" />
  if (all.length === 0) return <p className="small muted tr-empty">None yet. Finish a goal or a course and it is dated here.</p>
  return (
    <ol className="ms-log" aria-label="Milestones, newest first">
      {all.slice(0, limit).map((e: LifeEvent) => (
        <li key={e.id} className="ms-row" data-testid="milestone-row">
          <span className="ms-mark" aria-hidden />
          <span className="ms-title">{e.title}</span>
          <span className="ms-area">{AREA_LABEL[e.area] ?? e.area}</span>
          <span className="ms-date">{formatDate(dayOf(e))}</span>
        </li>
      ))}
    </ol>
  )
}
