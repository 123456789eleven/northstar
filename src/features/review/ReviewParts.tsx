import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, logEvent, type Area, type ISODate } from '../../db'
import { AREA_LABEL, Card, Field, Skeleton } from '../../components/ui'
import { addDays, formatDate, money, toISODate } from '../../lib/dates'
import { spendChange, weekDigest, type LockableReview } from './summary'

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
  if (!d) return <Card title="1 · What happened"><Skeleton lines={4} label="Loading the week" /></Card>

  let spendNote: string | undefined
  if (d.hasMoney) {
    const pct = spendChange(d.spent, d.spentPrev)
    if (pct !== null) spendNote = `${pct === 0 ? 'same as' : `${Math.abs(pct)}% ${pct > 0 ? 'more than' : 'less than'}`} prior week (${money(d.spentPrev)})`
  }

  return (
    <Card title="1 · What happened">
      {d.eventCount === 0 && d.tasksDone === 0 && d.mealDays === 0 && !d.hasMoney && d.slipped.length === 0 ? (
        <p className="small faint" style={{ margin: 0 }}>Nothing was logged for {weekRange(weekOf)}. The digest fills in from tasks, meals, spending, study and contacts.</p>
      ) : (
        <>
          <div className="rv-digest">
            <Fact label="Tasks completed" value={String(d.tasksDone)} zero={!d.tasksDone} />
            <Fact label="Goals" value={d.goalsCompleted ? `${d.goalsCompleted} completed` : `${d.goalUpdates} updates`} zero={!d.goalsCompleted && !d.goalUpdates}
              note={d.goalsCompleted && d.goalUpdates ? `${d.goalUpdates} updates` : undefined} />
            <Fact label="Spent" value={d.hasMoney ? money(d.spent) : '—'} zero={!d.hasMoney} note={spendNote ?? (d.hasMoney ? 'imported transactions' : 'no transactions')} />
            <Fact label="Meals logged" value={`${d.mealDays} of 7 days`} zero={!d.mealDays} note="days with at least one meal" />
            <Fact label="Study" value={fmtMinutes(d.studyMinutes)} zero={!d.studyMinutes} />
            <Fact label="People contacted" value={String(d.peopleContacted)} zero={!d.peopleContacted} note="different people" />
          </div>
          {d.milestones.length > 0 && (
            <div className="rv-sub">
              <div className="rv-sub-title">Milestones</div>
              <ul className="rv-milestones" aria-label="Milestones this week">
                {d.milestones.map((m) => <li key={m.id}>{m.title}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
      {d.slipped.length > 0 && (
        <div className="rv-sub">
          <div className="rv-sub-title">Slipped: {d.slipped.length} {d.slipped.length === 1 ? 'task' : 'tasks'} due this week, still open</div>
          <ul className="rv-slipped" aria-label="Tasks that slipped">
            {d.slipped.slice(0, 6).map((t) => <li key={t.id}><span className="rv-slip-due">{formatDate(t.due!)}</span>{t.title}</li>)}
          </ul>
          {d.slipped.length > 6 && <div className="small faint">and {d.slipped.length - 6} more on Tasks</div>}
        </div>
      )}
    </Card>
  )
}

function weekRange(w: ISODate) {
  return `${formatDate(w)} – ${formatDate(addDays(w, 6))}`
}

export function ReviewForm({ weekOf, existing, planned }: { weekOf: ISODate; existing: LockableReview | null; planned?: string }) {
  const [wins, setWins] = useState(existing?.wins ?? '')
  const [struggles, setStruggles] = useState(existing?.struggles ?? '')
  const [focusNext, setFocusNext] = useState(existing?.focusNext ?? '')
  const [ratings, setRatings] = useState<Partial<Record<Area, number>>>(existing?.ratings ?? {})
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [dirty, setDirty] = useState(false)
  const locked = !!existing?.lockedAt

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

  // lockedAt is an extra, unindexed field on the review row, so the typed table API needs a cast.
  async function persist(lock: boolean) {
    setStatus('saving')
    const body = { wins: wins.trim(), struggles: struggles.trim(), focusNext: focusNext.trim(), ratings }
    const lockedAt = lock ? new Date().toISOString() : undefined
    await db.transaction('rw', db.reviews, db.events, async () => {
      const row = await db.reviews.where('weekOf').equals(weekOf).first()
      if (row?.id != null) {
        await db.reviews.update(row.id, (lock ? { ...body, lockedAt } : body) as never)
        return
      }
      const id = await db.reviews.add({ weekOf, ...body, ...(lock ? { lockedAt } : {}), createdAt: new Date().toISOString() } as never)
      await logEvent({ area: 'personal', kind: 'review.done', title: `Reviewed the week of ${formatDate(weekOf)}`, refTable: 'reviews', refId: id })
    })
    setStatus('saved')
    setDirty(false)
  }

  async function unlock() {
    const row = await db.reviews.where('weekOf').equals(weekOf).first()
    if (row?.id != null) await db.reviews.update(row.id, { lockedAt: undefined } as never)
  }

  return (
    <Card
      title={locked ? 'Your review (locked)' : existing ? 'Your review' : 'Write your review'}
      action={locked ? <button type="button" className="btn btn-sm" onClick={() => void unlock()}>Unlock to edit</button> : undefined}
    >
      <form className="stack" onSubmit={(e: FormEvent) => { e.preventDefault(); void persist(false) }}>
        {planned && (
          <p className="rv-planned small"><span className="faint">You planned for this week:</span> {planned}</p>
        )}
        <Field label="2 · Wins: what went well, what are you proud of?">
          <textarea className="textarea" value={wins} readOnly={locked} onChange={(e) => edit(setWins)(e.target.value)} placeholder="Even small ones count." />
          <div className="print-only rv-print-text">{wins || '—'}</div>
        </Field>
        <Field label="3 · Slipped: what was hard or did not happen?">
          <textarea className="textarea" value={struggles} readOnly={locked} onChange={(e) => edit(setStruggles)(e.target.value)} placeholder="Say what got in the way, not just what was missed." />
          <div className="print-only rv-print-text">{struggles || '—'}</div>
        </Field>
        <Field label="4 · Next week: the one to three things that matter most">
          <textarea className="textarea" value={focusNext} readOnly={locked} onChange={(e) => edit(setFocusNext)(e.target.value)} placeholder="These show up here again when you review the following week." />
          <div className="print-only rv-print-text">{focusNext || '—'}</div>
        </Field>
        <div>
          <div className="field" style={{ marginBottom: 6 }}><span>5 · How did each area feel? 1 = rough, 5 = great; tap again to clear.</span></div>
          <div className="rv-ratings">
            {AREAS.map((a) => (
              <div className="rv-rate-row" key={a}>
                <span className="rv-rate-name">{AREA_LABEL[a]}<span className="print-only mono"> {ratings[a] ?? '—'} / 5</span></span>
                <div className="rv-rate-btns" role="group" aria-label={`${AREA_LABEL[a]} rating`}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button type="button" key={n} className="btn" disabled={locked} aria-pressed={ratings[a] === n} onClick={() => rate(a, n)}>{n}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rv-save">
          <span className="rv-save-state small">
            {status === 'saved' ? <span className="good" role="status">{locked ? 'Saved and locked' : 'Saved'}</span>
              : locked ? <span className="faint">Locked {formatDate(toISODate(new Date(existing!.lockedAt!)))}</span>
              : dirty ? <span className="faint">Unsaved changes</span>
              : existing ? <span className="faint">Saved {formatDate(toISODate(new Date(existing.createdAt)))}</span> : null}
          </span>
          {!locked && (
            <>
              <button type="submit" className="btn" disabled={status === 'saving' || (!!existing && !dirty)}>{existing ? 'Save changes' : 'Save draft'}</button>
              <button type="button" className="btn btn-primary" disabled={status === 'saving'} onClick={() => void persist(true)}>Save and lock</button>
            </>
          )}
        </div>
      </form>
    </Card>
  )
}
