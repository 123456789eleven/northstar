import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Person } from '../db'
import { Card, Empty, PageSkeleton, Tabs } from '../components/ui'
import { useFocusTarget } from '../lib/useFocusParam'
import { today } from '../lib/dates'
import { sortPeople } from '../features/people/people'
import { PersonDetail, PersonForm } from '../features/people/PersonModals'
import { LogPanel, useQuickLog } from '../features/people/LogPanel'
import { TreeView } from '../features/people/TreeView'
import { PersonRow } from '../features/people/PersonRow'
import { circleWarmth } from '../features/people/warmth'
import { groupByRelation, reachSoon } from '../features/people/tree'
import { Ring } from '../features/game/ui/Ring'
import { FloorMore, FloorView } from '../features/buildings/Floor'
import '../features/people/people.css'
import '../features/people/tree.css'
import '../features/people/friends.css'
import '../features/people/reach.css'

type View = 'tree' | 'list'
const VIEW_KEY = 'northstar.people.view'
const OPEN_KEY = 'northstar.people.tree.open'
const MAX_OTHERS = 60
const BIG_BRANCH = 12

const readOverrides = (): Record<string, boolean> => { try { return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') } catch { return {} } }

export default function People() {
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'tree' } catch { return 'tree' } })
  const chooseView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }
  const [q, setQ] = useState('')
  const [reload, setReload] = useState(0)
  const data = useLiveQuery(async () => { try { return { people: await db.people.toArray(), interactions: await db.interactions.toArray() } } catch { return { error: true as const } } }, [reload])
  const people = data && 'people' in data ? data.people : undefined
  const failed = !!data && 'error' in data
  const [adding, setAdding] = useState<{ relation: string } | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [loggingId, setLoggingId] = useState<number | null>(null)
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

  const addBtn = <button className="btn btn-primary btn-sm" onClick={() => setAdding({ relation: '' })}>Add person</button>

  const treeBody = view === 'tree' ? (
    <>
      <TreeView branches={branches} collapsed={collapsed} now={now} selectedId={openId} onToggle={toggleBranch} onOpen={setOpenId} onAdd={(relation) => setAdding({ relation })} warmthPct={warmth.pct} />
      {tracked.length === 0 && <p className="ppl-empty-hint small muted">Nobody has a rhythm yet. Open a person and pick weekly, monthly or quarterly.</p>}
    </>
  ) : (
    <div className="tree-list ppl-col">
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
  )

  const hero = failed ? (
    <Card className="floor-hero">
      <Empty title="People could not load" action={<button className="btn" onClick={() => setReload((n) => n + 1)}>Try again</button>}>
        Your data is still on this device. Try again, and if it keeps happening export a backup from Settings.
      </Empty>
    </Card>
  ) : people === undefined ? (
    <PageSkeleton strip={false} rows={7} />
  ) : people.length === 0 ? (
    <Card className="floor-hero">
      <Empty title="Your circle starts with one name" action={<button className="btn btn-primary" onClick={() => setAdding({ relation: '' })}>Add the first name</button>}>
        Add one person and pick how often you will check in. They become the first leaf on your tree.
      </Empty>
    </Card>
  ) : (
    <section className="card floor-hero tree-hero" aria-label="Your tree">
      <div className="tree-head">
        {warmth.pct !== null && (
          <span className="tree-warm">
            <Ring value={warmth.pct / 100} size={32} stroke={3} tone="people" label={`Circle ${warmth.pct} percent warm`} />
            {warmth.pct}% warm
          </span>
        )}
        <span className="grow" />
        <Tabs<View> value={view} onChange={chooseView} options={[{ value: 'tree', label: 'Tree' }, { value: 'list', label: 'List' }]} />
        {addBtn}
      </div>
      {treeBody}
    </section>
  )

  const more = (
    <FloorMore
      floor="Tree"
      items={[
        { id: 'waiting', label: 'Who is waiting', value: soon.length || undefined, to: '/reach-out' },
        { id: 'import', label: 'Import contacts', to: '/data' },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Tree" className="park-floor" hero={hero} more={people && people.length > 0 ? more : undefined} />
      {adding && <PersonForm defaultRelation={adding.relation} onClose={() => setAdding(null)} />}
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
