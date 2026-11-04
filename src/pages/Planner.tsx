import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, setSetting, type CalendarEvent, type ISODate } from '../db'
import { Link } from 'react-router-dom'
import { Card, PageHeader } from '../components/ui'
import { useMedia, PHONE_QUERY } from '../components/useMedia'
import { useNow } from '../components/useNow'
import { addDays, formatDate, today } from '../lib/dates'
import { useFocusTarget } from '../lib/useFocusParam'
import { allDayOn, daySegments, weekDates } from '../features/planner/layout'
import { EventModal } from '../features/planner/EventModal'
import { DayGrid, EventButton, HabitLine, PlanPanel, TaskLine, TaskTray, WeekGrid } from '../features/planner/PlannerParts'
import { BlockDialog, type BlockDefaults } from '../features/planner/BlockDialog'
import { useBlocks } from '../features/planner/useBlocks'
import { blockMeta, conflictIds } from '../features/planner/timeBlock'
import type { BlockOps } from '../features/planner/GridEvent'
import { GCAL_DISMISS_KEY } from '../features/gcal/help'
import '../features/gcal/gcal.css'
import '../features/planner/planner.css'
import '../features/planner/g2a.css'

type View = 'week' | 'day'
type Editing = { event: CalendarEvent | null; date: ISODate; start?: string }

