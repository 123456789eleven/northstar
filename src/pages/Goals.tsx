import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, type Area, type Goal, type Task } from '../db'
import { AREA_LABEL, Card, Empty, PageHeader, Skeleton, Tabs } from '../components/ui'
import { GoalCard } from '../features/goals/GoalCard'
import { GoalEditor } from '../features/goals/GoalEditor'
import { CHILD_HORIZON } from '../features/goals/progress'
import { TaskEditor } from '../features/tasks/TaskEditor'
import '../features/tasks/tasks.css'
import '../features/goals/goals.css'

type StatusFilter = 'active' | 'paused' | 'done' | 'all'
const RANK: Record<Goal['horizon'], number> = { life: 0, year: 1, quarter: 2 }

export default function Goals() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const learning = useLiveQuery(() => db.learning.toArray(), [])
  const [area, setArea] = useState<Area | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [editing, setEditing] = useState<Partial<Goal> | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const all = useMemo(() => goals ?? [], [goals])

  const { roots, kids } = useMemo(() => {
    const visible = all
      .filter((g) => (area === 'all' || g.area === area) && (status === 'all' || g.status === status))
      .sort((a, b) => RANK[a.horizon] - RANK[b.horizon] || (a.targetDate ?? '9999').localeCompare(b.targetDate ?? '9999') || a.createdAt.localeCompare(b.createdAt))
    const ids = new Set(visible.map((g) => g.id))
    const kids = new Map<number, Goal[]>()
    const roots: Goal[] = []
    for (const g of visible) {
      if (g.parentId != null && ids.has(g.parentId)) {
        const list = kids.get(g.parentId) ?? []
        list.push(g)
        kids.set(g.parentId, list)
      } else roots.push(g)
    }
    return { roots, kids }
  }, [all, area, status])

  const usedAreas = AREAS.filter((a) => all.some((g) => g.area === a))
  const active = all.filter((g) => g.status === 'active')
  const lifeGoals = active.filter((g) => g.horizon === 'life')
  const hasQuarter = active.some((g) => g.horizon === 'quarter')

  const addChild = (p: Goal) => setEditing({ horizon: CHILD_HORIZON[p.horizon] ?? 'quarter', parentId: p.id, area: p.area })

  const render = (g: Goal) => {
    const children = kids.get(g.id!)
    return (
      <GoalCard
        key={g.id}
        goal={g}
        tasks={tasks ?? []}
        learning={learning ?? []}
        onEdit={setEditing}
        onAddChild={addChild}
        onEditTask={setEditingTask}
      >
        {children && <div className="goal-children">{children.map(render)}</div>}
      </GoalCard>
    )
  }

  const counts = `${active.length} active${all.some((g) => g.status === 'done') ? ` · ${all.filter((g) => g.status === 'done').length} done` : ''}`

  return (
    <>
      <PageHeader
        title="Goals"
        sub={goals === undefined ? ' ' : all.length ? counts : 'Life → Year → Quarter'}
        actions={
          all.length > 0 && (
            <button className="btn btn-primary" onClick={() => setEditing({ horizon: lifeGoals.length ? 'quarter' : 'life' })}>
              New goal
            </button>
          )
        }
      />

      {goals === undefined ? (
        <Card><Skeleton rows={6} label="Loading goals" /></Card>
      ) : all.length === 0 ? (
        <Card>
          <div className="goal-start">
            <div className="card-title">Start here</div>
            <ol>
              <li>
                Write one <strong>life goal</strong> — a direction, not a task. "Lead a team I'm proud of", "Be strong at 60".
              </li>
              <li>
                Under it, add a <strong>quarter goal</strong> you can finish in 90 days, with 3–5 milestones.
              </li>
              <li>Link tasks to it by typing #part-of-its-name in the capture bar, e.g. "draft 1:1 agenda fri #lead".</li>
            </ol>
            <button className="btn btn-primary" onClick={() => setEditing({ horizon: 'life' })}>
              Create your first life goal
            </button>
          </div>
        </Card>
      ) : (
        <>
          {lifeGoals.length > 0 && !hasQuarter && (
            <div className="goal-hint card">
              <span>Next: break "{lifeGoals[0].title}" into something you can finish this quarter.</span>
              <button className="btn btn-sm" onClick={() => setEditing({ horizon: 'quarter', parentId: lifeGoals[0].id, area: lifeGoals[0].area })}>
                Add quarter goal
              </button>
            </div>
          )}

          <Tabs<StatusFilter>
            value={status}
            onChange={setStatus}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'done', label: 'Done' },
              { value: 'all', label: 'All' },
            ]}
          />
          {usedAreas.length > 1 && (
            <div className="goal-filters" role="group" aria-label="Filter by area">
              <button className="chip filter-chip" aria-pressed={area === 'all'} onClick={() => setArea('all')}>
                All areas
              </button>
              {usedAreas.map((a) => (
                <button key={a} className="chip filter-chip" aria-pressed={area === a} onClick={() => setArea(a)}>
                  {AREA_LABEL[a]}
                </button>
              ))}
            </div>
          )}

          {roots.length ? (
            <div className="goal-tree">{roots.map(render)}</div>
          ) : (
            <Card>
              <Empty
                title={`No ${status === 'all' ? '' : `${status} `}goals${area !== 'all' ? ` in ${AREA_LABEL[area]}` : ''}`}
                action={status !== 'active' || area !== 'all' ? <button className="btn btn-sm" onClick={() => { setStatus('active'); setArea('all') }}>Show all active goals</button> : undefined}
              />
            </Card>
          )}
        </>
      )}

      {editing && <GoalEditor initial={editing} goals={all} onClose={() => setEditing(null)} />}
      {editingTask && <TaskEditor task={editingTask} goals={all} onClose={() => setEditingTask(null)} />}
    </>
  )
}
