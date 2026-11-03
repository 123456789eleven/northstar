// Mind hub (/mind): Journal and Learning side by side, with the Mind skill level when the game layer is on.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { formatDate, startOfWeek, today } from '../lib/dates'
import { PageHeader, Progress } from '../components/ui'
import { usePlayerState } from '../features/game/ui/playerContext'
import { LevelBadge } from '../features/game/ui/Ring'
import { XpBar } from '../features/game/ui/Meters'
import { HubCard } from '../features/hubs/HubCard'
import '../features/hubs/hubs.css'

export default function MindHub() {
  const d = today()
  const wk = startOfWeek(d)
  const p = usePlayerState()
  const mind = p.skills.find((s) => s.id === 'mind')!
  const entries = useLiveQuery(() => db.journal.where('date').aboveOrEqual(wk).toArray(), [wk])
  const last = useLiveQuery(() => db.journal.orderBy('date').last(), [])
  const items = useLiveQuery(() => db.learning.where('status').equals('active').toArray(), [])
  const sessions = useLiveQuery(() => db.studySessions.where('date').aboveOrEqual(wk).toArray(), [wk])
  const minutes = (sessions ?? []).reduce((a, s) => a + (s.minutes || 0), 0)
  const wroteToday = last?.date === d
  return (
    <>
      <PageHeader title="Mind" sub="Writing and learning: what you think, and what you are getting better at." />
      {!p.calm && (
        <div className="card hub-section hub-meter">
          <LevelBadge level={mind.level} progress={mind.xpForNext ? mind.xpIntoLevel / mind.xpForNext : 0} size={44} tone="mind" label={`Mind level ${mind.level}`} />
          <XpBar info={mind} label={`Mind level ${mind.level}`} />
        </div>
      )}
      <div className="hub-grid">
        <HubCard
          to="/journal" icon="journal" title="Journal"
          sub={wroteToday ? 'Written today' : last ? `Last entry ${formatDate(last.date, { month: 'short', day: 'numeric' })}` : 'No entries yet'}
          stat={entries ? <><span className="mono">{entries.length}</span><span className="hub-card-sub"> this week</span></> : undefined}
        >
          <span className="hub-empty">{wroteToday ? 'Add a thought any time: type journal: and a line in capture.' : 'Write a line for today. One sentence counts.'}</span>
        </HubCard>
        <HubCard to="/learning" icon="learning" title="Learning" sub={`${minutes} min studied this week`} stat={items ? items.length : undefined}>
          {items && items.length ? (
            <span className="hub-list">
              {items.slice(0, 3).map((i) => (
                <span key={i.id} className="hub-li hub-li-goal">
                  <span className="row-between"><span className="hub-li-label">{i.title}</span><span className="hub-li-meta">{i.progress}%</span></span>
                  <Progress value={i.progress} label={`${i.title} progress`} />
                </span>
              ))}
            </span>
          ) : <span className="hub-empty">Nothing in progress. Add a course or a book on Learning.</span>}
        </HubCard>
      </div>
    </>
  )
}
