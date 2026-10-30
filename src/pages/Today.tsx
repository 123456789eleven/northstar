import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Card, Empty, PageHeader, Progress } from '../components/ui'
import KpiStrip from '../components/KpiStrip'
import { useMedia, PHONE_QUERY } from '../components/useMedia'
import { formatDate, today } from '../lib/dates'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, togglePin } from '../features/tasks/taskActions'
import { buildTodayView } from '../features/today/todayQueue'
import { goalProgress, progressLabel } from '../features/goals/progress'
import { GlanceTiles } from '../features/today/GlanceTiles'
import { HabitsTile, NextUp } from '../features/today/HabitsNext'
import { FirstRunCard } from '../features/onboarding/FirstRunCard'
import { InsightsCard } from '../features/insights/InsightsCard'
import '../features/tasks/tasks.css'
import '../features/today/today.css'

export default function Today() {
  const d = today()
  const phone = useMedia(PHONE_QUERY)
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
        setNote(`Focus holds ${MAX_FOCUS}. Unpin one first.`)
        window.setTimeout(() => setNote(''), 3500)
      }}
    />
  )

  const pinAll = async () => {
    for (const t of v.suggestions) await togglePin(t)
  }

  const listed = v.focus.length + v.suggestions.length + v.due.length + v.done.length

  return (
    <>
      <PageHeader
        title={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
        sub={loaded ? `${v.openCount} open${v.overdueCount ? ` · ${v.overdueCount} overdue` : ''}` : ' '}
      />

      <FirstRunCard />

      {(
        <>
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

          <div className="today-grid">
            <div className="today-col">
              <Card title="Your day" action={<Link className="card-link" to="/tasks">All tasks</Link>}>
                {v.focus.length > 0 && (
                  <>
                    <div className="sub-head">Focus</div>
                    <div className="list">{v.focus.map(row)}</div>
                  </>
                )}
                {v.suggestions.length > 0 && (
                  <>
                    <div className="sub-head row-between">
                      <span>Suggested focus</span>
                      {v.suggestions.length > 1 && (
                        <button className="btn btn-ghost btn-sm" onClick={() => void pinAll()}>
                          Pin these
                        </button>
                      )}
                    </div>
                    <div className="focus-suggest">Nothing pinned yet. Chosen by priority and due date; tap the pin to commit.</div>
                    <div className="list">{v.suggestions.map(row)}</div>
                  </>
                )}
                {v.due.length > 0 && (
                  <>
                    <div className="sub-head">Due today and overdue</div>
                    <div className="list">{v.due.map(row)}</div>
                  </>
                )}
                {v.done.length > 0 && (
                  <>
                    <div className="sub-head">Done today</div>
                    <div className="list">{v.done.map(row)}</div>
                  </>
                )}
                {loaded && listed === 0 && <Empty>No open tasks. Press / and type one, e.g. "call dentist tmr !1".</Empty>}
                {note && <div className="focus-note">{note}</div>}
              </Card>
            </div>

            <div className="today-col">
              {phone && (
                <>
                  <HabitsTile />
                  <NextUp />
                  <details className="card today-more">
                    <summary>More: quarter goals, insights, across your life</summary>
                    <div className="today-more-body">
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
                      <InsightsCard />
                      <GlanceTiles />
                    </div>
                  </details>
                </>
              )}
              {!phone && (
                <>
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
                  <NextUp />
                  <HabitsTile />
                  <InsightsCard />
                  <GlanceTiles />
                </>
              )}
            </div>
          </div>
        </>
      )}

      {editing && <TaskEditor task={editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
