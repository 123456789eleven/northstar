// Mission surfaces built on usePlayer(): the Today board, the desktop mission rail and the phone player strip.
// All three render nothing in Calm mode.
import { Link, useLocation } from 'react-router-dom'
import { useNumberRoll } from '../../../components/motion'
import { LevelBadge, Ring } from './Ring'
import { WeekDots, XpBar } from './Meters'
import { QuestCard } from './QuestCard'
import { usePlayerState } from './playerContext'
import type { PlayerState } from '../types'

const streakLine = (p: PlayerState) =>
  `${p.streak.daysThisWeek} of ${p.streak.target} active days${p.streak.restTokens ? ` · ${p.streak.restTokens} rest ${p.streak.restTokens === 1 ? 'token' : 'tokens'}` : ''}${p.streak.weeksInRow > 0 ? ` · ${p.streak.weeksInRow} ${p.streak.weeksInRow === 1 ? 'week' : 'weeks'} in a row` : ''}`

function TodayXp({ xp }: { xp: number }) {
  const n = useNumberRoll(xp)
  return <span className="xp-chip is-earned" aria-label={`${xp} XP earned today`}><span className="mono">+{n}</span> XP today</span>
}

/** Top of Today: progress ring for the day, quest cards, streak strip, Day cleared state. */
export function MissionBoard() {
  const p = usePlayerState()
  if (p.calm) return null
  if (p.loading) return <div className="card mission mission-skel skel-pulse" aria-hidden />
  const total = p.quests.length
  const left = total - p.questsDone
  return (
    <section className={`card mission ${p.cleared ? 'is-cleared' : ''}`} aria-labelledby="mission-h">
      <header className="mission-head">
        <Ring value={total ? p.questsDone / total : 0} size={56} stroke={4} tone={p.cleared ? 'reward' : undefined} label={`${p.questsDone} of ${total} quests done`} className="mission-ring">
          <span className="mission-count"><b className="mono">{p.questsDone}</b><span>/{total}</span></span>
        </Ring>
        <div className="mission-text">
          <h2 className="mission-title" id="mission-h">{p.cleared ? 'Day cleared' : "Today's missions"}</h2>
          <p className="mission-sub">
            {total === 0
              ? 'Missions come from your goals and routines. Add a goal to get your first ones.'
              : p.cleared
                ? 'Every quest is done. Anything else today is a bonus.'
                : `${left} to go. They complete themselves as you log.`}
          </p>
        </div>
        <div className="mission-meta">
          <TodayXp xp={p.todayXp} />
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

/** Desktop right rail (>= 1280px): player level, today's quests (not on Today, where the board shows them), week, recent XP. */
export function MissionRail() {
  const p = usePlayerState()
  const { pathname } = useLocation()
  if (p.calm) return null
  const onToday = pathname === '/'
  return (
    <aside className="mission-rail" aria-label="Mission">
      <div className="mr-inner">
        <Link to="/skills" className="mr-player">
          <LevelBadge level={p.level} progress={p.xpForNext ? p.xpIntoLevel / p.xpForNext : 0} size={48} tone="reward" label={`Level ${p.level}`} />
          <div className="mr-player-text">
            <span className="mr-kicker">Northstar level</span>
            <XpBar info={p} label={`Level ${p.level}`} />
          </div>
        </Link>
        {!onToday && (
          <section className="mr-sec" aria-labelledby="mr-q">
            <h2 className="mr-head" id="mr-q"><span>Today's quests</span><span className="mono muted">{p.questsDone}/{p.quests.length}</span></h2>
            {p.loading ? null : p.quests.length ? (
              <div className="mr-quests">{p.quests.map((q) => <QuestCard key={q.id} quest={q} compact />)}</div>
            ) : (
              <p className="mr-empty">No quests yet. <Link to="/goals">Set a goal</Link> to get some.</p>
            )}
            {p.cleared && <p className="mr-cleared">Day cleared</p>}
          </section>
        )}
        <section className="mr-sec" aria-labelledby="mr-w">
          <h2 className="mr-head" id="mr-w"><span>Weekly streak</span></h2>
          <WeekDots streak={p.streak} />
          <p className="mr-note">{streakLine(p)}</p>
        </section>
        <section className="mr-sec" aria-labelledby="mr-x">
          <h2 className="mr-head" id="mr-x"><span>Recent XP</span><span className="mono muted">+{p.todayXp} today</span></h2>
          {p.recent.length ? (
            <ul className="mr-recent">
              {p.recent.slice(0, 5).map((g) => (
                <li key={g.id}><span className="mr-why">{g.reason.replace(/\s*\(\+\d+\)$/, '')}</span><span className="mr-xp mono">+{g.xp}</span></li>
              ))}
            </ul>
          ) : (
            <p className="mr-empty">Log a weigh-in, a win or a journal line to earn your first XP.</p>
          )}
          <Link className="mr-link" to="/settings#game">Why do I earn XP?</Link>
        </section>
      </div>
    </aside>
  )
}

/** Phone top bar: level ring + XP + this week's active days. Opens Skills. */
export function PlayerStrip() {
  const p = usePlayerState()
  if (p.calm || p.loading) return null
  return (
    <Link to="/skills" className="pstrip">
      <LevelBadge level={p.level} progress={p.xpForNext ? p.xpIntoLevel / p.xpForNext : 0} size={28} tone="reward" />
      <span className="pstrip-xp"><XpBar info={p} compact /></span>
      <span className="pstrip-streak mono">{p.streak.daysThisWeek}/{p.streak.target}</span>
      <span className="sr-only"> active days this week. Open Skills</span>
    </Link>
  )
}
