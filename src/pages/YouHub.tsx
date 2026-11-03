// You hub (/you): your player card, then Trophies, Season, Intel, Settings, Data and Ontology.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { PageHeader } from '../components/ui'
import { usePlayerState } from '../features/game/ui/playerContext'
import { LevelBadge } from '../features/game/ui/Ring'
import { WeekDots, XpBar } from '../features/game/ui/Meters'
import { HubCard } from '../features/hubs/HubCard'
import '../features/hubs/hubs.css'

const quarter = () => {
  const n = new Date()
  return `Q${Math.floor(n.getMonth() / 3) + 1} ${n.getFullYear()}`
}

export default function YouHub() {
  const p = usePlayerState()
  const trophies = useLiveQuery(() => db.events.filter((e) => e.milestone).count(), [])
  const reviews = useLiveQuery(() => db.reviews.count(), [])
  return (
    <>
      <PageHeader title="You" sub="Your progress, your season, and how Northstar runs on this device." />
      {!p.calm && (
        <div className="card hub-section hub-player">
          <LevelBadge level={p.level} progress={p.xpForNext ? p.xpIntoLevel / p.xpForNext : 0} size={56} tone="reward" label={`Level ${p.level}`} />
          <XpBar info={p} label={`Level ${p.level} · ${p.xp} XP total`} />
          <div className="hub-player-week">
            <WeekDots streak={p.streak} />
            <span className="hub-player-note">{p.streak.daysThisWeek} of {p.streak.target} days this week{p.streak.weeksInRow ? ` · ${p.streak.weeksInRow} weeks in a row` : ''}</span>
          </div>
        </div>
      )}
      <div className="hub-grid">
        <HubCard to="/history" icon="trophy" title="Trophies" sub="Milestones and your timeline" stat={trophies} />
        <HubCard to="/review" icon="review" title="Season" sub={`${quarter()} · weekly reviews`} stat={reviews} />
        <HubCard to="/ops" icon="command" title="Intel" sub="Suggestions and briefings from your data" />
        <HubCard to="/settings" icon="settings" title="Settings" sub="Sync, backup, preferences and the game" />
        <HubCard to="/data" icon="data" title="Data" sub="Import, export and what is stored here" />
        <HubCard to="/ontology" icon="ontology" title="Ontology" sub="Every object type and how they link" />
      </div>
    </>
  )
}
