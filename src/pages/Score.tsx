// Scoreboard (/score): your life as a season, measured against your own history. Standing, records, ghost, up next, highlights.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageHeader, PageSkeleton } from '../components/ui'
import { useBadges } from '../features/badges/useBadges'
import { useNextTrophies } from '../features/you/useNextTrophies'
import { loadScoreSnapshot } from '../features/score/useScore'
import { computeGhost, computeRecords, computeStanding, deriveUpNext } from '../features/score/model'
import { deriveHighlights } from '../features/score/highlights'
import { GhostCard, RecordsSection, Reel, StandingCard, UpNextCard } from '../features/score/ScoreParts'
import '../features/score/score.css'

export default function Score() {
  // null = the read failed; undefined = still loading.
  const snap = useLiveQuery(async () => { try { return await loadScoreSnapshot() } catch { return null } }, [])
  const badges = useBadges()
  const trophies = useNextTrophies(10)

  const view = useMemo(() => {
    if (!snap) return null
    const records = computeRecords(snap)
    return { standing: computeStanding(snap), records, ghost: computeGhost(snap), highlights: deriveHighlights(snap) }
  }, [snap])
  const upNext = useMemo(() => (view ? deriveUpNext(view.records, badges ?? [], trophies ?? []) : []), [view, badges, trophies])

  return (
    <>
      <PageHeader title="Scoreboard" sub="Your season, measured against your own past. No one else on the table." />
      {snap === undefined ? <PageSkeleton rows={4} /> : snap === null || !view ? (
        <section className="card sc-card" role="alert" data-testid="score-error">
          <p className="sc-big sc-big-quiet">The scoreboard could not load.</p>
          <p className="sc-sub">Your data is fine and still on this device. Reload the page to try again.</p>
          <div><button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button></div>
        </section>
      ) : (
        <div className="sc-stack">
          <StandingCard st={view.standing} />
          <div className="sc-pair">
            <GhostCard {...view.ghost} />
            <UpNextCard items={upNext} />
          </div>
          <RecordsSection records={view.records} />
          <Reel items={view.highlights} />
        </div>
      )}
    </>
  )
}
