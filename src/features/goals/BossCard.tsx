// A season goal: a top active quarter goal as a card with a progress ring, checkpoint bar, the live number, days left,
// a one-line coach note and one next step. A gold mark appears only once the goal is met.
import type { Goal, Task } from '../../db'
import { AREA_LABEL } from '../../components/ui'
import { Ring } from '../game/ui/Ring'
import { bossCheckpoints, bossNumber, daysLeftInQuarter, nextStep } from './boss'
import { goalCoach } from './goalCoach'
import { BossBar } from './BossBar'
import type { MetricData, MetricResult } from '../progress/metrics'

export function BossCard({ goal, tasks, metric, data, today, onOpen }: {
  goal: Goal
  tasks: Task[]
  metric: MetricResult | null
  data?: MetricData
  today: string
  calm?: boolean
  onOpen: (g: Goal) => void
}) {
  const { hp, note } = goalCoach(goal, tasks, metric, data, today)
  const flags = bossCheckpoints(goal, metric, data)
  const step = nextStep(goal, tasks)
  const left = daysLeftInQuarter(today)
  const pct = Math.round(hp.progress * 100)
  const met = note.tone === 'met'
  return (
    <button type="button" className={`card boss ${met ? 'is-met' : ''}`} data-testid="boss-card" data-focus-id={goal.id} onClick={() => onOpen(goal)}>
      <span className="boss-top">
        <span className="chip">{AREA_LABEL[goal.area]}</span>
        <span className="boss-days">{left === 0 ? 'Last day of the quarter' : `${left} ${left === 1 ? 'day' : 'days'} left`}</span>
      </span>
      <span className="boss-head">
        <Ring value={hp.progress} size={52} stroke={5} tone={met ? 'reward' : undefined} label={`${pct}% done`}>
          <span className="boss-ring-n mono">{pct}%</span>
        </Ring>
        <span className="boss-head-text">
          <span className="boss-title">{goal.title}</span>
          <span className="boss-numrow">
            <span className="boss-num" data-testid="boss-number">{bossNumber(goal, tasks, metric)}</span>
            <span className="boss-hp" data-testid="boss-hp">{pct}% done</span>
          </span>
        </span>
      </span>
      <BossBar hp={hp} flags={flags} label={goal.title} showLabels={goal.metric?.source === 'weight' && flags.length > 0} />
      <span className={`boss-coach tone-${note.tone}`} data-testid="boss-coach">{met && <span className="boss-met-mark" aria-hidden />}{note.text}</span>
      <span className="boss-next"><span className="boss-next-k">Next step</span><span className="boss-next-v">{step.text}</span></span>
    </button>
  )
}
