// The trophy shelf above the timeline: milestone events as cards, then the next trophies you can still reach.
// Rarity is a word (Common / Uncommon / Rare), gold appears only on the trophy mark, Calm mode drops the game extras.
import { useMemo } from 'react'
import { useNow } from '../../components/useNow'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type LifeEvent } from '../../db'
import { Icon, type IconName } from '../../components/Icons'
import ModuleTile from '../../components/ModuleTile'
import { Skeleton } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { usePlayerState } from '../game/ui/playerContext'
import { isNewMoment, kindCounts, rarity } from '../you/trophies'
import { useNextTrophies } from '../you/useNextTrophies'
import { dayOf } from './group'
import '../you/you.css'

const AREA_ICON: Record<string, IconName> = {
  career: 'career', health: 'body', finance: 'finance', learning: 'learning', relationships: 'people', personal: 'user',
  tasks: 'tasks', food: 'food', body: 'body',
}

export function NextTrophyRow({ max = 5, className = '' }: { max?: number; className?: string }) {
  const next = useNextTrophies(max)
  if (!next || next.length === 0) return null
  return (
    <ul className={`tr-next ${className}`} aria-label="Next trophies" tabIndex={0}>
      {next.map((t) => (
        <li key={t.id} className="tr-next-card">
          <Link to={t.href} className="tr-next-link">
            <span className="tr-lock" aria-hidden><Icon name="trophy" size={14} /></span>
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

export function TrophyShelf() {
  const calm = usePlayerState().calm
  const all = useLiveQuery(() => db.events.orderBy('at').reverse().filter((e) => e.milestone).toArray(), [])
  const counts = useMemo(() => kindCounts(all ?? []), [all])
  const now = useNow()
  if (!all) return <section className="card tr-shelf"><Skeleton rows={3} label="Loading trophies" /></section>
  const shown = all.slice(0, 12)
  return (
    <section className="card tr-shelf" aria-labelledby="tr-shelf-h">
      <div className="card-title"><h2 id="tr-shelf-h" className="tr-h">{calm ? 'Milestones' : 'Trophy shelf'}</h2><span className="small faint">{all.length} {all.length === 1 ? 'milestone' : 'milestones'}</span></div>
      {shown.length === 0 ? (
        <p className="small muted tr-empty">Milestones collect here: finished goals, completed courses, streaks, and anything you add with Milestone switched on.</p>
      ) : (
        <ul className="tr-grid" aria-label="Trophies" tabIndex={0}>
          {shown.map((e: LifeEvent) => {
            const r = rarity(counts.get(e.kind) ?? 1)
            const isNew = !calm && isNewMoment(e, all, now)
            return (
              <li key={e.id} className="tr-card" data-testid="trophy-card">
                <span className="tr-card-top">
                  <ModuleTile icon={AREA_ICON[e.area] ?? 'trophy'} />
                  {!calm && <span className="tr-mark" aria-hidden><Icon name="trophy" size={14} /></span>}
                </span>
                <span className="tr-card-title">{e.title}</span>
                <span className="tr-card-meta">
                  <span className="tr-date">{formatDate(dayOf(e))}</span>
                  {!calm && <span className={`tr-rarity is-${r.toLowerCase()}`}>{r}</span>}
                  {isNew && <span className="tr-new">New</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {!calm && (
        <div className="tr-next-wrap">
          <div className="tr-sub">Next trophies</div>
          <NextTrophyRow />
        </div>
      )}
    </section>
  )
}
