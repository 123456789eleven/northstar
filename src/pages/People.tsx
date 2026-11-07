import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Interaction, type Person } from '../db'
import { Card, Empty, PageHeader, PageSkeleton, Tabs } from '../components/ui'
import { useToast } from '../components/toastContext'
import { useFocusTarget } from '../lib/useFocusParam'
import { daysBetween, formatDate, today } from '../lib/dates'
import { KINDS, logContact, nextBirthday, sortPeople, undoContact } from '../features/people/people'
import { PersonDetail, PersonForm } from '../features/people/PersonModals'
import { CircleView } from '../features/people/CircleView'
import { PersonRow } from '../features/people/PersonRow'
import { mostOverdue, reminderLine } from '../features/people/circle'
import '../features/people/people.css'
import '../features/people/circle.css'

const KIND_KEY = 'northstar.people.lastKind'
const lastKind = (): Interaction['kind'] => {
  try {
    const v = localStorage.getItem(KIND_KEY)
    return KINDS.some((k) => k.value === v) ? (v as Interaction['kind']) : 'text'
  } catch {
    return 'text'
  }
}
const rememberKind = (k: Interaction['kind']) => {
  try { localStorage.setItem(KIND_KEY, k) } catch { /* ignore */ }
}

function LogPanel({ person, onDone }: { person: Person; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const log = async (kind: Interaction['kind']) => {
    rememberKind(kind)
    await logContact(person, kind, note, date)
    onDone()
  }
  return (
    <div className="ppl-log">
      <div className="ppl-log-extra">
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
        <input className="input ppl-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date of contact" />
      </div>
      <div className="ppl-log-kinds">
        {KINDS.map((k) => <button key={k.value} className="btn" onClick={() => log(k.value)}>{k.label}</button>)}
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  )
}

type View = 'circle' | 'list'
const VIEW_KEY = 'northstar.people.view'
const MAX_OTHERS = 60

export default function People() {
  const [view, setView] = useState<View>(() => { try { return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'circle' } catch { return 'circle' } })
  const chooseView = (v: View) => { setView(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }
  const [q, setQ] = useState('')
  const people = useLiveQuery(() => db.people.toArray(), [])
  const [adding, setAdding] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  const [loggingId, setLoggingId] = useState<number | null>(null)
  const now = today()
  const toast = useToast()
  const quickLog = async (p: Person) => {
    const kind = lastKind()
    const label = KINDS.find((k) => k.value === kind)?.label.toLowerCase() ?? kind
    await logContact(p, kind)
    toast({ message: `Logged ${label} with ${p.name}`, undo: () => undoContact(p.id!, kind, today()) })
  }

  useFocusTarget({
    ready: people !== undefined,
    exists: (id) => (people ?? []).some((p) => String(p.id) === id),
    reveal: (id) => setOpenId(Number(id)),
  })

  const sorted = useMemo(() => (people ? sortPeople(people, now) : []), [people, now])
  const tracked = sorted.filter((x) => x.p.cadenceDays > 0)
  const others = sorted.filter((x) => !(x.p.cadenceDays > 0))
  const dueCount = tracked.filter((x) => x.s.overdue).length
  const reach = mostOverdue(tracked.map((x) => x.p), now)
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
      <PageHeader title="People" sub={sub} actions={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add person</button>} />
      {people === undefined ? (
        <PageSkeleton strip={false} rows={7} />
      ) : people.length === 0 ? (
        <Card>
          <Empty title="No one here yet" action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Add your first person</button>}>
            Add someone you want to stay close to and choose how often to check in. When you talk, tap “Contacted” and Northstar will tell you who is due next.
          </Empty>
        </Card>
      ) : (
        <>
        {birthdays.length > 0 && (
          <ul className="ppl-strip" aria-label="Birthdays in the next 30 days">
            {birthdays.map(({ p, next, inDays }) => (
              <li key={p.id} className="ppl-strip-item">
                <span>{p.name}</span>
                <span className={inDays <= 3 ? 'ppl-status is-due' : 'ppl-status'}>{inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `${formatDate(next)} · ${inDays} days`}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="ppl-toolbar">
          <Tabs<View> value={view} onChange={chooseView} options={[{ value: 'circle', label: 'Circle' }, { value: 'list', label: 'List' }]} />
          {reach && <button type="button" className="ppl-reach" onClick={() => setOpenId(reach.id!)} data-testid="reach-out">{reminderLine(reach, now)}</button>}
        </div>
        <div className={`ppl-board ${view === 'list' ? 'is-list' : ''}`}>
          {view === 'circle' && (
            <Card title="Your circle" className="ppl-circle-card">
              {tracked.length === 0 ? (
                <div className="ppl-empty-hint small muted">Nobody has a check-in rhythm yet. Open a person and choose weekly, monthly or quarterly to place them on the circle.</div>
              ) : <CircleView people={tracked.map((x) => x.p)} onOpen={setOpenId} selectedId={openId} />}
            </Card>
          )}
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
        </div>
        </>
      )}
      {adding && <PersonForm onClose={() => setAdding(false)} />}
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
