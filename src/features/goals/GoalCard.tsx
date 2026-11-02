import { useState, type ReactNode } from 'react'
import { db, type Goal, type LearningItem, type Task } from '../../db'
import { AREA_LABEL, Progress } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { DUR, prefersReducedMotion } from '../../components/motion'
import { DoneMark } from '../../components/DoneMark'
import { childLabel, nextStepAfterGoal, nextStepAfterMilestone } from './completion'
import { useMedia, PHONE_QUERY } from '../../components/useMedia'
import { formatDate } from '../../lib/dates'
import { TaskRow } from '../tasks/TaskRow'
import { CHILD_HORIZON, HORIZON_LABEL, goalProgress, progressLabel } from './progress'
import { RowMenu } from './GoalMenu'
import { addMilestone, completeGoal, removeMilestone, reopenGoal, setPaused, toggleMilestone, undoMilestone } from './goalActions'

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function GoalCard({
  goal,
  tasks,
  learning,
  onEdit,
  onAddChild,
  onEditTask,
  children,
}: {
  goal: Goal
  tasks: Task[]
  learning: LearningItem[]
  onEdit: (g: Goal) => void
  onAddChild: (g: Goal) => void
  onEditTask: (t: Task) => void
  children?: ReactNode
}) {
  const [adding, setAdding] = useState(false)
  const [ms, setMs] = useState('')
  const [showTasks, setShowTasks] = useState(false)
  const phone = useMedia(PHONE_QUERY)
  const [msOpen, setMsOpen] = useState(false)
  const linked = tasks.filter((t) => t.goalId === goal.id)
  const openLinked = linked.filter((t) => t.status === 'open')
  const learnCount = learning.filter((l) => l.goalId === goal.id).length
  const toast = useToast()
  const [completing, setCompleting] = useState(false)
  const real = goalProgress(goal, tasks)
  // While completing, the bar settles at 100% and the check draws, then the goal moves to Done.
  const p = completing ? { ...real, pct: 100 } : real
  const child = CHILD_HORIZON[goal.horizon]
  const done = goal.status === 'done'

  /** The completion moment: check + bar settle (~0.5s), then save, then a toast with Undo and the next step. */
  async function finish() {
    if (completing || goal.id == null) return
    const id = goal.id
    if (!prefersReducedMotion()) {
      setCompleting(true)
      await new Promise((r) => window.setTimeout(r, DUR.slow + 200))
    }
    const fresh = (await db.goals.get(id)) ?? goal
    await completeGoal(fresh)
    setCompleting(false)
    const step = nextStepAfterGoal(fresh, await db.goals.toArray())
    toast({
      message: `Goal complete: ${goal.title}. ${step.text}`,
      undo: async () => { const f = await db.goals.get(id); if (f) await reopenGoal(f) },
      action: step.kind === 'add-child' ? { label: childLabel(step.parent), run: () => onAddChild(step.parent) } : undefined,
    })
  }

  async function onMilestone(msId: string, title: string, wasDone: boolean) {
    if (goal.id == null) return
    const id = goal.id
    await toggleMilestone(goal, msId)
    if (wasDone) return
    const step = nextStepAfterMilestone(goal, msId)
    toast({
      message: step.allDone ? step.text : `Milestone done: ${title}. ${step.text}`,
      undo: () => undoMilestone(id, msId),
      action: step.allDone && goal.status === 'active' ? { label: 'Complete goal', run: finish } : undefined,
    })
  }
  const hasMs = goal.milestones.length > 0
  const collapsible = phone && hasMs
  const showMs = !collapsible || msOpen || adding

  return (
    <div>
      <article className={`goal goal-${goal.horizon} ${goal.status} ${completing ? 'is-done-moment' : ''}`}>
        <div className="goal-head">
          <div className="grow">
            <div className="goal-title">{completing && <DoneMark />}{goal.title}</div>
            <div className="goal-tags">
              <span className="chip">{AREA_LABEL[goal.area]}</span>
              <span>{HORIZON_LABEL[goal.horizon]}</span>
              {goal.targetDate && !done && <span>by {formatDate(goal.targetDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
              {done && goal.completedAt && <span className="good">Done {formatDate(goal.completedAt.slice(0, 10))}</span>}
              {goal.status === 'paused' && <span>Paused</span>}
            </div>
          </div>
          <div className="goal-actions">
            {done ? (
              <button className="btn btn-sm" onClick={() => void reopenGoal(goal)}>
                Reopen
              </button>
            ) : (
              <button className="btn btn-sm" onClick={() => void finish()} disabled={completing}>
                {completing ? 'Completed' : 'Complete'}
              </button>
            )}
            <RowMenu
              label={`More actions for ${goal.title}`}
              items={[
                { label: 'Edit', onSelect: () => onEdit(goal) },
                ...(!done ? [{ label: 'Add milestone', onSelect: () => setAdding(true) }] : []),
                ...(child && !done ? [{ label: `Add ${HORIZON_LABEL[child].toLowerCase()} goal`, onSelect: () => onAddChild(goal) }] : []),
                ...(openLinked.length ? [{ label: showTasks ? 'Hide linked tasks' : `Show linked tasks (${openLinked.length} open)`, onSelect: () => setShowTasks((v) => !v) }] : []),
                ...(!done ? [{ label: goal.status === 'paused' ? 'Resume' : 'Pause', onSelect: () => void setPaused(goal, goal.status !== 'paused') }] : []),
              ]}
            />
          </div>
        </div>

        {goal.why && <div className="goal-why">{goal.why}</div>}

        {(p.basis !== 'none' || collapsible) &&
          (collapsible ? (
            <button type="button" className="goal-progress goal-progress-btn" aria-expanded={msOpen} onClick={() => setMsOpen((v) => !v)}>
              {p.basis !== 'none' ? <Progress value={p.pct} label={`${goal.title} progress`} /> : <span className="grow" />}
              <span className="goal-progress-label">{p.basis !== 'none' ? progressLabel(p) : `${goal.milestones.length} milestones`}</span>
              <span className="goal-chev" aria-hidden>{msOpen ? '−' : '+'}</span>
            </button>
          ) : (
            <div className="goal-progress">
              <Progress value={p.pct} label={`${goal.title} progress`} />
              <span className="goal-progress-label">{progressLabel(p)}</span>
            </div>
          ))}

        {hasMs && showMs && (
          <div className="ms-list">
            {goal.milestones.map((m) => (
              <div key={m.id} className={`ms-row ${m.done ? 'done' : ''}`}>
                <label className="check-hit">
                  <input type="checkbox" className="check" checked={m.done} onChange={() => void onMilestone(m.id, m.title, m.done)} aria-label={m.title} />
                </label>
                <span className="ms-title">{m.title}</span>
                <button className="icon-btn" aria-label={`Remove milestone ${m.title}`} title="Remove" onClick={() => void removeMilestone(goal, m.id)}>
                  <XIcon />
                </button>
              </div>
            ))}
          </div>
        )}

        {adding && (
          <form
            className="ms-add"
            onSubmit={(e) => {
              e.preventDefault()
              void addMilestone(goal, ms).then(() => setMs(''))
            }}
          >
            <input
              className="input"
              value={ms}
              onChange={(e) => setMs(e.target.value)}
              placeholder="Milestone, then Enter"
              autoFocus
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              onBlur={() => !ms.trim() && setAdding(false)}
            />
          </form>
        )}

        {showTasks && openLinked.length > 0 && (
          <div className="list" style={{ marginTop: 8 }}>
            {openLinked.map((t) => (
              <TaskRow key={t.id} task={t} onEdit={onEditTask} showPin={false} />
            ))}
          </div>
        )}

        {(linked.length > 0 || learnCount > 0) && (
          <div className="goal-foot">
            {linked.length > 0 && (
              <span className="tiny faint">
                {linked.length} task{linked.length === 1 ? '' : 's'}
                {openLinked.length ? `, ${openLinked.length} open` : ''}
              </span>
            )}
            {learnCount > 0 && (
              <span className="tiny faint">
                {learnCount} learning item{learnCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </article>
      {children}
    </div>
  )
}
