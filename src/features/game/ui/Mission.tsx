// Plan surfaces built on usePlayer(): the Today plan board and the phone plan pill (the old desktop rail now lives in Home's Today tab).
import { Link } from 'react-router-dom'
import { Ring } from './Ring'
import { WeekDots } from './Meters'
import { QuestCard } from './QuestCard'
import { usePlayerState } from './playerContext'
import { useEngineOnMount } from './engineGate'

/** Top of Today: the day's plan. Items tick themselves off from real logs; a coach line names the next one. */
export function MissionBoard() {
  const p = usePlayerState()
  useEngineOnMount()
  if (p.calm) return null
  if (p.loading) return <div className="card mission mission-skel skel-pulse" aria-hidden />
  const total = p.quests.length
  const left = total - p.questsDone
  const next = p.quests.find((q) => !q.done)
  return (
    <section className={`card mission ${p.cleared ? 'is-cleared' : ''}`} aria-labelledby="mission-h" data-spec>
      <header className="mission-head">
        <Ring value={total ? p.questsDone / total : 0} size={64} stroke={5} tone={p.cleared ? 'reward' : undefined} label={`${p.questsDone} of ${total} plan items done`} className="mission-ring">
          <span className="mission-count"><b className="mono">{p.questsDone}</b><span>/{total}</span></span>
        </Ring>
        <div className="mission-text">
          <h2 className="mission-title" id="mission-h">{p.cleared ? 'Plan done' : "Today's plan"}</h2>
          <p className="mission-sub">
            {total === 0
              ? 'The plan fills from your goals and routines. Add a goal to start.'
              : p.cleared
                ? 'Everything planned is done. Anything else today is extra.'
                : `${left} left. Next: ${next?.title ?? 'nothing'}.`}
          </p>
        </div>
        <div className="mission-meta">
          <WeekDots streak={p.streak} />
        </div>
      </header>
      {total > 0 ? (
        <div className="mission-grid">
          {p.quests.map((q) => <QuestCard key={q.id} quest={q} />)}
        </div>
      ) : (
        <div className="mission-empty"><Link className="btn btn-sm" to="/goals">Set a goal</Link><Link className="btn btn-ghost btn-sm" to="/habits">Add a routine</Link></div>
      )}
    </section>
  )
}

/** Phone top bar: today's plan as a small ring and count. */
export function PlayerStrip() {
  const p = usePlayerState()
  if (p.calm || p.loading) return null
  const total = p.quests.length
  return (
    <Link to="/today" className="pstrip">
      <Ring value={total ? p.questsDone / total : 0} size={26} stroke={3} tone={p.cleared ? 'reward' : undefined} />
      <span className="pstrip-streak mono">{p.questsDone}/{total}</span>
      <span className="sr-only"> plan items done today</span>
    </Link>
  )
}
