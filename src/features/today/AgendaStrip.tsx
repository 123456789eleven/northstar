import '../gcal/gcal.css'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { useNow } from '../../components/useNow'
import { today } from '../../lib/dates'
import { agendaForDay } from './agenda'

/** Mini time-rail of today's events and time blocks. Phone: a horizontal scroll-snap strip; desktop: a compact vertical rail. */
export function AgendaStrip() {
  const d = today()
  const now = useNow()
  const events = useLiveQuery(() => db.calendar.where('date').between(addPrev(d), d, true, true).toArray(), [d])
  if (events === undefined) return <section className="card agenda-card agenda-skel skel-pulse" aria-hidden />
  const items = agendaForDay(events, d, now.getHours() * 60 + now.getMinutes())
  return (
    <section className="card agenda-card" aria-label="Today's agenda">
      <header className="focus-head">
        <h2 className="focus-title">Agenda</h2>
        <Link className="card-link" to="/planner">Planner</Link>
      </header>
      {items.length === 0 ? (
        <p className="tile-empty">Nothing scheduled today. Block time for a task in the <Link to="/planner">Planner</Link>.</p>
      ) : (
        <ol className="agenda-rail" tabIndex={0} aria-label="Today's schedule">
          {items.map((i) => (
            <li key={i.key} className={`agenda-item is-${i.state} k-${i.kind}`} aria-current={i.state === 'now' ? 'time' : undefined}>
              <span className="agenda-dot" aria-hidden />
              <span className="agenda-time mono">{i.label}</span>
              <span className="agenda-name">{i.title}{i.kind === 'google' && <span className="gcal-src">Google</span>}</span>
              {i.state === 'now' && <span className="agenda-tag">Now</span>}
              {i.state === 'next' && <span className="agenda-tag">Next</span>}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

// Yesterday's date string, so an overnight event that spills into today is included.
function addPrev(d: string): string {
  const [y, m, day] = d.split('-').map(Number)
  const p = new Date(y, m - 1, day - 1)
  return `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-${String(p.getDate()).padStart(2, '0')}`
}
