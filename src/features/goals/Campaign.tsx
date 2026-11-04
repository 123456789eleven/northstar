// The Campaign list: year and life goals (and any other goals not shown as bosses) as compact rows with a progress ring.
// The parent/child tree is preserved. Rows open the goal detail.
import type { ReactNode } from 'react'
import type { Goal, Task } from '../../db'
import { AREA_LABEL } from '../../components/ui'
import { Ring } from '../game/ui/Ring'
import { goalMetric, type MetricData } from '../progress/metrics'
import { HORIZON_LABEL, goalProgress, progressLabel } from './progress'

export function CampaignRow({ goal, tasks, data, onOpen }: { goal: Goal; tasks: Task[]; data?: MetricData; onOpen: (g: Goal) => void }) {
  const metric = goal.metric && data ? goalMetric(goal, data) : null
  const p = goalProgress(goal, tasks)
  const pct = goal.status === 'done' ? 100 : metric?.hasData ? metric.pct : p.pct
  const sub = metric ? (metric.hasData ? metric.label : 'No data yet') : p.basis === 'none' ? '' : progressLabel(p)
  return (
    <button type="button" className={`camp-row ${goal.status}`} data-focus-id={goal.id} onClick={() => onOpen(goal)}>
      <Ring value={pct / 100} size={32} stroke={3} label={`${Math.round(pct)}% done`}>
        <span className="camp-pct mono">{Math.round(pct)}</span>
      </Ring>
      <span className="camp-main">
        <span className="camp-title">{goal.title}</span>
        <span className="camp-meta">
          <span>{HORIZON_LABEL[goal.horizon]}</span>
          <span>{AREA_LABEL[goal.area]}</span>
          {goal.status !== 'active' && <span>{goal.status === 'done' ? 'Done' : 'Paused'}</span>}
        </span>
      </span>
      {sub && <span className="camp-num" data-testid={metric ? 'goal-metric' : undefined}>{sub}</span>}
    </button>
  )
}

export function Campaign({ roots, kids, tasks, data, onOpen }: { roots: Goal[]; kids: Map<number, Goal[]>; tasks: Task[]; data?: MetricData; onOpen: (g: Goal) => void }) {
  const render = (g: Goal): ReactNode => {
    const children = kids.get(g.id!)
    return (
      <div key={g.id}>
        <CampaignRow goal={g} tasks={tasks} data={data} onOpen={onOpen} />
        {children && <div className="goal-children">{children.map(render)}</div>}
      </div>
    )
  }
  return <div className="camp-tree">{roots.map(render)}</div>
}
