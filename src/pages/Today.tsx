import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Card, Empty, Progress, Skeleton } from '../components/ui'
import { today } from '../lib/dates'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, byDue } from '../features/tasks/taskActions'
import { buildTodayView } from '../features/today/todayQueue'
import { goalProgress, progressLabel } from '../features/goals/progress'
import { GlanceTiles } from '../features/today/GlanceTiles'
import { HabitsTile, NextUp } from '../features/today/HabitsNext'
import { FirstRunCard } from '../features/onboarding/FirstRunCard'
import { InsightsCard } from '../features/insights/InsightsCard'
import { Pulse } from '../features/today/Pulse'
import { TodayHero } from '../features/town/TodayHero'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { FocusBar } from '../features/tasks/FocusBar'
import { AgendaStrip } from '../features/today/AgendaStrip'
import { DailyFind } from '../features/today/DailyFindLine'
import '../features/tasks/tasks.css'
import '../features/tasks/g2a.css'
import '../features/today/today.css'
import '../features/today/g2a.css'
import '../features/space/space.css'
import '../features/town/town.css'
import { BadgeWatcher } from '../features/badges/BadgeWatcher'

export default function Today() {
  const d = today()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const habits = useLiveQuery(() => db.habits.filter((h) => !h.archived).toArray(), [])
  const habitLogs = useLiveQuery(() => db.habitLogs.where('date').equals(d).toArray(), [d])
  const [editing, setEditing] = useState<Task | null>(null)
  const [note, setNote] = useState('')

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
        setNote(`Focus holds ${MAX_FOCUS}, and that's the point. Unpin one to make room.`)
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
          No quarter goal yet. <Link to="/goals">Set one on Goals</Link>: what would make this quarter worth it?
        </div>
      )
    )}
  </Card>
  )

  const listed = dueList.length + v.done.length
  const counts = loaded ? { open: v.openCount, overdue: v.overdueCount, doneToday: v.doneTodayCount, habitsLeft: habitsOpen } : null

  const hero = (
    <>
      <FirstRunCard />
      <BadgeWatcher />
      <TodayHero counts={counts} />
    </>
  )

  const focusAgenda = loaded ? (
    <div key="fa" className="card floor-card today-merge">
      <FocusBar tasks={tasks} d={d} onEdit={setEditing} bare />
      <AgendaStrip bare />
    </div>
  ) : null

  const day = (
    <FloorCard key="day" title="Your day" action={<Link className="card-link" to="/tasks">All tasks</Link>}>
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
        <Empty title="Nothing due today" action={<button className="btn btn-sm" onClick={() => window.dispatchEvent(new Event('ns:capture'))}>Add a task</button>}>
          The day is yours. Type one into the capture line, like "call dentist tmr !1", or press / to jump there.
        </Empty>
      )}
      {note && <div className="focus-note">{note}</div>}
    </FloorCard>
  )

  const more = (
    <FloorMore
      floor="Today"
      items={[
        { id: 'quarter', label: 'This quarter', value: quarter.length || undefined, panel: <div className="stack">{quarterCard}</div> },
        { id: 'next', label: 'Next up', panel: <div className="stack"><NextUp /></div> },
        { id: 'life', label: 'Across your life', panel: <div className="stack"><Pulse /><GlanceTiles /></div> },
        { id: 'insights', label: 'Insights', panel: <div className="stack"><DailyFind /><InsightsCard /></div> },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Today" className="town-floor" hero={hero} support={[focusAgenda, day, <HabitsTile key="habits" />]} more={more} />
      {editing && <TaskEditor task={editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
