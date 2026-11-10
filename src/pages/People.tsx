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
import { reminderLine } from '../features/people/circle'
import { groupByRelation, reachSoon } from '../features/people/tree'
import '../features/people/people.css'
import '../features/people/tree.css'

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
  const data = useLiveQuery(async () => { try { return { people: await db.people.toArray() } } catch { return { error: true as const } } }, [reload])
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

  const sub = people === undefined ? '' : people.length === 0 ? 'Keep in touch with the people who matter.' : dueCount ? `${dueCount} to check in with` : 'Everyone is up to date'

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
          <Empty title="No one here yet" action={<button className="btn btn-primary" onClick={() => setAdding({ relation: '' })}>Add your first person</button>}>
            Start with one person you want to stay close to and choose how often to check in. They become the first leaf on your tree, and Northstar tells you who is due next.
          </Empty>
        </Card>
      ) : (
        <>
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
            <TreeView branches={branches} collapsed={collapsed} now={now} selectedId={openId} onToggle={toggleBranch} onOpen={setOpenId} onAdd={(relation) => setAdding({ relation })} />
            {tracked.length === 0 && <p className="ppl-empty-hint small muted">Nobody has a check-in rhythm yet. Open a person and choose weekly, monthly or quarterly so their ring can show how recently you spoke.</p>}
            {soon.length > 0 && (
              <section className="ppl-soon" aria-label="Reach out soon">
                <h2 className="ppl-soon-h">Reach out soon</h2>
                <ul>
                  {soon.map(({ p }, i) => (
                    <li key={p.id}>
                      <button type="button" className="ppl-reach" onClick={() => setOpenId(p.id!)} data-testid={i === 0 ? 'reach-out' : undefined}>{reminderLine(p, now)}</button>
                      <button type="button" className="btn btn-sm" onClick={() => quickLog(p)} aria-label={`Contacted ${p.name} today`}>Contacted</button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        ) : (
          <div className="ppl-col">
            <Card title="Check-ins" flush>
              <div>
                {tracked.length === 0 && <div className="ppl-empty-hint small muted">Nothing scheduled. Everyone is in the list below.</div>}
                {tracked.map(({ p, s }, idx) => (
                  <div key={p.id}>
                    {idx === 0 && s.overdue && <div className="ppl-group"><span>To contact</span><span className="mono">{dueCount}</span></div>}
                    {!s.overdue && (idx === 0 || tracked[idx - 1].s.overdue) && <div className="ppl-group"><span>{dueCount ? 'Up to date' : 'On rhythm'}</span><span className="mono">{tracked.length - dueCount}</span></div>}
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
        </>
      )}
      {adding && <PersonForm defaultRelation={adding.relation} onClose={() => setAdding(null)} />}
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
