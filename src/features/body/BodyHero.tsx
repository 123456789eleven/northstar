// Weight hero: the weight path to goal (7-day average now, 5 lb checkpoint flags), the weekly rate and an honest pace line.
import { useNumberRoll } from '../../components/motion'
import { BossBar } from '../goals/BossBar'
import type { Checkpoint } from '../goals/boss'
import type { CheckpointFlag } from './pathModel'
import { paceNote } from './pace'

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)}`

export default function BodyHero({ current, start, flags, neededRate, last, change, rate, toGo, goal, next, projected }: {
  current: number
  start: number
  flags: CheckpointFlag[]
  /** lb per week needed to land on the goal date, null without a future date. */
  neededRate: number | null
  last?: { weight: number; label: string }
  change: number | null
  rate: number | null
  toGo: number
  goal: number
  next?: CheckpointFlag
  /** e.g. "about Mar 3, 2027 at this pace" or "reached". */
  projected?: string
}) {
  const tenths = useNumberRoll(Math.round(current * 10), 600)
  const span = goal - start
  const progress = span === 0 ? 1 : Math.min(1, Math.max(0, (current - start) / span))
  const marks: Checkpoint[] = flags.map((f) => ({
    pos: span === 0 ? 100 : Math.min(100, Math.max(0, ((f.target - start) / span) * 100)),
    label: String(f.target),
    reached: f.reached,
  }))
  const when = projected && projected !== 'reached' ? projected.replace(' at this pace', '') : undefined
  const pace = paceNote({ rate, current, goal, neededRate, projected: when })
  return (
    <section className="card body-hero" aria-label="Weight path">
      <div className="body-hero-main">
        <span className="stat-label">Weight now, 7-day average</span>
        <div className="body-hero-num" data-testid="hero-weight">
          <span className="body-hero-big mono">{(tenths / 10).toFixed(1)}</span>
          <span className="body-hero-unit">lb</span>
        </div>
        {last && <span className="faint small">Last weigh-in {last.weight} lb, {last.label}</span>}
      </div>
      <dl className="body-hero-stats">
        <div><dt>This week</dt><dd className="mono">{change != null ? `${signed(change)} lb` : '--'}</dd></div>
        <div><dt>Rate, 4 weeks</dt><dd className="mono">{rate != null ? `${signed(rate)} lb/wk` : '--'}</dd></div>
        <div><dt>To go</dt><dd><span className="mono">{toGo.toFixed(1)} lb</span><span className="faint tiny" style={{ display: 'block' }}>Goal {goal} lb</span></dd></div>
      </dl>
      <div className="body-hero-path">
        <div className="body-hero-ends mono"><span>{start} lb</span><span>{goal} lb</span></div>
        <BossBar hp={{ basis: 'metric', progress, hp: 1 - progress }} flags={marks} label="Weight path to goal" showLabels />
      </div>
      <p className={`body-hero-pace small tone-${pace.tone}`} data-testid="body-pace">
        {pace.text}
        {next ? <> Next checkpoint {next.target} lb: <strong className="mono">{next.lbToGo.toFixed(1)} lb</strong> to go.</> : null}
      </p>
    </section>
  )
}
