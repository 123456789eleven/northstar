// Hero: promotion case strength as an HP-style bar with five labelled segments, a "Next to strengthen" line with a
// one-tap action, and a plain "How this is scored" disclosure. The score itself is pure (caseStrength.ts).
import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useNumberRoll } from '../../components/motion'
import { CASE_RULES, type NextAction } from './caseStrength'
import { useCaseStrength } from './useCaseStrength'
import type { Win } from './leadership'
import type { Project } from './projects'

export function CaseMeter({ wins, projects, onAction }: { wins: Win[]; projects: Project[]; onAction: (a: Exclude<NextAction, 'goals'>) => void }) {
  const r = useCaseStrength(wins, projects)
  const shown = useNumberRoll(r.score)
  return (
    <section className="card car-meter" aria-label="Promotion case strength" data-testid="case-meter">
      <div className="car-meter-head">
        <div>
          <h2 className="car-meter-title">Promotion case strength</h2>
          <p className="small muted">Coverage of what a case needs, from your own records.</p>
        </div>
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
          <p className="car-next-text"><span className="muted">Next to strengthen: </span><strong>{r.next.label}</strong> <span className="muted small">({r.next.detail})</span></p>
          {r.next.action === 'goals'
            ? <Link className="btn btn-sm btn-primary" to="/goals">{r.next.actionLabel}</Link>
            : <button type="button" className="btn btn-sm btn-primary" onClick={() => onAction(r.next!.action as Exclude<NextAction, 'goals'>)}>{r.next.actionLabel}</button>}
        </div>
      ) : <p className="car-next-text muted">Every part of the case is covered. Keep logging as things happen.</p>}
      <details className="car-how">
        <summary>How this is scored</summary>
        <p className="small muted">Five parts, 20 points each, added up. Nothing else counts and nothing is weighted in secret. Only the last 90 days of wins and 1:1 notes are used.</p>
        <ul className="car-how-list small">
          {(Object.keys(CASE_RULES) as (keyof typeof CASE_RULES)[]).map((k) => <li key={k}><strong>{CASE_RULES[k].label}.</strong> {CASE_RULES[k].rule}</li>)}
        </ul>
      </details>
    </section>
  )
}
