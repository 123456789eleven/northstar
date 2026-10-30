import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Card, Empty, PageHeader, Progress } from '../components/ui'
import { formatDate, today } from '../lib/dates'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, byDue, byUrgency, togglePin } from '../features/tasks/taskActions'
import { goalProgress, progressLabel } from '../features/goals/progress'
import { GlanceTiles } from '../features/today/GlanceTiles'
import { InsightsCard } from '../features/insights/InsightsCard'
import '../features/tasks/tasks.css'
import '../features/today/today.css'

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export default function Today() {
  const d = today()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [editing, setEditing] = useState<Task | null>(null)
  const [note, setNote] = useState('')

  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id!, g.title])), [goals])

  const v = useMemo(() => {
    const all = tasks ?? []
    const open = all.filter((t) => t.status === 'open')
    const doneToday = all.filter((t) => t.status === 'done' && t.doneAt && t.doneAt.slice(0, 10) === d)
    const focus = all.filter((t) => t.focusDate === d && (t.status === 'open' || doneToday.includes(t))).sort(byUrgency)
    const suggestions = focus.length ? [] : [...open].sort(byUrgency).slice(0, MAX_FOCUS)
    const overdue = open.filter((t) => t.due && t.due < d).sort(byDue)
    const dueToday = open.filter((t) => t.due === d).sort(byDue)
    const doneDueToday = doneToday.filter((t) => t.due === d || (t.due && t.due < d))
    return { open, focus, suggestions, overdue, dueToday, doneDueToday, doneToday }
  }, [tasks, d])

  const quarter = (goals ?? []).filter((g) => g.status === 'active' && g.horizon === 'quarter')

  const parts = [
    plural(v.dueToday.length, 'task') + ' today',
    v.overdue.length ? `${v.overdue.length} overdue` : '',
    v.doneToday.length ? `${v.doneToday.length} done` : '',
  ].filter(Boolean)

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

  return (
    <>
      <PageHeader
        title={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
        sub={tasks === undefined ? ' ' : parts.join(' · ')}
      />

      <div className="today-grid">
        <div className="today-col">
          <Card
            title="Focus"
            action={
              v.suggestions.length > 1 && (
                <button className="btn btn-ghost btn-sm" onClick={() => void pinAll()}>
                  Pin these
                </button>
              )
            }
          >
            {v.focus.length > 0 ? (
              <div className="list">{v.focus.map(row)}</div>
            ) : v.suggestions.length > 0 ? (
              <>
                <div className="focus-suggest">Nothing pinned. Suggested by priority and due date — tap the pin to commit.</div>
                <div className="list">{v.suggestions.map(row)}</div>
              </>
            ) : (
              tasks !== undefined && <Empty>No open tasks. Type one in the capture bar, e.g. "call dentist tmr !1".</Empty>
            )}
            {note && <div className="focus-note">{note}</div>}
          </Card>

          <Card title="Due today & overdue" action={<Link className="card-link" to="/tasks">All tasks</Link>}>
            {v.overdue.length + v.dueToday.length + v.doneDueToday.length > 0 ? (
              <div className="list">
                {v.overdue.map(row)}
                {v.dueToday.map(row)}
                {v.doneDueToday.map(row)}
              </div>
            ) : (
              tasks !== undefined && <Empty>Nothing due today.</Empty>
            )}
          </Card>
        </div>

        <div className="today-col">
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
                    <Progress value={p.pct} />
                  </Link>
                )
              })
            ) : (
              goals !== undefined && (
                <div className="tile-empty">
                  No quarter goals yet. <Link to="/goals">Set one on Goals</Link> — what would make this quarter a win?
                </div>
              )
            )}
          </Card>
          <InsightsCard />
          <GlanceTiles />
        </div>
      </div>

      {editing && <TaskEditor task={editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
