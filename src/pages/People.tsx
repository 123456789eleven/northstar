import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Interaction, type Person } from '../db'
import { Card, Empty, PageHeader } from '../components/ui'
import KpiStrip from '../components/KpiStrip'
import { daysBetween, formatDate, relativeDay, today } from '../lib/dates'
import { KINDS, logContact, nextBirthday, sortPeople } from '../features/people/people'
import { PersonDetail, PersonForm } from '../features/people/PersonModals'
import '../features/people/people.css'

function LogPanel({ person, onDone }: { person: Person; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today())
  const log = async (kind: Interaction['kind']) => {
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
      {people && people.length === 0 ? (
        <Card>
          <Empty>
            Add someone you want to stay close to and choose how often to check in. When you talk, tap “Logged contact” and Northstar will tell you who is due next.
            <div style={{ marginTop: 14 }}><button className="btn btn-primary" onClick={() => setAdding(true)}>Add your first person</button></div>
          </Empty>
        </Card>
      ) : (
        <>
        <KpiStrip
          items={[
            { label: 'People', value: sorted.length },
            { label: 'Due for check-in', value: dueCount, delta: dueCount ? 'overdue' : undefined, deltaTone: dueCount ? 'warn' : undefined },
            { label: 'Birthdays, 30 days', value: birthdays.length },
          ]}
        />
        <div className="ppl-layout">
          <Card title="Check-ins">
            <div>
              {sorted.map(({ p, s }) => (
                <div className="ppl-row" key={p.id}>
                  <button className="ppl-main" onClick={() => setOpenId(p.id!)}>
                    <span className="ppl-name">{p.name}</span>
                    <span className="ppl-meta">{[p.relation, p.lastContact && `last ${relativeDay(p.lastContact).toLowerCase()}`].filter(Boolean).join(' · ') || ' '}</span>
                  </button>
                  <span className={s.overdue ? 'ppl-status is-due' : 'ppl-status'}>{s.text}</span>
                  {loggingId !== p.id && (
                    <button className={s.overdue ? 'btn btn-sm btn-primary' : 'btn btn-sm'} style={{ height: 32 }} onClick={() => setLoggingId(p.id!)}>Logged contact</button>
                  )}
                  {loggingId === p.id && <LogPanel person={p} onDone={() => setLoggingId(null)} />}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Birthdays · next 30 days">
            {birthdays.length === 0 ? (
              <p className="small faint" style={{ margin: 0 }}>None coming up. Add birthdays from a person’s Edit screen.</p>
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
