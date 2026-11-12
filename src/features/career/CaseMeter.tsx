// Case floor hero: case strength as a count-up score over five spring-filled segments, and the one next thing to strengthen.
// The score itself is pure (caseStrength.ts); the rules are listed in "How it is scored" behind More.
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useNumberRoll } from '../../components/motion'
import { type NextAction } from './caseStrength'
import { useCaseStrength } from './useCaseStrength'
import type { Win } from './leadership'
import type { Project } from './projects'

export function CaseMeter({ wins, projects, onAction }: { wins: Win[]; projects: Project[]; onAction: (a: Exclude<NextAction, 'goals'>) => void }) {
  const r = useCaseStrength(wins, projects)
  const shown = useNumberRoll(r.score, 700)
  return (
    <section className="card floor-hero car-meter" aria-label="Case strength" data-testid="case-meter">
      <div className="car-meter-head">
        <span className="stat-label">Case strength</span>
        <div className="car-meter-score" aria-label={`Score ${r.score} out of 100`}>
          <span className="car-meter-num mono" data-testid="case-score" data-score={r.score}>{shown}</span><span className="muted small"> / 100</span>
        </div>
      </div>
      <div className="car-hp" role="meter" aria-label="Case strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={r.score}>
        {r.segments.map((s) => (
          <div key={s.key} className="car-hp-seg" style={{ '--fill': s.points / s.max } as CSSProperties}>
            <span className="car-hp-bar"><span className="car-hp-fill" /></span>
            <span className="car-hp-label">{s.label}</span>
            <span className="car-hp-pts mono">{Math.round(s.points)}/{s.max}</span>
          </div>
        ))}
      </div>
      {r.next ? (
        <div className="car-next">
          <p className="car-next-text"><span className="muted">Next: </span><strong>{r.next.label}</strong> <span className="muted small">({r.next.detail})</span></p>
          {r.next.action === 'goals'
            ? <Link className="btn btn-primary" to="/goals">{r.next.actionLabel}</Link>
            : <button type="button" className="btn btn-primary" onClick={() => onAction(r.next!.action as Exclude<NextAction, 'goals'>)}>{r.next.actionLabel}</button>}
        </div>
      ) : <p className="car-next-text muted">Every part is covered. Keep logging as it happens.</p>}
    </section>
  )
}
