import type { ReactNode } from 'react'
import type { CalendarEvent, Habit, ISODate, Task } from '../../db'
import { formatDate } from '../../lib/dates'
import { db } from '../../db'
import { Card, Empty } from '../../components/ui'
import { toggleDone } from '../tasks/taskActions'
import { useHabitCheckIn } from '../habits/useHabitCheckIn'
import { isGoogleEvent } from '../gcal/help'
import '../gcal/gcal.css'
import { DAY_MIN, allDayOn, daySegments, fmtTime, hourRange, layoutSegments, timeLabel } from './layout'

const PX_PER_HOUR = 48

export function EventButton({ e, onOpen }: { e: CalendarEvent; onOpen: (e: CalendarEvent) => void }) {
  const allDay = e.allDay || !e.start
  return (
    <button className={`pl-ev ${allDay ? 'allday' : ''}`} onClick={() => onOpen(e)}>
      <span className="pl-ev-title">{e.title}{isGoogleEvent(e) && <span className="gcal-src" title="Imported from Google Calendar">Google</span>}</span>
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
  const tick = useHabitCheckIn()
  return (
    <div className={`pl-task ${checked ? 'done' : ''}`}>
      <label className="hb-check">
        <input type="checkbox" className="check" checked={checked} onChange={() => void tick(h, date)} aria-label={`${h.name} on ${date}`} />
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
          <span className="pl-ev-title">{p.event.title}{isGoogleEvent(p.event) && <span className="gcal-src" title="Imported from Google Calendar">Google</span>}</span>
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
        <Empty>Nothing to place. High-priority tasks without a due date show up here, ready to drop into {label}.</Empty>
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

/**
 * Week time axis (wide screens): day heads, an all-day lane on top (all-day events, tasks due, birthdays), then one shared
 * hour axis with each day as a column and a now-line across today's column. Clicking an empty hour starts an event there.
 */
export function WeekGrid({ days, today, events, nowMin, allDayExtras, onOpen, onNew, onOpenDay }: {
  days: ISODate[]; today: ISODate; events: CalendarEvent[]; nowMin: number
  allDayExtras: (d: ISODate) => ReactNode
  onOpen: (e: CalendarEvent) => void; onNew: (d: ISODate, start: string) => void; onOpenDay: (d: ISODate) => void
}) {
  const perDay = days.map((d) => ({ d, segs: daySegments(events, d) }))
  const [lo, hi] = hourRange(perDay.flatMap((x) => x.segs))
  const hours = Array.from({ length: hi - lo }, (_, i) => lo + i)
  const y = (min: number) => ((min - lo * 60) / 60) * PX_PER_HOUR
  return (
    <div className="card pl-wk" role="group" aria-label="Week schedule">
      <div className="pl-wk-row pl-wk-heads">
        <span />
        {days.map((d) => (
          <button key={d} className={`pl-wk-head ${d === today ? 'today' : ''}`} onClick={() => onOpenDay(d)} aria-label={`${formatDate(d, { weekday: 'short' })} ${formatDate(d, { month: 'short', day: 'numeric' })}, open day view`}>
            <b>{formatDate(d, { weekday: 'short' })}</b> <span>{formatDate(d, { month: 'short', day: 'numeric' })}</span>
          </button>
        ))}
      </div>
      <div className="pl-wk-row pl-wk-allday">
        <span className="pl-wk-axis-label">All day</span>
        {days.map((d) => (
          <div key={d} className={`pl-wk-cell ${d === today ? 'today' : ''}`}>
            {allDayOn(events, d).map((e) => <EventButton key={e.id} e={e} onOpen={onOpen} />)}
            {allDayExtras(d)}
          </div>
        ))}
      </div>
      <div className="pl-wk-row pl-wk-timed">
        <div className="pl-wk-axis" style={{ height: hours.length * PX_PER_HOUR }}>
          {hours.map((h) => <i key={h} style={{ top: (h - lo) * PX_PER_HOUR }}>{fmtTime(h * 60)}</i>)}
        </div>
        {perDay.map(({ d, segs }) => {
          const placed = layoutSegments(segs)
          const isToday = d === today
          return (
            <div
              key={d}
              className={`pl-wk-col ${isToday ? 'today' : ''}`}
              style={{ height: hours.length * PX_PER_HOUR }}
              onClick={(ev) => {
                if (ev.target !== ev.currentTarget) return
                const rect = ev.currentTarget.getBoundingClientRect()
                onNew(d, `${String(Math.min(23, lo + Math.floor((ev.clientY - rect.top) / PX_PER_HOUR))).padStart(2, '0')}:00`)
              }}
            >
              {hours.slice(1).map((h) => <div key={h} className="pl-wk-line" style={{ top: (h - lo) * PX_PER_HOUR }} aria-hidden />)}
              {placed.map((p) => (
                <button
                  key={`${p.event.id}-${p.continued}`}
                  className="pl-ev"
                  style={{ top: y(p.start), height: Math.max(22, y(p.end) - y(p.start) - 2), left: `${(p.col / p.cols) * 100}%`, width: `calc(${100 / p.cols}% - 3px)` }}
                  onClick={() => onOpen(p.event)}
                >
                  <span className="pl-ev-title">{p.event.title}</span>
                  <small>{p.continued ? `Until ${fmtTime(p.end)}` : timeLabel(p.event)}</small>
                </button>
              ))}
              {isToday && nowMin >= lo * 60 && nowMin <= Math.min(DAY_MIN, hi * 60) && <div className="pl-now" style={{ top: y(nowMin) }} aria-hidden />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
