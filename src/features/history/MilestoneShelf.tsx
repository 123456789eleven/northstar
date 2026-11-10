// The top of Milestones: the latest milestones as a dated logbook list (gold mark, title, area, date), then the plain
// targets still ahead. No rarity words, no "New" tags. Gold appears only on the mark.
import { useState } from 'react'
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

export function MilestoneShelf() {
  const all = useLiveQuery(() => db.events.orderBy('at').reverse().filter((e) => e.milestone).toArray(), [])
  const [shown, setShown] = useState(PAGE)
  if (!all) return <section className="card tr-shelf"><Skeleton rows={3} label="Loading milestones" /></section>
  return (
    <section className="card tr-shelf sp-flat" aria-labelledby="tr-shelf-h">
      <div className="card-title"><h2 id="tr-shelf-h" className="tr-h">Latest milestones</h2><span className="sp-figure"><b className="mono">{all.length}</b> {all.length === 1 ? 'milestone' : 'milestones'}</span></div>
      {all.length === 0 ? (
        <p className="small muted tr-empty">None yet. Finished goals, completed courses and anything you add with Milestone switched on are logged here, with the date.</p>
      ) : (
        <ol className="ms-log" aria-label="Milestones, newest first">
          {all.slice(0, shown).map((e: LifeEvent) => (
            <li key={e.id} className="ms-row" data-testid="milestone-row">
              <span className="ms-mark" aria-hidden />
              <span className="ms-title">{e.title}</span>
              <span className="ms-area">{AREA_LABEL[e.area] ?? e.area}</span>
              <span className="ms-date">{formatDate(dayOf(e))}</span>
            </li>
          ))}
        </ol>
      )}
      {all.length > shown && <button type="button" className="btn btn-ghost btn-sm ms-more" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, all.length - shown)} more</button>}
      <div className="tr-next-wrap">
        <div className="tr-sub">Next milestones</div>
        <NextTrophyRow />
      </div>
    </section>
  )
}
