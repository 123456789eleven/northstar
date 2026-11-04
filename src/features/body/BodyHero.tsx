// Weight hero: the big current number (7-day average, number roll), change this week, rate and lb to go.
import { useNumberRoll } from '../../components/motion'
import type { CheckpointFlag } from './pathModel'

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)}`

export default function BodyHero({ current, last, change, rate, toGo, goal, next, projected }: {
  current: number
  last?: { weight: number; label: string }
  change: number | null
  rate: number | null
  toGo: number
  goal: number
  next?: CheckpointFlag
  projected?: string
}) {
  const tenths = useNumberRoll(Math.round(current * 10), 600)
  return (
    <section className="card body-hero" aria-label="Current weight">
      <div className="body-hero-main">
        <span className="stat-label">Current weight, 7-day average</span>
        <div className="body-hero-num" data-testid="hero-weight">
          <span className="body-hero-big mono">{(tenths / 10).toFixed(1)}</span>
          <span className="body-hero-unit">lb</span>
        </div>
        {last && <span className="faint small">Last weigh-in {last.weight} lb, {last.label}</span>}
      </div>
      <dl className="body-hero-stats">
        <div><dt>Change this week</dt><dd className="mono">{change != null ? `${signed(change)} lb` : '--'}</dd></div>
        <div><dt>Rate, 4 weeks</dt><dd className="mono">{rate != null ? `${signed(rate)} lb/wk` : '--'}</dd></div>
        <div><dt>To go</dt><dd><span className="mono">{toGo.toFixed(1)} lb</span><span className="faint tiny" style={{ display: 'block' }}>Goal {goal} lb{projected ? `, ${projected}` : ''}</span></dd></div>
      </dl>
      {next && <p className="body-hero-next small">Next checkpoint {next.target} lb: <strong className="mono">{next.lbToGo.toFixed(1)} lb</strong> to go.</p>}
    </section>
  )
}
