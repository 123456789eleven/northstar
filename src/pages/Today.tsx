import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Card, Empty, PageHeader, Progress, Skeleton } from '../components/ui'
import KpiStrip from '../components/KpiStrip'
import { addDays, formatDate, today } from '../lib/dates'
import { useNow } from '../components/useNow'
import { fmtTime, sortedUpcoming, toMin } from '../features/planner/layout'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, byDue } from '../features/tasks/taskActions'
import { buildTodayView } from '../features/today/todayQueue'
import { goalProgress, progressLabel } from '../features/goals/progress'
import { GlanceTiles } from '../features/today/GlanceTiles'
import { HabitsTile, NextUp } from '../features/today/HabitsNext'
import { FirstRunCard } from '../features/onboarding/FirstRunCard'
import { InsightsCard } from '../features/insights/InsightsCard'
import { MissionBoard } from '../features/game/ui/Mission'
import { Pulse } from '../features/today/Pulse'
import { FocusBar } from '../features/tasks/FocusBar'
import { AgendaStrip } from '../features/today/AgendaStrip'
import { DailyFind } from '../features/today/DailyFindLine'
import '../features/tasks/tasks.css'
import '../features/tasks/g2a.css'
import '../features/today/today.css'
import '../features/today/g2a.css'

export default function Today() {
  const d = today()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const habitLogs = useLiveQuery(() => db.habitLogs.where('date').equals(d).toArray(), [d])
  const [editing, setEditing] = useState<Task | null>(null)
  const [note, setNote] = useState('')

  const events = useLiveQuery(() => db.calendar.where('date').between(d, addDays(d, 1), true, true).toArray(), [d])
  const now = useNow()
  const nextEvent = events ? sortedUpcoming(events, d, now.getHours() * 60 + now.getMinutes())[0] : undefined
  const nextEv = nextEvent
    ? `${nextEvent.title}, ${nextEvent.date === d ? 'today' : 'tomorrow'}${nextEvent.allDay || !nextEvent.start ? '' : ` ${fmtTime(toMin(nextEvent.start))}`}`
    : ''

  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id!, g.title])), [goals])
  const v = useMemo(() => buildTodayView(tasks ?? [], d), [tasks, d])
  const quarter = (goals ?? []).filter((g) => g.status === 'active' && g.horizon === 'quarter')

  const habitsDone = new Set((habitLogs ?? []).map((l) => l.habitId))
  const habitsOpen = (habits ?? []).filter((h) => !habitsDone.has(h.id!)).length
  const loaded = tasks !== undefined && goals !== undefined && habits !== undefined

  const row = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      goalTitle={t.goalId != null ? goalTitle.get(t.goalId) : undefined}
      onEdit={setEditing}
      onPinFull={() => {
        setNote(`Focus holds ${MAX_FOCUS}. Unpin one first.`)
        window.setTimeout(() => setNote(''), 3500)
      }}
    />
  )

  const dueList = useMemo(() => (tasks ?? []).filter((t) => t.status === 'open' && !!t.due && t.due <= d && t.focusDate !== d).sort(byDue), [tasks, d])

  const quarterCard = (
  <Card title="This quarter" action={<Link className="card-link" to="/goals">Goals</Link>}>
    {quarter.length > 0 ? (
      quarter.map((g) => {
        const p = goalProgress(g, tasks ?? [])
        return (
          <Link key={g.id} to="/goals" className="qgoal">
            <div className="qgoal-head">
              <span>{g.title}</span>
              <span className="faint">{progressLabel(p)}</span>
            </div>
            <Progress value={p.pct} label={`${g.title} progress`} />
          </Link>
        )
      })
    ) : (
      goals !== undefined && (
        <div className="tile-empty">
          No quarter goals yet. <Link to="/goals">Set one on Goals</Link>: what would make this quarter a win?
        </div>
      )
    )}
  </Card>
  )

  const listed = dueList.length + v.done.length

  return (
    <>
      <PageHeader
        title={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
        sub={loaded ? `${v.openCount} open${v.overdueCount ? ` · ${v.overdueCount} overdue` : ' · none overdue'}${nextEv ? ` · Next: ${nextEv}` : ''}` : ' '}
      />

      <FirstRunCard />

      {/* Today's plan: items tick themselves off from real logs. */}
      <MissionBoard />
      <Pulse />

      {loaded && (
        <div className="today-top">
          <FocusBar tasks={tasks} d={d} onEdit={setEditing} />
          <AgendaStrip />
        </div>
      )}

      {!loaded && <div className="skel skel-strip skel-pulse kpi-skel" aria-hidden />}

      <div className="today-grid">
        <div className="today-col">
          <Card title="Your day" action={<Link className="card-link" to="/tasks">All tasks</Link>}>
            {dueList.length > 0 && (
              <>
                <div className="sub-head">Due today and overdue</div>
                <div className="list">{dueList.map(row)}</div>
              </>
            )}
            {v.done.length > 0 && (
              <>
                <div className="sub-head">Done today</div>
                <div className="list">{v.done.map(row)}</div>
              </>
            )}
            {!loaded && <Skeleton rows={5} label="Loading your day" />}
            {loaded && listed === 0 && (
              <Empty
                title="Nothing due today"
                action={<button className="btn btn-sm" onClick={() => window.dispatchEvent(new Event('ns:capture'))}>Add a task</button>}
              >
                Type one into the capture line, e.g. "call dentist tmr !1". Press / to jump there.
              </Empty>
            )}
            {note && <div className="focus-note">{note}</div>}
          </Card>
        </div>
        <div className="today-col">
          <HabitsTile />
        </div>
      </div>

      <details className="card today-more">
        <summary><span>More</span><span className="faint">Counts, quarter goals, insights, across your life</span></summary>
        <div className="today-more-body">
          <DailyFind />
          {loaded && (
            <KpiStrip
              items={[
                { label: 'Due today', value: v.dueTodayCount, to: '/tasks' },
                { label: 'Overdue', value: v.overdueCount, deltaTone: v.overdueCount ? 'warn' : 'neutral', note: v.overdueCount ? 'Needs a new date' : 'None late', to: '/tasks' },
                { label: 'Done today', value: v.doneTodayCount },
                { label: 'Habits left', value: habitsOpen, note: `of ${habits.length}`, to: '/habits' },
              ]}
            />
          )}
          {quarterCard}
          <NextUp />
          <InsightsCard />
          <GlanceTiles />
        </div>
      </details>

      {editing && <TaskEditor task={editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
