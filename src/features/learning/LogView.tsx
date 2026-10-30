import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, Stat } from '../../components/ui'
import { db, type LearningItem } from '../../db'
import { addDays, daysBetween, formatDate, relativeDay, startOfWeek, today } from '../../lib/dates'
import MiniBars, { type BarDatum } from '../food/MiniBars'
import { addSession, fmtMinutes, sessionStreak } from './learningData'

export default function LogView({ items }: { items: LearningItem[] }) {
  const thisWeek = startOfWeek(today())
  const firstWeek = addDays(thisWeek, -7 * 11)
  const sessions = useLiveQuery(() => db.studySessions.orderBy('date').reverse().toArray(), [])
  const titles = new Map(items.map((i) => [i.id, i.title]))
  const loggable = items.filter((i) => i.status !== 'done')

  const [itemId, setItemId] = useState<string>('')
  const [minutes, setMinutes] = useState('')
  const [date, setDate] = useState(today())
  const [note, setNote] = useState('')
  const [shown, setShown] = useState(20)
  const selected = itemId || (loggable[0]?.id != null ? String(loggable[0].id) : '')

  const weeks: BarDatum[] = Array.from({ length: 12 }, (_, i) => {
    const wk = addDays(firstWeek, i * 7)
    return { key: wk, label: formatDate(wk, { month: 'numeric', day: 'numeric' }), full: `Week of ${formatDate(wk)}`, value: 0 }
  })
  for (const s of sessions ?? []) {
    if (s.date < firstWeek) continue
    const idx = Math.round(daysBetween(firstWeek, startOfWeek(s.date)) / 7)
    if (weeks[idx]) weeks[idx].value += s.minutes
  }
  const streak = sessionStreak(new Set((sessions ?? []).map((s) => s.date)))
  const weekTotal = weeks[11].value
  const avg = Math.round(weeks.slice(0, 11).reduce((a, w) => a + w.value, 0) / 11)

  const submit = async () => {
    const m = Number(minutes)
    if (!selected || !(m > 0)) return
    await addSession(Number(selected), m, date, note)
    setMinutes('')
    setNote('')
  }

  return (
    <div className="stack">
      <div className="ns-stats">
        <Stat label="Current streak" value={streak} note={streak === 1 ? 'day with study time' : 'days in a row with study time'} />
        <Stat label="This week" value={fmtMinutes(weekTotal)} note="since Monday" />
        <Stat label="Weekly average" value={fmtMinutes(avg)} note="previous 11 weeks" />
      </div>

      <MiniBars title="Minutes per week · last 12 weeks" data={weeks} unit="min" height={200} />

      <Card title="Sessions">
        {loggable.length > 0 && (
          <form
            className="learn-log-add"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <select className="select learn-log-item" value={selected} onChange={(e) => setItemId(e.target.value)} aria-label="Item">
              {loggable.map((i) => (
                <option key={i.id} value={String(i.id)}>
                  {i.title}
                </option>
              ))}
            </select>
            <input className="input learn-log-min" inputMode="numeric" placeholder="min" value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="Minutes" />
            <input className="input learn-log-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} aria-label="Date" />
            <input className="input learn-log-note" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Note" />
            <button className="btn btn-primary" type="submit" disabled={!(Number(minutes) > 0)}>
              Log
            </button>
          </form>
        )}
        {sessions && sessions.length === 0 ? (
          <Empty>No study time yet. Use the +15m / +30m / +60m buttons on an active item, or log a session above.</Empty>
        ) : (
          <div className="list">
            {(sessions ?? []).slice(0, shown).map((s) => (
              <div key={s.id} className="list-item">
                <span className="small faint learn-log-when">{relativeDay(s.date)}</span>
                <div className="grow">
                  <div className="learn-row-title">{titles.get(s.itemId) ?? 'Removed item'}</div>
                  {s.note && <div className="small muted">{s.note}</div>}
                </div>
                <span className="mono small">{fmtMinutes(s.minutes)}</span>
                <button className="btn btn-ghost btn-sm learn-x" onClick={() => s.id != null && db.studySessions.delete(s.id)} aria-label="Delete session">
                  ×
                </button>
              </div>
            ))}
            {(sessions?.length ?? 0) > shown && (
              <button className="btn btn-ghost btn-sm learn-more" onClick={() => setShown((n) => n + 40)}>
                Show more ({(sessions?.length ?? 0) - shown} older)
              </button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
