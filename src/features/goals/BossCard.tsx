// A season boss: a top active quarter goal as a card with HP bar, checkpoint flags, the live number, days left and one next step.
import type { Goal, Task } from '../../db'
import { AREA_LABEL } from '../../components/ui'
import { bossCheckpoints, bossHp, bossNumber, daysLeftInQuarter, nextStep } from './boss'
import { BossBar } from './BossBar'
import type { MetricData, MetricResult } from '../progress/metrics'

export function BossCard({ goal, tasks, metric, data, today, calm, onOpen }: {
  goal: Goal
  tasks: Task[]
  metric: MetricResult | null
  data?: MetricData
  today: string
  calm: boolean
  onOpen: (g: Goal) => void
}) {
  const hp = bossHp(goal, tasks, metric)
  const flags = bossCheckpoints(goal, metric, data)
  const step = nextStep(goal, tasks)
  const left = daysLeftInQuarter(today)
  const pct = Math.round(hp.progress * 100)
  return (
    <button type="button" className="card boss" data-testid="boss-card" data-focus-id={goal.id} onClick={() => onOpen(goal)}>
      <span className="boss-top">
        <span className="chip">{AREA_LABEL[goal.area]}</span>
        <span className="boss-days">{left === 0 ? 'Last day of the quarter' : `${left} ${left === 1 ? 'day' : 'days'} left`}</span>
      </span>
      <span className="boss-title">{goal.title}</span>
      <span className="boss-numrow">
        <span className="boss-num" data-testid="boss-number">{bossNumber(goal, tasks, metric)}</span>
        <span className="boss-hp" data-testid="boss-hp">{calm ? `${pct}% done` : `HP ${Math.round(hp.hp * 100)}%`}</span>
      </span>
      <BossBar hp={hp} flags={flags} label={goal.title} calm={calm} showLabels={goal.metric?.source === 'weight' && flags.length > 0} />
      <span className="boss-next"><span className="boss-next-k">Next step</span><span className="boss-next-v">{step.text}</span></span>
    </button>
  )
}
