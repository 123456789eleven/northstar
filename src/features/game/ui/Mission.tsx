// Plan surfaces built on usePlayer(): the Today plan board, the desktop rail and the phone plan pill.
import { Link, useLocation } from 'react-router-dom'
import { Ring } from './Ring'
import { WeekDots } from './Meters'
import { seasonOf } from '../../you/season'
import { today } from '../../../lib/dates'
import { QuestCard } from './QuestCard'
import { usePlayerState } from './playerContext'
import { useEngineOnMount } from './engineGate'
import type { PlayerState } from '../types'

const streakLine = (p: PlayerState) =>
  `${p.streak.daysThisWeek} of ${p.streak.target} days this week${p.streak.restTokens ? ` · ${p.streak.restTokens} grace ${p.streak.restTokens === 1 ? 'day' : 'days'}` : ''}${p.streak.weeksInRow > 0 ? ` · ${p.streak.weeksInRow}‑week run` : ''}`

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

/** Desktop right rail (>= 1280px): the season, today's plan (not on Today, where the board shows it), the week, recent activity. */
export function MissionRail() {
  const p = usePlayerState()
  const { pathname } = useLocation()
  if (p.calm) return null
  const onToday = pathname === '/'
  if (!onToday) return null // the rail belongs to Today; other pages keep the room
  const season = seasonOf(today())
  return (
    <aside className="mission-rail" aria-label="Plan and week">
      <div className="mr-inner">
        <Link to="/review" className="mr-player">
          <div className="mr-player-text">
            <span className="mr-kicker">Season</span>
            <span className="mr-season">{season.name}</span>
            <span className="mr-note" style={{ margin: 0 }}>{season.daysLeft === 0 ? 'Last day' : `${season.daysLeft} days left`}</span>
          </div>
        </Link>
        <section className="mr-sec" aria-labelledby="mr-w">
          <h2 className="mr-head" id="mr-w"><span>This week</span></h2>
          <WeekDots streak={p.streak} />
          <p className="mr-note">{streakLine(p)}</p>
        </section>
        <section className="mr-sec" aria-labelledby="mr-x">
          <h2 className="mr-head" id="mr-x"><span>Recent</span></h2>
          {p.recent.length ? (
            <ul className="mr-recent">
              {p.recent.slice(0, 5).map((g) => (
                <li key={g.id}><span className="mr-why">{g.reason.replace(/\s*\(\+\d+\)$/, '')}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mr-empty">Log a weigh-in, a win or a journal line and it shows here.</p>
          )}
          <Link className="mr-link" to="/settings#game">How progress is counted</Link>
        </section>
      </div>
    </aside>
  )
}

/** Phone top bar: today's plan as a small ring and count. */
export function PlayerStrip() {
  const p = usePlayerState()
  if (p.calm || p.loading) return null
  const total = p.quests.length
  return (
    <Link to="/" className="pstrip">
      <Ring value={total ? p.questsDone / total : 0} size={26} stroke={3} tone={p.cleared ? 'reward' : undefined} />
      <span className="pstrip-streak mono">{p.questsDone}/{total}</span>
      <span className="sr-only"> plan items done today</span>
    </Link>
  )
}
