// Weigh-in floor hero: the 7-day average (counts up when it moves), the one-tap weigh-in, and the path to goal with a flag
// every 5 lb. Saving a weight moves the number and springs the path forward. One pace line, nothing else.
import { useState } from 'react'
import { useNumberRoll } from '../../components/motion'
import { BossBar } from '../goals/BossBar'
import type { Checkpoint } from '../goals/boss'
import type { CheckpointFlag } from './pathModel'
import WeighInStepper from './WeighInStepper'

const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)}`

export interface WeighInHeroProps {
  /** 7-day average now; null before the first weigh-in. */
  current: number | null
  start: number
  goal: number
  flags: CheckpointFlag[]
  change: number | null
  toGo?: number | null
  pace: { tone: string; text: string } | null
  loggedToday?: number
  last?: number
}

export default function WeighInHero({ current, start, goal, flags, change, toGo, pace, loggedToday, last }: WeighInHeroProps) {
  const tenths = useNumberRoll(Math.round((current ?? 0) * 10), 700)
  // A gentle pop on the number when a new weigh-in moves it.
  const [seen, setSeen] = useState(current)
  const [pop, setPop] = useState(0)
  if (seen !== current) {
    if (seen != null && current != null) setPop(pop + 1)
    setSeen(current)
  }
  const span = goal - start
  const progress = current == null ? 0 : span === 0 ? 1 : Math.min(1, Math.max(0, (current - start) / span))
  const marks: Checkpoint[] = flags.map((f) => ({
    pos: span === 0 ? 100 : Math.min(100, Math.max(0, ((f.target - start) / span) * 100)),
    label: String(f.target),
    reached: f.reached,
  }))
  const next = flags.find((f) => f.next)
  return (
    <section className="card floor-hero wi-hero" aria-label="Weigh-in">
      <div className="wi-top">
        <div className="wi-now">
          <span className="stat-label">{current == null ? 'Your first weigh-in' : '7-day average'}</span>
          {current != null ? (
            <div className="wi-num" data-testid="hero-weight">
              <span key={pop} className={`wi-big mono${pop ? ' tick-pop' : ''}`}>{(tenths / 10).toFixed(1)}</span>
              <span className="wi-unit">lb</span>
            </div>
          ) : (
            <p className="wi-first">Type today&apos;s weight. The path starts here.</p>
          )}
          {current != null && (
            <p className="wi-sub">
              {change != null && <span className="mono">{signed(change)} lb this week</span>}
              {next && <span><span className="mono">{next.lbToGo.toFixed(1)}</span> to the {next.target} flag</span>}
            </p>
          )}
        </div>
        <div className="wi-act"><WeighInStepper loggedToday={loggedToday} last={last} first={current == null} bare /></div>
      </div>
      {current != null && (
        <div className="wi-path">
          <div className="wi-ends mono"><span>{start} lb</span><span>Goal {goal} lb{toGo ? `, ${toGo.toFixed(1)} to go` : ''}</span></div>
          <BossBar hp={{ basis: 'metric', progress, hp: 1 - progress }} flags={marks} label="Weight path to goal" showLabels />
          {pace && <p className={`wi-pace tone-${pace.tone}`} data-testid="body-pace">{pace.text}</p>}
        </div>
      )}
    </section>
  )
}
