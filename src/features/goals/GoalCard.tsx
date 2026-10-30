import { useState, type ReactNode } from 'react'
import type { Goal, LearningItem, Task } from '../../db'
import { AREA_LABEL, Progress } from '../../components/ui'
import { formatDate } from '../../lib/dates'
import { TaskRow } from '../tasks/TaskRow'
import { CHILD_HORIZON, HORIZON_LABEL, goalProgress, progressLabel } from './progress'
import { addMilestone, completeGoal, removeMilestone, reopenGoal, setPaused, toggleMilestone } from './goalActions'

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
  const linked = tasks.filter((t) => t.goalId === goal.id)
  const openLinked = linked.filter((t) => t.status === 'open')
  const learnCount = learning.filter((l) => l.goalId === goal.id).length
  const p = goalProgress(goal, tasks)
  const child = CHILD_HORIZON[goal.horizon]
  const done = goal.status === 'done'

  return (
    <div>
      <article className={`goal ${goal.status}`}>
        <div className="goal-head">
          <div className="grow">
            <div className="goal-title">{goal.title}</div>
            <div className="goal-tags">
              <span className="chip">{AREA_LABEL[goal.area]}</span>
              <span>{HORIZON_LABEL[goal.horizon]}</span>
              {goal.targetDate && !done && <span>by {formatDate(goal.targetDate, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
              {done && goal.completedAt && <span className="good">Done {formatDate(goal.completedAt.slice(0, 10))}</span>}
              {goal.status === 'paused' && <span>Paused</span>}
            </div>
          </div>
          <div className="goal-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => onEdit(goal)}>
              Edit
            </button>
            {done ? (
              <button className="btn btn-sm" onClick={() => void reopenGoal(goal)}>
                Reopen
              </button>
            ) : (
              <button className="btn btn-sm" onClick={() => void completeGoal(goal)}>
                Complete
              </button>
            )}
          </div>
        </div>

        {goal.why && <div className="goal-why">{goal.why}</div>}

        <div className="goal-progress">
          <Progress value={p.pct} />
          <span className="goal-progress-label">{progressLabel(p)}</span>
        </div>

        {goal.milestones.length > 0 && (
          <div className="ms-list">
            {goal.milestones.map((m) => (
              <div key={m.id} className={`ms-row ${m.done ? 'done' : ''}`}>
                <label className="check-hit">
                  <input type="checkbox" className="check" checked={m.done} onChange={() => void toggleMilestone(goal, m.id)} aria-label={m.title} />
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

        <div className="goal-foot">
          {!done && (
            <button className="link-btn" onClick={() => setAdding(true)}>
              + Milestone
            </button>
          )}
          {child && !done && (
            <button className="link-btn" onClick={() => onAddChild(goal)}>
              + {HORIZON_LABEL[child]} goal
            </button>
          )}
          {linked.length > 0 && (
            <button className="link-btn" onClick={() => setShowTasks((v) => !v)} aria-expanded={showTasks} disabled={!openLinked.length}>
              {linked.length} task{linked.length === 1 ? '' : 's'}
              {openLinked.length ? ` (${openLinked.length} open)` : ''}
            </button>
          )}
          {learnCount > 0 && (
            <span className="tiny faint">
              {learnCount} learning item{learnCount === 1 ? '' : 's'}
            </span>
          )}
          {!done && (
            <button className="link-btn" onClick={() => void setPaused(goal, goal.status !== 'paused')}>
              {goal.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          )}
        </div>
      </article>
      {children}
    </div>
  )
}
