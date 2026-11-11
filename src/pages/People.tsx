import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Person } from '../db'
import { Card, Empty, PageHeader, PageSkeleton, Tabs } from '../components/ui'
import { useFocusTarget } from '../lib/useFocusParam'
import { daysBetween, formatDate, today } from '../lib/dates'
import { nextBirthday, sortPeople } from '../features/people/people'
import { PersonDetail, PersonForm } from '../features/people/PersonModals'
import { LogPanel, useQuickLog } from '../features/people/LogPanel'
import { TreeView } from '../features/people/TreeView'
import { PersonRow } from '../features/people/PersonRow'
import { FriendCard } from '../features/people/FriendBits'
import { FormGuide, RecordsStrip, WarmthMeter } from '../features/people/CircleStats'
import { reachLine } from '../features/people/starter'
import { circleWarmth, formGuide, personWarmth, records } from '../features/people/warmth'
import { groupByRelation, reachSoon } from '../features/people/tree'
import '../features/people/people.css'
import '../features/people/tree.css'
import '../features/people/friends.css'

type View = 'tree' | 'list'
const VIEW_KEY = 'northstar.people.view'
const OPEN_KEY = 'northstar.people.tree.open'
const MAX_OTHERS = 60
const BIG_BRANCH = 12
const FEED_FIRST = 4
const FEED_MAX = 30

const readOverrides = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') } catch { return {} } }

