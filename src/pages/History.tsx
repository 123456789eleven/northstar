// Home base, Milestones floor: the badge shelf (hero), the dated milestone list and what is next. The full timeline,
// this day in past years and Add entry sit behind More. A `?focus=<event id>` deep link opens the timeline in place.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import { Skeleton } from '../components/ui'
import { AddEntry, OnThisDay, Timeline } from '../features/history/history'
import { MilestoneList, NextTrophyRow } from '../features/history/MilestoneShelf'
import { BadgeShelf } from '../features/badges/BadgesView'
import { BadgeWatcher } from '../features/badges/BadgeWatcher'
import { useBadges } from '../features/badges/useBadges'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import '../features/history/history.css'
import '../features/badges/badges.css'
import '../features/space/space.css'

export default function History() {
  const [adding, setAdding] = useState(false)
  const [revealAt, setRevealAt] = useState<string>()
  const badges = useBadges()
  const count = useLiveQuery(() => db.events.filter((e) => e.milestone).count(), [])
  const focusId = useFocusParam().focus
  const focusEv = useLiveQuery(async () => (focusId ? ((await db.events.get(Number(focusId))) ?? null) : undefined), [focusId])
  useFocusTarget({
    ready: !focusId || focusEv !== undefined,
    exists: () => !!focusEv,
    reveal: () => setRevealAt(focusEv!.at),
  })
  const earned = badges?.filter((b) => b.earned).length ?? 0

  const hero = (
    <section className="card floor-hero bdg-hero" aria-label="Badge shelf">
      <div className="bdg-hero-head">
        <p className="bdg-count"><span className="bdg-count-n" data-testid="badge-count">{badges ? earned : ''}</span> {badges ? `of ${badges.length} badges` : ''}</p>
        <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}>Add entry</button>
      </div>
      {badges ? <BadgeShelf badges={badges} /> : <Skeleton rows={3} label="Loading badges" />}
    </section>
  )
  const deep = !!focusId || !!revealAt
  const support = deep
    ? [<FloorCard key="tl" title="Timeline"><Timeline onAdd={() => setAdding(true)} revealAt={revealAt} /></FloorCard>]
    : [
        <FloorCard key="latest" title="Latest milestones" action={<span className="sp-figure"><b className="mono">{count ?? 0}</b> logged</span>}><MilestoneList limit={5} /></FloorCard>,
        <FloorCard key="next" title="Next up"><NextTrophyRow max={3} className="tr-next-stack" /></FloorCard>,
      ]
  const more = (
    <FloorMore
      floor="Milestones"
      items={[
        ...(deep ? [] : [{ id: 'timeline', label: 'Full timeline', panel: <Timeline onAdd={() => setAdding(true)} /> }]),
        { id: 'past', label: 'This day', panel: <OnThisDay /> },
        { id: 'add', label: 'Add entry', onSelect: () => setAdding(true) },
      ]}
    />
  )
  return (
    <>
      <FloorView label="Milestones" className="bdg-floor" hero={hero} support={support} more={more} />
      <BadgeWatcher />
      {adding && <AddEntry onClose={() => setAdding(false)} />}
    </>
  )
}
