// Town hall, Today floor hero: the day's plan as a ring and a list that ticks itself off from real logs (QuestCard plays the
// aura), with the day's counts folded into one line. No separate KPI strip, no second plan card.
import { Link } from 'react-router-dom'
import { useNumberRoll } from '../../components/motion'
import { formatDate, today } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import { QuestCard } from '../game/ui/QuestCard'
import { WeekDots } from '../game/ui/Meters'
import { usePlayerState } from '../game/ui/playerContext'
import { useEngineOnMount } from '../game/ui/engineGate'

export interface DayCounts { open: number; overdue: number; doneToday: number; habitsLeft: number }

export function TodayHero({ counts }: { counts: DayCounts | null }) {
  const p = usePlayerState()
  useEngineOnMount()
  const total = p.quests.length
  const left = total - p.questsDone
  const next = p.quests.find((q) => !q.done)
  const shown = useNumberRoll(p.questsDone, 500)
  const showPlan = !p.calm && !p.loading
  return (
    <section className={`card floor-hero mission today-hero${p.cleared ? ' is-cleared' : ''}`} aria-labelledby="mission-h" data-spec>
      <header className="mission-head">
        {showPlan && (
          <Ring value={total ? p.questsDone / total : 0} size={72} stroke={6} tone={p.cleared ? 'reward' : undefined} label={`${p.questsDone} of ${total} plan items done`} className="mission-ring">
            <span className="mission-count"><b className="mono">{shown}</b><span>/{total}</span></span>
          </Ring>
        )}
        <div className="mission-text">
          <p className="today-date">{formatDate(today(), { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          <h2 className="mission-title" id="mission-h">{showPlan && p.cleared ? 'Plan done' : "Today's plan"}</h2>
          {showPlan && (
            <p className="mission-sub">
              {total === 0 ? 'Add a goal or a routine and the plan fills.' : p.cleared ? 'Everything planned is done. The rest is extra.' : `${left} left. Next: ${next?.title ?? 'nothing'}.`}
            </p>
          )}
        </div>
        {showPlan && <div className="mission-meta"><WeekDots streak={p.streak} /></div>}
      </header>
      {counts && (
        <ul className="today-counts" aria-label="Today in numbers">
          <li><b className="mono">{counts.open}</b> open</li>
          <li className={counts.overdue ? 'is-late' : ''}><b className="mono">{counts.overdue}</b> overdue</li>
          <li><b className="mono">{counts.doneToday}</b> done today</li>
          <li><b className="mono">{counts.habitsLeft}</b> habits left</li>
        </ul>
      )}
      {showPlan && total > 0 && <div className="mission-grid">{p.quests.map((q) => <QuestCard key={q.id} quest={q} />)}</div>}
      {showPlan && total === 0 && <div className="mission-empty"><Link className="btn btn-sm" to="/goals">Set a goal</Link><Link className="btn btn-ghost btn-sm" to="/habits">Add a routine</Link></div>}
    </section>
  )
}
