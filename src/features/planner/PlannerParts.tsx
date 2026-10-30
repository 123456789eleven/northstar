import type { CalendarEvent, Habit, ISODate, Task } from '../../db'
import { db } from '../../db'
import { Card } from '../../components/ui'
import { toggleDone } from '../tasks/taskActions'
import { toggleCheckIn } from '../habits/habitData'
import { DAY_MIN, daySegments, fmtTime, hourRange, layoutSegments, timeLabel } from './layout'

const PX_PER_HOUR = 48

export function EventButton({ e, onOpen }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void }) {
  const allDay = e.allDay || !e.start
  return (
    <button className={`pl-ev ${allDay ? 'allday' : ''}`} onClick={() => onOpen(e)}>
      {e.title}
      <small>{[timeLabel(e), e.location].filter(Boolean).join(' · ')}</small>
    </button>
  )
}

export function TaskLine({ t }: { t: Task }) {
  const done = t.status === 'done'
  return (
    <div className={`pl-task ${done ? 'done' : ''}`}>
      <label className="hb-check">
        <input type="checkbox" className="check" checked={done} onChange={() => void toggleDone(t)} aria-label={done ? `Reopen ${t.title}` : `Complete ${t.title}`} />
      </label>
      <span>{t.title}</span>
    </div>
  )
}

export function HabitLine({ h, date, checked }: { h: Habit; date: ISODate; checked: boolean }) {
  return (
    <div className={`pl-task ${checked ? 'done' : ''}`}>
      <label className="hb-check">
        <input type="checkbox" className="check" checked={checked} onChange={() => void toggleCheckIn(h, date)} aria-label={`${h.name} on ${date}`} />
      </label>
      <span>{h.name}</span>
    </div>
  )
}

/** Hour grid for one day. Clicking empty space starts a new event at that hour. */
export function DayGrid({ date, events, isToday, nowMin, onOpen, onNew }: { date: ISODate; events: CalendarEvent[]; isToday: boolean; nowMin: number; onOpen: (e: CalendarEvent) => void; onNew: (start: string) => void }) {
  const segs = daySegments(events, date)
  const [lo, hi] = hourRange(segs)
  const placed = layoutSegments(segs)
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i)
  const y = (min: number) => ((min - lo * 60) / 60) * PX_PER_HOUR
  return (
    <div
      className="pl-grid"
      role="group"
      aria-label="Day schedule"
      onClick={(ev) => {
        if (ev.target !== ev.currentTarget && !(ev.target as HTMLElement).classList.contains('pl-hour')) return
        const rect = ev.currentTarget.getBoundingClientRect()
        const h = Math.min(23, lo + Math.floor((ev.clientY - rect.top) / PX_PER_HOUR))
        onNew(`${String(h).padStart(2, '0')}:00`)
      }}
    >
      {hours.map((h) => (
        <div key={h} className="pl-hour">
          <i>{fmtTime(h * 60)}</i>
        </div>
      ))}
      {placed.map((p) => (
        <button
          key={`${p.event.id}-${p.continued}`}
          className="pl-ev"
          style={{ top: y(p.start), height: Math.max(22, y(p.end) - y(p.start) - 2), left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 3px)` }}
          onClick={() => onOpen(p.event)}
        >
          {p.event.title}
          <small>{p.continued ? `Until ${fmtTime(p.end)}` : timeLabel(p.event)}</small>
        </button>
      ))}
      {isToday && nowMin >= lo * 60 && nowMin <= Math.min(DAY_MIN, hi * 60) && <div className="pl-now" style={{ top: y(nowMin) }} aria-hidden />}
    </div>
  )
}

/** Unscheduled high-priority tasks; one click gives them a due date. */
export function PlanPanel({ tasks, date, label }: { tasks: Task[]; date: ISODate; label: string }) {
  const list = tasks.filter((t) => t.status === 'open' && !t.due && t.priority === 1)
  return (
    <Card title="Plan my day">
      {list.length === 0 ? (
        <div className="pl-empty">No unscheduled high-priority tasks. Mark a task High with no due date and it shows up here.</div>
      ) : (
        <>
          <div className="pl-note" style={{ marginBottom: 6 }}>Tap to schedule for {label}.</div>
          {list.map((t) => (
            <div key={t.id} className="pl-plan">
              <span>{t.title}</span>
              <button className="btn btn-sm" onClick={() => void db.tasks.update(t.id!, { due: date })}>
                Add
              </button>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}
