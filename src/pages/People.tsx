import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Interaction, type Person } from '../db'
import { Card, Empty, PageHeader, PageSkeleton } from '../components/ui'
import { useToast } from '../components/toastContext'
import { daysBetween, formatDate, relativeDay, today } from '../lib/dates'
import { KINDS, cadenceLabel, logContact, nextBirthday, sortPeople, undoContact } from '../features/people/people'
import { PersonDetail, PersonForm } from '../features/people/PersonModals'
import '../features/people/people.css'

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

export default function People() {
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

  const sorted = useMemo(() => (people ? sortPeople(people, now) : []), [people, now])
  const dueCount = sorted.filter((x) => x.s.overdue).length

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

  const sub = people === undefined ? '' : people.length === 0 ? 'Keep in touch with the people who matter.' : dueCount ? `${dueCount} due for a check-in` : 'Everyone is up to date'

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
        <div className="ppl-layout">
          <Card title="Check-ins" flush>
            <div>
              {sorted.map(({ p, s }, idx) => (
                <div key={p.id}>
                  {idx === 0 && s.overdue && <div className="ppl-group"><span>Due now</span><span className="mono">{dueCount}</span></div>}
                  {!s.overdue && (idx === 0 || sorted[idx - 1].s.overdue) && <div className="ppl-group"><span>{dueCount ? 'Up to date' : 'Everyone'}</span><span className="mono">{sorted.length - dueCount}</span></div>}
                  <div className="ppl-row">
                    <button className="ppl-main" onClick={() => setOpenId(p.id!)}>
                      <span className="ppl-name">{p.name}</span>
                      <span className="ppl-meta">
                        {[p.relation, p.cadenceDays ? cadenceLabel(p.cadenceDays).toLowerCase() : null, p.lastContact ? `last ${relativeDay(p.lastContact).toLowerCase()}` : 'never contacted'].filter(Boolean).join(' · ')}
                      </span>
                    </button>
                    <span className={s.overdue ? 'ppl-status is-due' : 'ppl-status'}>{s.text.replace(' · never logged', '')}</span>
                    <button className="btn btn-sm ppl-act" onClick={() => quickLog(p)} aria-label={`Contacted ${p.name} today`}>Contacted</button>
                    <button className="btn btn-sm btn-ghost ppl-more" onClick={() => setLoggingId(loggingId === p.id ? null : p.id!)} aria-label={`Log details for ${p.name}`} aria-expanded={loggingId === p.id}>Details</button>
                    {loggingId === p.id && <LogPanel person={p} onDone={() => setLoggingId(null)} />}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Birthdays · next 30 days" className={birthdays.length ? 'ppl-bday-card' : 'ppl-bday-card is-empty'}>
            {birthdays.length === 0 ? (
              <Empty>None in the next 30 days. Add birthdays from a person’s Edit screen.</Empty>
            ) : (
              birthdays.map(({ p, next, inDays }) => (
                <div className="ppl-bday" key={p.id}>
                  <span>{p.name}</span>
                  <span className={inDays <= 3 ? 'ppl-status is-due' : 'ppl-status'}>
                    {inDays === 0 ? 'Today' : inDays === 1 ? 'Tomorrow' : `${formatDate(next)} · ${inDays} days`}
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
        </>
      )}
      {adding && <PersonForm onClose={() => setAdding(false)} />}
      {openId != null && <PersonDetail personId={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}
