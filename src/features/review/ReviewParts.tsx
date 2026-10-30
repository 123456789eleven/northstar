import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, logEvent, type Area, type ISODate, type Review } from '../../db'
import { AREA_LABEL, Card, Field } from '../../components/ui'
import { formatDate, money, toISODate } from '../../lib/dates'
import { weekDigest } from './summary'

function Fact({ label, value, zero, note }: { label: string; value: string; zero?: boolean; note?: string }) {
  return (
    <div>
      <div className="rv-fact-label">{label}</div>
      <div className={zero ? 'rv-fact-value is-zero' : 'rv-fact-value'}>{value}</div>
      {note && <div className="rv-fact-note">{note}</div>}
    </div>
  )
}

function fmtMinutes(m: number) {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function Digest({ weekOf }: { weekOf: ISODate }) {
  const res = useLiveQuery(async () => ({ weekOf, d: await weekDigest(weekOf) }), [weekOf])
  const d = res && res.weekOf === weekOf ? res.d : undefined
  if (!d) return <Card title="The week in numbers"><div style={{ height: 120 }} /></Card>

  let spendNote: string | undefined
  if (d.hasMoney) {
    if (d.spentPrev > 0) {
      const pct = Math.round(((d.spent - d.spentPrev) / d.spentPrev) * 100)
      spendNote = `${pct === 0 ? 'same as' : `${Math.abs(pct)}% ${pct > 0 ? 'more than' : 'less than'}`} prior week (${money(d.spentPrev)})`
    } else spendNote = 'nothing spent the prior week'
  }

  return (
    <Card title="The week in numbers">
      {d.eventCount === 0 && d.tasksDone === 0 && d.mealDays === 0 && !d.hasMoney ? (
        <p className="small faint" style={{ margin: 0 }}>Nothing was logged this week. The digest fills in from tasks, meals, spending, study and contacts.</p>
      ) : (
        <>
          <div className="rv-digest">
            <Fact label="Tasks completed" value={String(d.tasksDone)} zero={!d.tasksDone} />
            <Fact label="Goals" value={d.goalsCompleted ? `${d.goalsCompleted} completed` : `${d.goalUpdates} updates`} zero={!d.goalsCompleted && !d.goalUpdates}
              note={d.goalsCompleted && d.goalUpdates ? `${d.goalUpdates} updates` : undefined} />
            <Fact label="Spent" value={d.hasMoney ? money(d.spent) : '—'} zero={!d.hasMoney} note={spendNote ?? (d.hasMoney ? undefined : 'no transactions')} />
            <Fact label="Meals logged" value={`${d.mealDays} of 7 days`} zero={!d.mealDays} />
            <Fact label="Study" value={fmtMinutes(d.studyMinutes)} zero={!d.studyMinutes} />
            <Fact label="People contacted" value={String(d.peopleContacted)} zero={!d.peopleContacted} />
          </div>
          {d.milestones.length > 0 && (
            <ul className="rv-milestones" aria-label="Milestones this week">
              {d.milestones.map((m) => <li key={m.id}>{m.title}</li>)}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

export function ReviewForm({ weekOf, existing }: { weekOf: ISODate; existing: Review | null }) {
  const [wins, setWins] = useState(existing?.wins ?? '')
  const [struggles, setStruggles] = useState(existing?.struggles ?? '')
  const [focusNext, setFocusNext] = useState(existing?.focusNext ?? '')
  const [ratings, setRatings] = useState<Partial<Record<Area, number>>>(existing?.ratings ?? {})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [dirty, setDirty] = useState(false)

  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); setStatus('idle') }
  const rate = (a: Area, n: number) => {
    setRatings((r) => {
      const next = { ...r }
      if (next[a] === n) delete next[a]
      else next[a] = n
      return next
    })
    setDirty(true)
    setStatus('idle')
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const body = { wins: wins.trim(), struggles: struggles.trim(), focusNext: focusNext.trim(), ratings }
    await db.transaction('rw', db.reviews, db.events, async () => {
      const row = await db.reviews.where('weekOf').equals(weekOf).first()
      if (row?.id != null) {
        await db.reviews.update(row.id, body)
        return
      }
      const id = await db.reviews.add({ weekOf, ...body, createdAt: new Date().toISOString() })
      await logEvent({ area: 'personal', kind: 'review.done', title: `Reviewed the week of ${formatDate(weekOf)}`, refTable: 'reviews', refId: id })
    })
    setStatus('saved')
    setDirty(false)
  }

  return (
    <Card title={existing ? 'Your review' : 'Write your review'}>
      <form className="stack" onSubmit={save}>
        <Field label="Wins">
          <textarea className="textarea" value={wins} onChange={(e) => edit(setWins)(e.target.value)} placeholder="What went well? What are you proud of?" />
        </Field>
        <Field label="Struggles">
          <textarea className="textarea" value={struggles} onChange={(e) => edit(setStruggles)(e.target.value)} placeholder="What was hard or didn't happen?" />
        </Field>
        <Field label="Focus next week">
          <textarea className="textarea" value={focusNext} onChange={(e) => edit(setFocusNext)(e.target.value)} placeholder="The one to three things that matter most." />
        </Field>
        <div>
          <div className="field" style={{ marginBottom: 6 }}><span>How did each area feel? (1 = rough, 5 = great; tap again to clear)</span></div>
          <div className="rv-ratings">
            {AREAS.map((a) => (
              <div className="rv-rate-row" key={a}>
                <span className="rv-rate-name">{AREA_LABEL[a]}</span>
                <div className="rv-rate-btns" role="group" aria-label={`${AREA_LABEL[a]} rating`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} className="btn" aria-pressed={ratings[a] === n} onClick={() => rate(a, n)}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rv-save">
          {status === 'saved' && <span className="small good" role="status">Saved</span>}
          {existing && !dirty && status !== 'saved' && <span className="small faint">Saved {formatDate(toISODate(new Date(existing.createdAt)))}</span>}
          <button type="submit" className="btn btn-primary" disabled={status === 'saving' || (!!existing && !dirty)}>
            {existing ? 'Save changes' : 'Save review'}
          </button>
        </div>
      </form>
    </Card>
  )
}
