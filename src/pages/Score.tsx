// Home base, Scoreboard floor: your standing (hero), then records, the ghost and the highlights reel. Up next and the full
// record list sit behind More. Everything is measured against your own past.
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { PageSkeleton } from '../components/ui'
import { useBadges } from '../features/badges/useBadges'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { useNextTrophies } from '../features/you/useNextTrophies'
import { loadScoreSnapshot } from '../features/score/useScore'
import { computeGhost, computeRecords, computeStanding, deriveUpNext } from '../features/score/model'
import { deriveHighlights } from '../features/score/highlights'
import { GhostCard, RecordsList, Reel, StandingCard, UpNextList } from '../features/score/ScoreParts'
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

  if (snap === undefined) return <PageSkeleton rows={4} />
  if (snap === null || !view) {
    return (
      <section className="card sc-card" role="alert" data-testid="score-error">
        <h1 className="sc-big sc-big-quiet">The scoreboard could not load.</h1>
        <p className="sc-sub">Your data is fine and still on this device. Reload to try again.</p>
        <div><button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button></div>
      </section>
    )
  }
  return (
    <FloorView
      label="Scoreboard"
      className="sc-floor"
      hero={<StandingCard st={view.standing} next={upNext[0]} />}
      support={[
        <FloorCard key="rec" title="Records"><RecordsList records={view.records} limit={3} /></FloorCard>,
        <GhostCard key="ghost" {...view.ghost} />,
        <Reel key="reel" items={view.highlights} />,
      ]}
      more={
        <FloorMore
          floor="Scoreboard"
          items={[
            { id: 'next', label: 'Up next', value: upNext.length || undefined, panel: <UpNextList items={upNext} /> },
            { id: 'records', label: 'All records', value: view.records.length || undefined, panel: <RecordsList records={view.records} /> },
          ]}
        />
      }
    />
  )
}