export default function Planner() {
  const t = today()
  const wide = useMedia('(min-width: 1240px)')
  const phone = useMedia(PHONE_QUERY)
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches ? 'day' : 'week'))
  const [blockEd, setBlockEd] = useState<{ event: CalendarEvent | null; defaults: BlockDefaults } | null>(null)
  const api = useBlocks()
  const [anchor, setAnchor] = useState<ISODate>(t)
  const [editing, setEditing] = useState<Editing | null>(null)

  const showGcalPrompt = useLiveQuery(async () => {
    const [st, dismissed] = await Promise.all([getSetting<{ state?: string }>('gcal.status', { state: 'off' }), getSetting<boolean>(GCAL_DISMISS_KEY, false)])
    return (st.state ?? 'off') === 'off' && !dismissed
  }, [], false)
  const events = useLiveQuery(() => db.calendar.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const logs = useLiveQuery(() => db.habitLogs.toArray(), [])
  const people = useLiveQuery(() => db.people.toArray(), [])

  const logSet = useMemo(() => new Set((logs ?? []).map((l) => `${l.habitId}|${l.date}`)), [logs])
  const days = view === 'week' ? weekDates(anchor) : [anchor]
  const step = view === 'week' ? 7 : 1
  const evs = useMemo(() => events ?? [], [events])

  const title =
    view === 'week'
      ? `${formatDate(days[0])} - ${formatDate(days[6], { month: 'short', day: 'numeric', year: 'numeric' })}`
      : formatDate(anchor, { weekday: 'long', month: 'long', day: 'numeric' })
  const planDate = view === 'day' ? anchor : t < days[0] || t > days[6] ? days[0] : t
  const nowDate = useNow()
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes()

  const tasksOn = (d: ISODate) => (tasks ?? []).filter((x) => x.due === d)
  const birthdaysOn = (d: ISODate) => (people ?? []).filter((p) => p.birthday === d.slice(5))
  const dailyHabits = (habits ?? []).filter((h) => h.perWeek >= 7)
  const habitsOpenToday = dailyHabits.filter((h) => !logSet.has(`${h.id}|${t}`)).length
  const openNew = (date: ISODate, start?: string) => setEditing({ event: null, date, start })
  const openEvent = (x: CalendarEvent) => (blockMeta(x) ? setBlockEd({ event: x, defaults: { date: x.date } }) : setEditing({ event: x, date: x.date }))
  const openBlock = (date: ISODate, start?: string, taskId?: number) => setBlockEd({ event: null, defaults: { date, start, taskId } })
  const ops: BlockOps = (() => {
    const conflicts = new Set<number>()
    for (const d of days) for (const id of conflictIds(evs, d)) conflicts.add(id)
    return {
      conflicts,
      onMove: (e, date, startMin) => void api.move(e, date, startMin),
      onResize: (e, endMin) => void api.resize(e, endMin),
      onDropTask: (date, startMin, taskId) => {
        const t = (tasks ?? []).find((x) => x.id === taskId)
        if (t) void api.drop(t, date, startMin)
      },
    }
  })()
  const linkedTasks = useMemo(() => new Set(evs.map((e) => blockMeta(e)?.taskId).filter((x): x is number => x != null)), [evs])

  useFocusTarget({
    ready: events !== undefined,
    exists: (id) => evs.some((e) => e.date === id),
    reveal: (id) => { setAnchor(id); setView('week') },
  })

  const dayBody = (d: ISODate) => {
    const allDay = allDayOn(evs, d)
    const timed = daySegments(evs, d)
    const dt = tasksOn(d)
    const bd = birthdaysOn(d)
    const empty = !allDay.length && !timed.length && !dt.length && !bd.length
    return (
      <>
        {allDay.map((e) => <EventButton key={e.id} e={e} onOpen={(x) => openEvent(x)} />)}
        {timed.map((s) => <EventButton key={`${s.event.id}-${s.continued}`} e={s.event} onOpen={(x) => openEvent(x)} />)}
        {dt.map((x) => <TaskLine key={x.id} t={x} />)}
        {bd.map((p) => <div key={p.id} className="pl-note">Birthday: {p.name}</div>)}
        {empty && events !== undefined && <div className="pl-empty">Free</div>}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Planner" sub={events === undefined ? ' ' : `${evs.filter((e) => days.includes(e.date)).length} events in view${habitsOpenToday ? ` · ${habitsOpenToday} daily ${habitsOpenToday === 1 ? 'habit' : 'habits'} open today` : ''}`}
        actions={(
          <>
            <button className="btn" onClick={() => openBlock(view === 'day' ? anchor : t)}>{phone ? 'Add block' : 'Block time'}</button>
            <button className="btn btn-primary" onClick={() => openNew(view === 'day' ? anchor : t)}>New event</button>
          </>
        )}
      />

      {showGcalPrompt && (
        <div className="gcal-prompt">
          <span>Want your Google Calendar here? Read-only, stays on this device.</span>
          <Link className="btn btn-sm" to="/data#gcal">Connect Google Calendar</Link>
          <button className="btn btn-sm btn-ghost" onClick={() => void setSetting(GCAL_DISMISS_KEY, true)}>Dismiss</button>
        </div>
      )}

      <div className="pl-bar">
        <button className="btn btn-sm" onClick={() => setAnchor(addDays(anchor, -step))} aria-label="Previous period">Previous</button>
        <button className="btn btn-sm" onClick={() => setAnchor(t)}>Today</button>
        <button className="btn btn-sm" onClick={() => setAnchor(addDays(anchor, step))} aria-label="Next period">Next</button>
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

      <div className={`pl-main ${view}`}>
        <div style={{ minWidth: 0 }}>
          {view === 'week' && wide ? (
            <WeekGrid
              days={days} today={t} events={evs} nowMin={nowMin}
              allDayExtras={(d) => (<>{tasksOn(d).map((x) => <TaskLine key={x.id} t={x} />)}{birthdaysOn(d).map((p) => <div key={p.id} className="pl-note">Birthday: {p.name}</div>)}</>)}
              onOpen={(x) => openEvent(x)} onNew={(d, s) => openNew(d, s)} onOpenDay={(d) => { setAnchor(d); setView('day') }} ops={ops}
            />
          ) : view === 'week' ? (
            <div className="pl-week">
              {days.map((d) => (
                <section key={d} data-focus-id={d} className={`pl-day ${d === t ? 'today' : ''}`}>
                  <button className="pl-day-head" onClick={() => { setAnchor(d); setView('day') }} aria-label={`${formatDate(d, { weekday: 'short' })} ${formatDate(d, { month: 'short', day: 'numeric' })}, open day view`}>
                    <b>{formatDate(d, { weekday: 'short' })}</b>{' '}
                    <span>{formatDate(d, { month: 'short', day: 'numeric' })}</span>
                  </button>
                  <div className="pl-day-body">{dayBody(d)}</div>
                </section>
              ))}
            </div>
          ) : (
            <Card>
              {allDayOn(evs, anchor).length > 0 && (
                <div className="stack" style={{ marginBottom: 14 }}>
                  {allDayOn(evs, anchor).map((e) => <EventButton key={e.id} e={e} onOpen={(x) => openEvent(x)} />)}
                </div>
              )}
              <DayGrid date={anchor} events={evs} isToday={anchor === t} nowMin={nowMin} onOpen={(x) => openEvent(x)} onNew={(s) => openNew(anchor, s)} ops={ops} />
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
          {!phone && <TaskTray tasks={tasks ?? []} linked={linkedTasks} onBlock={(t) => openBlock(planDate, undefined, t.id)} />}
          <PlanPanel tasks={tasks ?? []} date={planDate} label={planDate === t ? 'today' : formatDate(planDate, { weekday: 'short', month: 'short', day: 'numeric' })} />
        </div>
      </div>

      {blockEd && <BlockDialog block={blockEd.event} defaults={blockEd.defaults} tasks={tasks ?? []} phone={phone} api={api} onClose={() => setBlockEd(null)} />}
      {editing && <EventModal event={editing.event} defaults={{ date: editing.date, start: editing.start }} onClose={() => setEditing(null)} />}
    </>
  )
}
