import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type CalendarEvent, type ISODate } from '../db'
import { Card, PageHeader } from '../components/ui'
import { addDays, formatDate, today } from '../lib/dates'
import { allDayOn, daySegments, weekDates } from '../features/planner/layout'
import { EventModal } from '../features/planner/EventModal'
import { DayGrid, EventButton, HabitLine, PlanPanel, TaskLine } from '../features/planner/PlannerParts'
import '../features/planner/planner.css'

type View = 'week' | 'day'
type Editing = { event: CalendarEvent | null; date: ISODate; start?: string }

export default function Planner() {
  const t = today()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState<ISODate>(t)
  const [editing, setEditing] = useState<Editing | null>(null)

  const events = useLiveQuery(() => db.calendar.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [])
  const people = useLiveQuery(() => db.people.toArray(), [])

  const logSet = useMemo(() => new Set((logs ?? []).map((l) => `${l.habitId}|${l.date}`)), [logs])
  const days = view === 'week' ? weekDates(anchor) : [anchor]
  const step = view === 'week' ? 7 : 1
  const evs = events ?? []

  const title =
    view === 'week'
      ? `${formatDate(days[0])} - ${formatDate(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
      : formatDate(anchor, { weekday: 'long', month: 'long', day: 'numeric' })
  const planDate = view === 'day' ? anchor : t < days[0] || t > days[6] ? days[0] : t
  const nowDate = new Date()
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes()

  const tasksOn = (d: ISODate) => (tasks ?? []).filter((x) => x.due === d)
  const birthdaysOn = (d: ISODate) => (people ?? []).filter((p) => p.birthday === d.slice(5))
  const dailyHabits = (habits ?? []).filter((h) => h.perWeek >= 7)
  const openNew = (date: ISODate, start?: string) => setEditing({ event: null, date, start })

  const dayBody = (d: ISODate) => {
    const allDay = allDayOn(evs, d)
    const timed = daySegments(evs, d)
    const dt = tasksOn(d)
    const bd = birthdaysOn(d)
    const empty = !allDay.length && !timed.length && !dt.length && !bd.length
    return (
      <>
        {allDay.map((e) => <EventButton key={e.id} e={e} onOpen={(x) => setEditing({ event: x, date: x.date })} />)}
        {timed.map((s) => <EventButton key={`${s.event.id}-${s.continued}`} e={s.event} onOpen={(x) => setEditing({ event: x, date: x.date })} />)}
        {dt.map((x) => <TaskLine key={x.id} t={x} />)}
        {bd.map((p) => <div key={p.id} className="pl-note">Birthday: {p.name}</div>)}
        {d >= t && dailyHabits.length > 0 && (
          <div className="pl-note">{dailyHabits.filter((h) => !logSet.has(`${h.id}|${d}`)).length} of {dailyHabits.length} daily habits open</div>
        )}
        {empty && events !== undefined && <div className="pl-empty">Free</div>}
      </>
    )
  }

  return (
    <>
      <PageHeader title="Planner" sub={events === undefined ? ' ' : `${evs.filter((e) => days.includes(e.date)).length} events in view`}actions={<button className="btn btn-primary" onClick={() => openNew(view === 'day' ? anchor : t)}>New event</button>} />

      <div className="pl-bar">
        <button className="btn btn-sm" onClick={() => setAnchor(addDays(anchor, -step))} aria-label="Previous">Prev</button>
        <button className="btn btn-sm" onClick={() => setAnchor(t)}>Today</button>
        <button className="btn btn-sm" onClick={() => setAnchor(addDays(anchor, step))} aria-label="Next">Next</button>
        <span className="pl-title">{title}</span>
        <span className="grow" />
        <div className="pl-toggle" role="group" aria-label="View">
          {(['week', 'day'] as View[]).map((v) => (
            <button key={v} className="btn btn-sm" aria-pressed={view === v} onClick={() => setView(v)}>
              {v === 'week' ? 'Week' : 'Day'}
            </button>
          ))}
        </div>
      </div>

      <div className="pl-main">
        <div style={{ minWidth: 0 }}>
          {view === 'week' ? (
            <div className="pl-week">
              {days.map((d) => (
                <section key={d} className={`pl-day ${d === t ? 'today' : ''}`}>
                  <button className="pl-day-head" onClick={() => { setAnchor(d); setView('day') }} aria-label={`Open ${d}`}>
                    <b>{formatDate(d, { weekday: 'short' })}</b>
                    <span>{formatDate(d, { month: 'short', day: 'numeric' })}</span>
                  </button>
                  {dayBody(d)}
                </section>
              ))}
            </div>
          ) : (
            <Card>
              {allDayOn(evs, anchor).length > 0 && (
                <div className="stack" style={{ marginBottom: 14 }}>
                  {allDayOn(evs, anchor).map((e) => <EventButton key={e.id} e={e} onOpen={(x) => setEditing({ event: x, date: x.date })} />)}
                </div>
              )}
              <DayGrid date={anchor} events={evs} isToday={anchor === t} nowMin={nowMin} onOpen={(x) => setEditing({ event: x, date: x.date })} onNew={(s) => openNew(anchor, s)} />
            </Card>
          )}
        </div>

        <div className="pl-side">
          {view === 'day' && (
            <Card title="Due this day">
              {tasksOn(anchor).length ? tasksOn(anchor).map((x) => <TaskLine key={x.id} t={x} />) : <div className="pl-empty">No tasks due.</div>}
              {dailyHabits.length > 0 && (
                <>
                  <hr className="divider" />
                  {dailyHabits.map((h) => <HabitLine key={h.id} h={h} date={anchor} checked={logSet.has(`${h.id}|${anchor}`)} />)}
                </>
              )}
            </Card>
          )}
          <PlanPanel tasks={tasks ?? []} date={planDate} label={planDate === t ? 'today' : formatDate(planDate, { weekday: 'short', month: 'short', day: 'numeric' })} />
        </div>
      </div>

      {editing && <EventModal event={editing.event} defaults={{ date: editing.date, start: editing.start }} onClose={() => setEditing(null)} />}
    </>
  )
}
