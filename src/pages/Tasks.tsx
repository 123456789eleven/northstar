import { useEffect, useMemo, useState } from 'react'
import { Kbd } from '../components/Shortcuts'
import { openShortcuts } from '../components/shortcutsData'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Card, Empty, PageHeader, Skeleton } from '../components/ui'
import KpiStrip from '../components/KpiStrip'
import SidePanel from '../components/SidePanel'
import { useMedia, PHONE_QUERY } from '../components/useMedia'
import { addDays, today } from '../lib/dates'
import { describeCapture, parseTask, type CaptureGoal } from '../lib/capture'
import { TaskRow } from '../features/tasks/TaskRow'
import { TaskForm } from '../features/tasks/TaskEditor'
import { MAX_FOCUS, addTask, completeTask, reopenTask } from '../features/tasks/taskActions'
import { groupForList, groupOpenTasks, queueOrder, selectionAfterRemoval, stepSelection } from '../features/tasks/queue'
import { doneMessage } from '../features/tasks/winCopy'
import { useToast } from '../components/toastContext'
import { useFocusTarget } from '../lib/useFocusParam'
import { FocusBar } from '../features/tasks/FocusBar'
import '../features/tasks/tasks.css'
import '../features/tasks/g2a.css'

export default function Tasks() {
  const d = today()
  const phone = useMedia(PHONE_QUERY)
  const toast = useToast()
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [closed, setClosed] = useState(false)
  const [draft, setDraft] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [note, setNote] = useState('')

  const goalTitle = useMemo(() => new Map((goals ?? []).map((g) => [g.id!, g.title])), [goals])
  const activeGoals = useMemo(
    () => (goals ?? []).filter((g) => g.status === 'active').map((g): CaptureGoal => ({ id: g.id!, title: g.title, area: g.area, horizon: g.horizon })),
    [goals],
  )

  const groups = useMemo(() => groupForList(tasks ?? [], d), [tasks, d])
  const order = useMemo(() => queueOrder(groups), [groups])
  const done = useMemo(() => {
    const cutoff = addDays(d, -14)
    return (tasks ?? [])
      .filter((t) => t.status === 'done' && (t.doneAt ?? '').slice(0, 10) >= cutoff)
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  }, [tasks, d])
  const overdueCount = useMemo(() => groupOpenTasks(tasks ?? [], d).find((g) => g.key === 'overdue')?.tasks.length ?? 0, [tasks, d])
  const todayCount = useMemo(() => (tasks ?? []).filter((t) => t.status === 'open' && t.due === d).length, [tasks, d])

  // Desktop auto-selects the first row; phone opens the sheet only after a tap.
  const current = (tasks ?? []).find((t) => t.id === activeId && (t.status === 'open' || showDone))
  const shownId = current?.id ?? (phone ? null : order[0] ?? null)
  const selected = closed ? undefined : (tasks ?? []).find((t) => t.id === shownId)

  const pick = (id: number | null) => {
    setActiveId(id)
    setClosed(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName) || t.isContentEditable) return
      if (e.key === 'j' || e.key === 'k') {
        const id = stepSelection(order, shownId, e.key === 'j' ? 1 : -1)
        if (id != null) {
          pick(id)
          document.querySelector(`[data-task-id="${id}"]`)?.scrollIntoView({ block: 'nearest' })
        }
      } else if (e.key === 'Enter' && shownId != null) {
        pick(shownId)
      } else if (e.key === 'x' && selected && selected.status === 'open') {
        const sel = selected
        void completeTask(sel).then(() => {
          pick(selectionAfterRemoval(order, sel.id!, order.filter((id) => id !== sel.id)))
          toast({ message: doneMessage(sel.title, (tasks ?? []).filter((t) => t.status === 'done' && (t.doneAt ?? '').slice(0, 10) === d).length + 1), undo: async () => { const f = await db.tasks.get(sel.id!); if (f) await reopenTask(f) } })
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useFocusTarget({
    ready: tasks !== undefined,
    exists: (id) => (tasks ?? []).some((t) => String(t.id) === id),
    reveal: (id) => {
      const t = (tasks ?? []).find((x) => String(x.id) === id)
      if (t?.status === 'done') setShowDone(true)
      pick(t!.id!)
    },
  })

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

  const row = (t: NonNullable<typeof tasks>[number]) => (
    <TaskRow
      key={t.id}
      task={t}
      selected={selected?.id === t.id}
      goalTitle={t.goalId != null ? goalTitle.get(t.goalId) : undefined}
      onEdit={(x) => pick(x.id!)}
      onPinFull={flashFull}
    />
  )

  const loaded = tasks !== undefined

  const quickAdd = (
    <>
      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input className="input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a task, e.g. renew passport in 2w !1" aria-label="New task" />
        <button className="btn btn-primary" type="submit" disabled={!parsed.title}>
          Add
        </button>
      </form>
      {preview.length > 0 && (
        <div className="row wrap" style={{ marginTop: phone ? 0 : -10, marginBottom: phone ? 8 : 14, gap: 4 }}>
          {preview.map((p) => (
            <span key={p} className="chip">
              {p}
            </span>
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      <PageHeader title="Tasks" sub={loaded ? `${order.length} open${overdueCount ? ` · ${overdueCount} overdue` : ''}` : ' '} />

      {!loaded && <div className="skel skel-strip skel-pulse" style={{ marginBottom: 16 }} aria-hidden />}
      {loaded && order.length > 0 && (
        <KpiStrip
          items={[
            { label: 'Open', value: order.length },
            { label: 'Overdue', value: overdueCount, deltaTone: overdueCount ? 'warn' : 'neutral', note: overdueCount ? 'Reschedule or finish' : 'None late' },
            { label: 'Due today', value: todayCount },
            { label: 'Done in 14 days', value: done.length },
          ]}
        />
      )}

      {loaded && <div className="tq-focus"><FocusBar tasks={tasks} d={d} onEdit={(t) => pick(t.id!)} /></div>}

      <div className="tq">
        <div className="tq-main">
          <Card>
            {!phone && quickAdd}
            {note && <div className="focus-note" style={{ marginBottom: 10 }}>{note}</div>}

            {!loaded && <Skeleton rows={8} label="Loading tasks" />}
            {loaded && order.length === 0 && (
              <Empty title={done.length ? 'All clear' : 'No tasks yet'}>
                Type a task in the add line. Add a day (fri, in 3d) and a priority (!1) and it lands in the right group.
              </Empty>
            )}

            {groups.map((g) => (
              <div key={g.key} className="task-section">
                <div className="section-head">
                  <span className={g.tone}>{g.label}</span>
                  <span className="count">{g.tasks.length}</span>
                </div>
                <div className="list">{g.tasks.map(row)}</div>
              </div>
            ))}

            {done.length > 0 && (
              <div className="task-section">
                <div className="section-head">
                  <button className="section-toggle" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
                    {showDone ? 'Hide' : 'Show'} completed
                  </button>
                  <span className="count">{done.length} in the last 14 days</span>
                </div>
                {showDone && <div className="list">{done.map(row)}</div>}
              </div>
            )}
          </Card>
          {!phone && order.length > 0 && (
            <button type="button" className="key-hint tq-keys" onClick={openShortcuts}>
              <span className="sr-only">Keyboard shortcuts: </span><span><Kbd k={['j']} /><Kbd k={['k']} /> move</span><span><Kbd k={['x']} /> complete</span><span><Kbd k={['?']} /> all shortcuts</span>
            </button>
          )}
        </div>

        {selected && (
          <SidePanel
            inline
            title="Task"
            onClose={() => setClosed(true)}
          >
            <TaskForm
              key={selected.id}
              task={selected}
              goals={goals ?? []}
              keepOpen
              onClose={() => setClosed(true)}
              onDeleted={(t) => pick(selectionAfterRemoval(order, t.id!, order.filter((id) => id !== t.id)))}
            />
          </SidePanel>
        )}
      </div>
      {phone && <div className="tq-phone-pad" aria-hidden />}
      {phone && <div className="quick-add-sticky">{quickAdd}</div>}
    </>
  )
}
