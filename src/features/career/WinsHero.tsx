// Wins floor hero: log a win in one line, watch the month count tick up, and watch the win rise into the case meter.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNumberRoll } from '../../components/motion'
import { monthNow } from './careerData'
import { useCaseStrength } from './useCaseStrength'
import { QuickWin } from './WinsPanel'
import type { Win } from './leadership'
import type { Project } from './projects'

export function WinsHero({ wins, projects }: { wins: Win[]; projects: Project[] }) {
  const r = useCaseStrength(wins, projects)
  const month = wins.filter((w) => w.date.startsWith(monthNow())).length
  const count = useNumberRoll(month, 500)
  const score = useNumberRoll(r.score, 800)
  const [rise, setRise] = useState(0)
  return (
    <section className="card floor-hero wn-hero" aria-label="Wins this month">
      <div className="wn-top">
        <div className="wn-count">
          <span className="stat-label">Wins this month</span>
          <span key={month} className={`wn-big mono${rise ? ' tick-pop' : ''}`} data-testid="wins-month">{count}</span>
        </div>
        <Link to="/case" className="wn-case" aria-label={`Case strength ${r.score} of 100. Open Case`}>
          <span className="stat-label">Case strength</span>
          <span className="wn-bar" aria-hidden="true">
            <span className="wn-fill" style={{ transform: `scaleX(${r.score / 100})` }} />
            {rise > 0 && <span key={rise} className="wn-blip" />}
          </span>
          <span className="mono wn-score">{score} / 100</span>
        </Link>
      </div>
      <QuickWin bare onLogged={() => setRise((n) => n + 1)} />
    </section>
  )
}