export default function People() {
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'tree' } catch { return 'tree' } })
  const chooseView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }
  const [q, setQ] = useState('')
  const [reload, setReload] = useState(0)
  const data = useLiveQuery(async () => { try { return { people: await db.people.toArray(), interactions: await db.interactions.toArray() } } catch { return { error: true as const } } }, [reload])
  const people = data && 'people' in data ? data.people : undefined
  const interactions = data && 'interactions' in data ? data.interactions : undefined
  const failed = !!data && 'error' in data
  const [adding, setAdding] = useState<{ relation: string } | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [loggingId, setLoggingId] = useState<number | null>(null)
  const [feedAll, setFeedAll] = useState(false)
  const [overrides, setOverrides] = useState(readOverrides)
  const now = today()
  const quickLog = useQuickLog()

  useFocusTarget({
    ready: people !== undefined || failed,
    exists: (id) => (people ?? []).some((p) => String(p.id) === id),
    reveal: (id) => setOpenId(Number(id)),
  })

  const sorted = useMemo(() => (people ? sortPeople(people, now) : []), [people, now])
  const tracked = sorted.filter((x) => x.p.cadenceDays > 0)
  const others = sorted.filter((x) => !(x.p.cadenceDays > 0))
  const dueCount = tracked.filter((x) => x.s.overdue).length
  const warmth = useMemo(() => circleWarmth(people ?? [], now), [people, now])
  const form = useMemo(() => formGuide(people ?? [], interactions ?? [], now), [people, interactions, now])
  const rec = useMemo(() => records(people ?? [], interactions ?? [], now), [people, interactions, now])
  const feed = useMemo(() => (people ?? []).filter((p) => p.cadenceDays > 0).sort((a, b) => (personWarmth(a, now) ?? 1) - (personWarmth(b, now) ?? 1) || a.name.localeCompare(b.name)), [people, now])
  const soon = useMemo(() => reachSoon(people ?? [], now, 5), [people, now])
  const branches = useMemo(() => groupByRelation(people ?? []), [people])
  const collapsed = useMemo(() => {
    const big = (people?.length ?? 0) > 40
    return new Set(branches.filter((b) => (b.key in overrides ? !overrides[b.key] : big && b.people.length > BIG_BRANCH)).map((b) => b.key))
  }, [branches, overrides, people])
  const toggleBranch = (key: string) => {
    const next = { ...overrides, [key]: collapsed.has(key) }
    setOverrides(next)
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  const matchedOthers = others.filter((x) => x.p.name.toLowerCase().includes(q.trim().toLowerCase()))
  const shownOthers = matchedOthers.slice(0, MAX_OTHERS)
  const row = (p: Person) => (
    <PersonRow key={p.id} p={p} onOpen={() => setOpenId(p.id!)} onContacted={() => quickLog(p)} onDetails={() => setLoggingId(loggingId === p.id ? null : p.id!)}>
      {loggingId === p.id && <LogPanel person={p} onDone={() => setLoggingId(null)} />}
    </PersonRow>
  )

  const birthdays = useMemo(() => {
    return (people ?? [])
      .flatMap((p) => {
        const next = p.birthday ? nextBirthday(p.birthday, now) : null
        if (!next) return []
        const inDays = daysBetween(now, next)
        return inDays <= 30 ? [{ p, next, inDays }] : []
      })
      .sort((a, b) => a.inDays - b.inDays)
  }, [people, now])

  const sub = people === undefined ? '' : people.length === 0 ? 'The people you keep close are half of how things go well.' : dueCount ? `${dueCount} ${dueCount === 1 ? 'person is' : 'people are'} ready to hear from you` : 'Everyone is inside their rhythm. Nicely held.'

  return (
    <>
      <PageHeader title="People" sub={sub} actions={<button className="btn btn-primary" onClick={() => setAdding({ relation: '' })}>Add person</button>} />
      {failed ? (
        <Card>
          <Empty title="People could not load" action={<button className="btn" onClick={() => setReload((n) => n + 1)}>Try again</button>}>
            Your data is still on this device. Try again, and if it keeps happening export a backup from Settings.
          </Empty>
        </Card>
      ) : people === undefined ? (
        <PageSkeleton strip={false} rows={7} />
      ) : people.length === 0 ? (
        <Card>
          <Empty title="Your circle starts with one name" action={<button className="btn btn-primary" onClick={() => setAdding({ relation: '' })}>Add the first name</button>}>
            Add one person you want to stay close to and pick how often you will check in. They become the first leaf on your tree, and your circle starts warming up.
          </Empty>
        </Card>
      ) : (
        <div className="ppl-flow">
        <WarmthMeter warmth={warmth} />
        <FormGuide form={form} />
        <div className="ppl-toolbar">
          <Tabs<View> value={view} onChange={chooseView} options={[{ value: 'tree', label: 'Tree' }, { value: 'list', label: 'List' }]} />
          {birthdays.length > 0 && (
            <details className="ppl-menu">
              <summary>Birthdays <span className="mono">{birthdays.length}</span></summary>
              <ul className="ppl-menu-pop" aria-label="Birthdays in the next 30 days">
                {birthdays.map(({ p, next, inDays }) => (
                  <li key={p.id} className="ppl-strip-item">
                    <button type="button" className="ppl-link" onClick={() => setOpenId(p.id!)}>{p.name}</button>
                    <span className={inDays <= 3 ? 'ppl-status is-due' : 'ppl-status'}>{inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `${formatDate(next)} · ${inDays} days`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        {view === 'tree' ? (
          <>
            <TreeView branches={branches} collapsed={collapsed} now={now} selectedId={openId} onToggle={toggleBranch} onOpen={setOpenId} onAdd={(relation) => setAdding({ relation })} warmthPct={warmth.pct} />
            {tracked.length === 0 && <p className="ppl-empty-hint small muted">Nobody has a rhythm yet. Open a person and pick weekly, monthly or quarterly, and their ring will start showing how warm things are.</p>}
            {soon.length > 0 && (
              <section className="ppl-soon" aria-label="Reach out soon">
                <h2 className="ppl-soon-h">Reach out soon</h2>
                <ul>
                  {soon.map(({ p }, i) => (
                    <li key={p.id}>
                      <button type="button" className="ppl-reach" onClick={() => setOpenId(p.id!)} data-testid={i === 0 ? 'reach-out' : undefined}>{reachLine(p, now)}</button>
                      <button type="button" className="btn btn-sm" onClick={() => quickLog(p)} aria-label={`Contacted ${p.name} today`}>Contacted</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {feed.length > 0 && (
              <section className="ppl-feed" aria-label="Friend feed">
                <h2 className="ppl-soon-h">Friend feed</h2>
                <p className="small muted ppl-feed-sub">Coolest first, each with something to say.</p>
                <div className="ppl-feed-list">
                  {feed.slice(0, feedAll ? FEED_MAX : FEED_FIRST).map((p) => <FriendCard key={p.id} p={p} now={now} others={people ?? []} onOpen={() => setOpenId(p.id!)} />)}
                </div>
                {feed.length > FEED_FIRST && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFeedAll(!feedAll)}>{feedAll ? 'Show fewer' : `Show all ${Math.min(feed.length, FEED_MAX)}`}</button>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="ppl-col">
            <Card title="Check-ins" flush>
              <div>
                {tracked.length === 0 && <div className="ppl-empty-hint small muted">No rhythms set yet. Everyone is in the list below.</div>}
                {tracked.map(({ p, s }, idx) => (
                  <div key={p.id}>
                    {idx === 0 && s.overdue && <div className="ppl-group"><span>Ready to hear from you</span><span className="mono">{dueCount}</span></div>}
                    {!s.overdue && (idx === 0 || tracked[idx - 1].s.overdue) && <div className="ppl-group"><span>{dueCount ? 'Warm' : 'On rhythm'}</span><span className="mono">{tracked.length - dueCount}</span></div>}
                    {row(p)}
                  </div>
                ))}
              </div>
            </Card>
            {others.length > 0 && (
              <Card flush className="ppl-else">
                <details>
                  <summary><span>Everyone else</span><span className="mono">{others.length}</span></summary>
                  <div className="ppl-else-search"><input className="input" type="search" placeholder="Search by name" aria-label="Search everyone else" value={q} onChange={(e) => setQ(e.target.value)} /></div>
                  {shownOthers.map(({ p }) => <div key={p.id}>{row(p)}</div>)}
                  {shownOthers.length < matchedOthers.length && <div className="ppl-empty-hint small muted">Showing {shownOthers.length} of {matchedOthers.length}. Search to narrow down.</div>}
                  {matchedOthers.length === 0 && <div className="ppl-empty-hint small muted">No match.</div>}
                </details>
              </Card>
            )}
          </div>
        )}
        <RecordsStrip rec={rec} />
        </div>
      )}
      {adding && <PersonForm defaultRelation={adding.relation} onClose={() => setAdding(null)} />}
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
