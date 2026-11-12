import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AREAS, db, getSetting, type Area, type Goal, type Task } from '../db'
import { AREA_LABEL, Card, Empty, Skeleton, Tabs } from '../components/ui'
import SidePanel from '../components/SidePanel'
import { useToast } from '../components/toastContext'
import { GoalCard } from '../features/goals/GoalCard'
import { GoalEditor } from '../features/goals/GoalEditor'
import { BossCard } from '../features/goals/BossCard'
import { Campaign } from '../features/goals/Campaign'
import { exampleBosses, pickBosses } from '../features/goals/boss'
import { adoptExample, autoCompleteGoal, undoAutoComplete } from '../features/goals/goalActions'
import { CHILD_HORIZON } from '../features/goals/progress'
import { SuggestedLinks } from '../features/goals/SuggestedLinks'
import { goalMetric, suggestLinks } from '../features/progress/metrics'
import { loadMetricData } from '../features/progress/metricsData'
import { today } from '../lib/dates'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import { useFocusTarget } from '../lib/useFocusParam'
import { TaskEditor } from '../features/tasks/TaskEditor'
import '../features/tasks/tasks.css'
import '../features/goals/goals.css'
import '../features/goals/quest.css'
import '../features/goals/season.css'
import '../features/town/town.css'

type StatusFilter = 'active' | 'paused' | 'done' | 'all'
const RANK: Record<Goal['horizon'], number> = { life: 0, year: 1, quarter: 2 }

/** Completes an auto-tracked goal the moment its metric is reached, even when no card is on screen. */
function AutoComplete({ goal, reached }: { goal: Goal; reached: boolean }) {
  const toast = useToast()
  const tried = useRef(false)
  useEffect(() => {
    if (!reached) { tried.current = false; return }
    if (tried.current || goal.id == null) return
    tried.current = true
    const id = goal.id
    void autoCompleteGoal(id).then((ok) => {
      if (ok) toast({ message: `Goal reached: ${goal.title}.`, undo: () => undoAutoComplete(id) })
    })
  }, [reached, goal.id, goal.title, toast])
  return null
}

