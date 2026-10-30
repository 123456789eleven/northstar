import { useMemo, useState, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Task } from '../db'
import { Card, Empty, PageHeader } from '../components/ui'
import { addDays, today } from '../lib/dates'
import { describeCapture, parseTask, type CaptureGoal } from '../lib/capture'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskEditor } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, addTask, byDue } from '../features/tasks/taskActions'
import '../features/tasks/tasks.css'

function Section({ title, tasks, children, tone }: { title: string; tasks: Task[]; children: (t: Task) => ReactNode; tone?: 'warn' }) {
  if (!tasks.length) return null
  return (
    <div className="task-section">
      <div className="section-head">
        <span className={tone}>{title}</span>
        <span className="count">{tasks.length}</span>
      </div>
      <div className="list">{tasks.map(children)}</div>
    </div>
  )
}

export default function Tasks() {
  const d = today()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [editing, setEditing] = useState<Task | null>(null)
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [note, setNote] = useState('')

  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id!, g.title])), [goals])
  const activeGoals = useMemo(
    () => (goals ?? []).filter((g) => g.status === 'active').map((g): CaptureGoal => ({ id: g.id!, title: g.title, area: g.area, horizon: g.horizon })),
    [goals],
  )

  const groups = useMemo(() => {
    const open = (tasks ?? []).filter((t) => t.status === 'open').sort(byDue)
    const wk = addDays(d, 7)
    const cutoff = addDays(d, -14)
    return {
      overdue: open.filter((t) => t.due && t.due < d),
      today: open.filter((t) => t.due === d),
      upcoming: open.filter((t) => t.due && t.due > d && t.due <= wk),
      later: open.filter((t) => t.due && t.due > wk),
      none: open.filter((t) => !t.due).sort((a, b) => a.priority - b.priority || a.createdAt.localeCompare(b.createdAt)),
      done: (tasks ?? [])
        .filter((t) => t.status === 'done' && (t.doneAt ?? '').slice(0, 10) >= cutoff)
        .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
      openCount: open.length,
    }
  }, [tasks, d])

  const parsed = parseTask(draft, { goals: activeGoals })
  const preview = draft.trim() ? describeCapture(parsed).slice(1) : []

  async function add() {
    if (!parsed.title) return
    await addTask(parsed)
    setDraft('')
  }

  function flashFull() {
    setNote(`Today's focus is full (${MAX_FOCUS}). Unpin one first.`)
    window.setTimeout(() => setNote(''), 3500)
  }

  const row = (t: Task) => (
    <TaskRow key={t.id} task={t} goalTitle={t.goalId != null ? goalTitle.get(t.goalId) : undefined} onEdit={setEditing} onPinFull={flashFull} />
  )

  const sub =
    tasks === undefined
      ? ' '
      : `${groups.openCount} open${groups.overdue.length ? ` · ${groups.overdue.length} overdue` : ''}`

  return (
    <>
      <PageHeader title="Tasks" sub={sub} />
      <Card>
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <input
            className="input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a task… 'renew passport in 2w !1'"
            aria-label="New task"
          />
          <button className="btn btn-primary" type="submit" disabled={!parsed.title}>
            Add
          </button>
        </form>
        {preview.length > 0 && (
          <div className="row wrap" style={{ marginTop: -10, marginBottom: 14, gap: 4 }}>
            {preview.map((p) => (
              <span key={p} className="chip">
                {p}
              </span>
            ))}
          </div>
        )}
        {note && <div className="focus-note" style={{ marginBottom: 10 }}>{note}</div>}

        {tasks !== undefined && groups.openCount === 0 && (
          <Empty>
            Nothing open. Type a task above — add a day like "fri" or "in 3d" and a priority like "!1".
          </Empty>
        )}

        <Section title="Overdue" tasks={groups.overdue} tone="warn">{row}</Section>
        <Section title="Today" tasks={groups.today}>{row}</Section>
        <Section title="Next 7 days" tasks={groups.upcoming}>{row}</Section>
        <Section title="Later" tasks={groups.later}>{row}</Section>
        <Section title="No date" tasks={groups.none}>{row}</Section>

        {groups.done.length > 0 && (
          <div className="task-section">
            <div className="section-head">
              <button className="section-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                {showDone ? 'Hide' : 'Show'} completed
              </button>
              <span className="count">{groups.done.length} in last 14 days</span>
            </div>
            {showDone && <div className="list">{groups.done.map(row)}</div>}
          </div>
        )}
      </Card>
      {editing && <TaskEditor task={editing} goals={goals ?? []} onClose={() => setEditing(null)} />}
    </>
  )
}
