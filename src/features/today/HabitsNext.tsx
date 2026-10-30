// Today cards for the Habits and Planner modules.
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { Card } from '../../components/ui'
import { useNow } from '../../components/useNow'
import { addDays, relativeDay, today } from '../../lib/dates'
import { toggleCheckIn } from '../habits/habitData'
import { streak } from '../habits/stats'
import { sortedUpcoming, timeLabel } from '../planner/layout'
import '../habits/habits.css'

export function HabitsTile() {
  const d = today()
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [])
  const by = useMemo(() => {
    const m = new Map<number, Set<string>>()
    for (const l of logs ?? []) (m.get(l.habitId) ?? m.set(l.habitId, new Set()).get(l.habitId)!).add(l.date)
    return m
  }, [logs])
  if (habits === undefined) return null
  const done = habits.filter((h) => by.get(h.id!)?.has(d)).length
  return (
    <Card title="Habits" action={<Link className="card-link" to="/habits">{habits.length ? `${done} of ${habits.length}` : 'Habits'}</Link>}>
      {habits.length === 0 ? (
        <div className="tile-empty">
          No habits yet. <Link to="/habits">Add one</Link> you can finish in two minutes.
        </div>
      ) : (
        habits.map((h) => {
          const dates = by.get(h.id!) ?? new Set<string>()
          const checked = dates.has(d)
          const s = streak(dates, d, h.perWeek)
          return (
            <div key={h.id} className="habit-tile-row">
              <label className="hb-check">
                <input type="checkbox" className="check" checked={checked} onChange={() => void toggleCheckIn(h, d)} aria-label={`${h.name} today`} />
              </label>
              <span className="name">{h.name}</span>
              {s.count > 0 && <span className="streak">{s.count}{s.unit === 'day' ? 'd' : 'w'}</span>}
            </div>
          )
        })
      )}
    </Card>
  )
}

export function NextUp() {
  const now = useNow()
  const d = today()
  const events = useLiveQuery(() => db.calendar.where('date').between(d, addDays(d, 1), true, true).toArray(), [d])
  if (events === undefined) return null
  const next = sortedUpcoming(events, d, now.getHours() * 60 + now.getMinutes()).slice(0, 3)
  return (
    <Card title="Next up" action={<Link className="card-link" to="/planner">Planner</Link>}>
      {next.length === 0 ? (
        <div className="tile-empty">Nothing on the calendar today or tomorrow.</div>
      ) : (
        next.map((e) => (
          <Link key={e.id} to="/planner" className="qgoal">
            <div className="qgoal-head">
              <span>{e.title}</span>
              <span className="faint">{relativeDay(e.date)} · {timeLabel(e)}</span>
            </div>
          </Link>
        ))
      )}
    </Card>
  )
}