export default function Goals() {
  const goals = useLiveQuery(() => db.goals.toArray(), [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [])
  const learning = useLiveQuery(() => db.learning.toArray(), [])
  const metricData = useLiveQuery(() => loadMetricData(), [])
  const bodyGoal = useLiveQuery(() => getSetting<number>('body.goal', 165), [])
  const toast = useToast()
  const d = today()
  const [area, setArea] = useState<Area | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [editing, setEditing] = useState<Partial<Goal> | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)

  const all = useMemo(() => goals ?? [], [goals])
  const allTasks = useMemo(() => tasks ?? [], [tasks])
  useFocusTarget({
    ready: goals !== undefined,
    exists: (id) => all.some((g) => String(g.id) === id),
    reveal: (id) => { setStatus('all'); setArea('all'); setOpenId(Number(id)) },
  })

  const bosses = useMemo(() => pickBosses(all), [all])
  const bossIds = useMemo(() => new Set(bosses.map((b) => b.id)), [bosses])

  const { roots, kids } = useMemo(() => {
    const visible = all
      .filter((g) => !(status === 'active' && bossIds.has(g.id)))
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
  }, [all, area, status, bossIds])

  const usedAreas = AREAS.filter((a) => all.some((g) => g.area === a))
  const active = all.filter((g) => g.status === 'active')
  const lifeGoals = active.filter((g) => g.horizon === 'life')
  const hasQuarter = active.some((g) => g.horizon === 'quarter')
  const opened = openId != null ? all.find((g) => g.id === openId) : undefined

  const addChild = (p: Goal) => { setOpenId(null); setEditing({ horizon: CHILD_HORIZON[p.horizon] ?? 'quarter', parentId: p.id, area: p.area }) }
  const edit = (g: Partial<Goal>) => { setOpenId(null); setEditing(g) }
  const editTask = (t: Task) => { setOpenId(null); setEditingTask(t) }
  async function adopt(i: number) {
    const ex = exampleBosses(d)[i]
    const id = await adoptExample(ex)
    toast({ message: `Season goal added: ${ex.title}.`, undo: async () => { await db.goals.delete(id) } })
  }

  const newGoal = () => setEditing({ horizon: lifeGoals.length || hasQuarter ? 'quarter' : 'life' })

  const loading = goals === undefined
  const hero = loading ? (
    <Card><Skeleton rows={6} label="Loading goals" /></Card>
  ) : all.length === 0 ? (
    <Card className="floor-hero">
      <div className="goal-start">
        <div className="card-title">Set your first season goal</div>
        <p className="quest-lede">One you can finish this quarter. Adopt an example, then make it yours.</p>
        <div className="quest-examples">
          {exampleBosses(d).map((ex, i) => (
            <div key={ex.title} className="quest-example">
              <div className="quest-example-title">{ex.title}</div>
              <div className="quest-example-sub">{ex.milestones.length} milestones · {ex.why}</div>
              <button className="btn btn-primary btn-sm" onClick={() => void adopt(i)}>Adopt this goal</button>
            </div>
          ))}
        </div>
        <div className="quest-or">
          <button className="btn" onClick={() => setEditing({ horizon: 'quarter' })}>Write my own</button>
          <button className="btn btn-ghost" onClick={() => setEditing({ horizon: 'life' })}>Create your first life goal</button>
        </div>
        <p className="tiny faint">Link tasks to a goal by typing #part-of-its-name in the capture bar, e.g. "draft 1:1 agenda fri #lead".</p>
      </div>
    </Card>
  ) : (
    <section aria-labelledby="bosses-h" className="goals-hero">
      <div className="quest-h-row">
        <h2 className="quest-h" id="bosses-h">Season goals</h2>
        <button className="btn btn-primary btn-sm" onClick={newGoal}>New goal</button>
      </div>
      {bosses.length > 0 ? (
        <div className="boss-grid">
          {bosses.map((g) => (
            <BossCard
              key={g.id}
              goal={g}
              tasks={allTasks}
              metric={g.metric && metricData ? goalMetric(g, metricData) : null}
              data={metricData}
              today={d}
              onOpen={(x) => setOpenId(x.id ?? null)}
            />
          ))}
        </div>
      ) : (
        <Card><Empty title="No season goal yet" action={<button className="btn btn-sm" onClick={() => setEditing({ horizon: 'quarter' })}>Add a season goal</button>}>Pick the one thing that would make this quarter worth it.</Empty></Card>
      )}
    </section>
  )

  const allGoals = all.length > 0 && (
    <FloorCard key="all" title="All goals">
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
          <button className="chip filter-chip" aria-pressed={area === 'all'} onClick={() => setArea('all')}>All areas</button>
          {usedAreas.map((a) => (
            <button key={a} className="chip filter-chip" aria-pressed={area === a} onClick={() => setArea(a)}>{AREA_LABEL[a]}</button>
          ))}
        </div>
      )}
      {roots.length ? (
        <div className="goals-list"><Campaign roots={roots} kids={kids} tasks={allTasks} data={metricData} onOpen={(g) => setOpenId(g.id ?? null)} /></div>
      ) : (
        <Empty
          title={status === 'active' && bosses.length && area === 'all' ? 'No year or life goals yet' : `No ${status === 'all' ? '' : `${status} `}goals${area !== 'all' ? ` in ${AREA_LABEL[area]}` : ''}`}
          action={
            status !== 'active' || area !== 'all'
              ? <button className="btn btn-sm" onClick={() => { setStatus('active'); setArea('all') }}>Show all active goals</button>
              : <button className="btn btn-sm" onClick={() => setEditing({ horizon: 'life' })}>Add a life goal</button>
          }
        />
      )}
    </FloorCard>
  )

  const linkable = all.length > 0 ? suggestLinks(all, { bodyGoal: bodyGoal ?? 165 }).length : 0

  const more = (
    <FloorMore
      floor="Goals"
      items={[
        { id: 'new', label: 'New goal', onSelect: newGoal },
        ...(lifeGoals.length > 0 && !hasQuarter
          ? [{ id: 'break', label: 'Break down a life goal', value: lifeGoals[0].title, onSelect: () => setEditing({ horizon: 'quarter', parentId: lifeGoals[0].id, area: lifeGoals[0].area }) }]
          : []),
        ...(linkable > 0 ? [{ id: 'links', label: 'Suggested links', value: linkable, panel: <SuggestedLinks goals={all} bodyGoal={bodyGoal ?? 165} /> }] : []),
        { id: 'tasks', label: 'Tasks', to: '/tasks' },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Goals" className="town-floor" hero={hero} support={[allGoals]} more={more} />

      {metricData && active.filter((g) => g.metric && g.id !== openId).map((g) => (
        <AutoComplete key={g.id} goal={g} reached={!!goalMetric(g, metricData)?.met && g.metric?.autoComplete !== false} />
      ))}

      {opened && (
        <SidePanel title={opened.title} onClose={() => setOpenId(null)}>
          <GoalCard
            goal={opened}
            tasks={allTasks}
            learning={learning ?? []}
            onEdit={edit}
            onAddChild={addChild}
            onEditTask={editTask}
            metricData={metricData}
            focused
          />
        </SidePanel>
      )}
      {editing && <GoalEditor initial={editing} goals={all} onClose={() => setEditing(null)} />}
      {editingTask && <TaskEditor task={editingTask} goals={all} onClose={() => setEditingTask(null)} />}
    </>
  )
}
