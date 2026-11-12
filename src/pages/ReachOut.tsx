// Park, Reach out floor: who is waiting (Contacted slides the row out and the circle ticks warmer), then the friend feed,
// the form guide and your records. Birthdays and how warmth is scored sit behind More.
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Card, Empty, PageSkeleton } from '../components/ui'
import { daysBetween, formatDate, today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { nextBirthday } from '../features/people/people'
import { PersonDetail } from '../features/people/PersonModals'
import { useQuickLog } from '../features/people/LogPanel'
import { FriendCard } from '../features/people/FriendBits'
import { FormGuide, RecordsStrip } from '../features/people/CircleStats'
import { ReachRow, WarmthHead } from '../features/people/ReachParts'
import { circleWarmth, formGuide, personWarmth, records } from '../features/people/warmth'
import { reachSoon } from '../features/people/tree'
import '../features/people/people.css'
import '../features/people/friends.css'
import '../features/people/reach.css'

const FEED_FIRST = 4
const FEED_MAX = 30

export default function ReachOut() {
  const data = useLiveQuery(async () => ({ people: await db.people.toArray(), interactions: await db.interactions.toArray() }), [])
  const people = data?.people
  const interactions = data?.interactions
  const [openId, setOpenId] = useState<number | null>(null)
  const [feedAll, setFeedAll] = useState(false)
  const now = today()
  const quickLog = useQuickLog()

  useFocusTarget({
    ready: people !== undefined,
    exists: (id) => (people ?? []).some((p) => String(p.id) === id),
    reveal: (id) => setOpenId(Number(id)),
  })

  const warmth = useMemo(() => circleWarmth(people ?? [], now), [people, now])
  const form = useMemo(() => formGuide(people ?? [], interactions ?? [], now), [people, interactions, now])
  const rec = useMemo(() => records(people ?? [], interactions ?? [], now), [people, interactions, now])
  const feed = useMemo(() => (people ?? []).filter((p) => p.cadenceDays > 0).sort((a, b) => (personWarmth(a, now) ?? 1) - (personWarmth(b, now) ?? 1) || a.name.localeCompare(b.name)), [people, now])
  const soon = useMemo(() => reachSoon(people ?? [], now, 5), [people, now])
  const birthdays = useMemo(
    () => (people ?? [])
      .flatMap((p) => {
        const next = p.birthday ? nextBirthday(p.birthday, now) : null
        return next && daysBetween(now, next) <= 30 ? [{ p, next, inDays: daysBetween(now, next) }] : []
      })
      .sort((a, b) => a.inDays - b.inDays),
    [people, now],
  )

  if (!people || !interactions) return <PageSkeleton strip={false} rows={5} />

  const hasRec = !!(rec.warmStretch || rec.busiestMonth || rec.oldestReconnect)
  const hero = people.length === 0 ? (
    <Card className="floor-hero">
      <Empty title="Nobody to reach yet" action={<Link className="btn btn-primary" to="/people">Add a person</Link>}>
        Add someone on the Tree and pick how often you want to check in.
      </Empty>
    </Card>
  ) : (
    <section className="card floor-hero reach-hero" aria-labelledby="reach-h">
      {warmth.pct !== null && <header className="reach-head"><WarmthHead warmth={warmth} /></header>}
      <h2 className="reach-sub" id="reach-h">{soon.length ? 'Waiting to hear from you' : 'Nobody is waiting'}</h2>
      {soon.length > 0 ? (
        <ul className="reach-list">
          {soon.map(({ p }, i) => (
            <ReachRow key={p.id} p={p} now={now} first={i === 0} onOpen={() => setOpenId(p.id!)} onContacted={() => quickLog(p)} />
          ))}
        </ul>
      ) : (
        <p className="reach-clear">{warmth.tracked === 0 ? 'Give someone a rhythm on the Tree and they show up here.' : 'Everyone is inside their rhythm. Nicely held.'}</p>
      )}
    </section>
  )

  const feedCard = feed.length > 0 && (
    <FloorCard
      key="feed"
      title="Friend feed"
      label="Friend feed"
      action={feed.length > FEED_FIRST ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFeedAll(!feedAll)}>{feedAll ? 'Show fewer' : `Show all ${Math.min(feed.length, FEED_MAX)}`}</button> : undefined}
    >
      <div className="ppl-feed-list">
        {feed.slice(0, feedAll ? FEED_MAX : FEED_FIRST).map((p) => <FriendCard key={p.id} p={p} now={now} others={people} onOpen={() => setOpenId(p.id!)} />)}
      </div>
    </FloorCard>
  )
  const formCard = form.length > 0 && <FloorCard key="form" title="Form" label="Form guide" className="reach-form"><FormGuide form={form} /></FloorCard>
  const recCard = hasRec && <FloorCard key="rec" title="Records" label="Circle records" className="reach-rec"><RecordsStrip rec={rec} /></FloorCard>

  const more = (
    <FloorMore
      floor="Reach out"
      items={[
        {
          id: 'birthdays',
          label: 'Birthdays',
          value: birthdays.length || undefined,
          panel: birthdays.length ? (
            <ul className="reach-bdays" aria-label="Birthdays in the next 30 days">
              {birthdays.map(({ p, next, inDays }) => (
                <li key={p.id} className="ppl-strip-item">
                  <button type="button" className="ppl-link" onClick={() => setOpenId(p.id!)}>{p.name}</button>
                  <span className={inDays <= 3 ? 'ppl-status is-due' : 'ppl-status'}>{inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `${formatDate(next)} · ${inDays} days`}</span>
                </li>
              ))}
            </ul>
          ) : <p className="muted small">No birthdays in the next 30 days.</p>,
        },
        {
          id: 'scoring',
          label: 'How warmth works',
          panel: <p className="muted small">Each person counts 100% the day you speak, 50% when their check-in comes due, and 0% at twice that gap. The circle is the average of everyone with a rhythm.</p>,
        },
        { id: 'tree', label: 'Open the tree', to: '/people' },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Reach out" className="park-floor" hero={hero} support={[feedCard, formCard, recCard]} more={more} />
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
