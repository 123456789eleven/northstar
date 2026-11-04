// Budget health bar: fill = spent / limit, tick = how far through the month we are, state in words (not only color).
// Green when on pace, violet when ahead of pace or nearly used, warn when over.
import { useEffect, useState, type CSSProperties } from 'react'
import { today } from '../../lib/dates'
import '../g3/g3.css'
import { budgetPace, dayOfMonthFor, daysInMonthOf } from './moneyGame'

export default function HealthBar({ spent, limit, month, label = 'Budget' }: { spent: number; limit: number; month: string; label?: string }) {
  const pace = budgetPace(spent, limit, dayOfMonthFor(month, today()), daysInMonthOf(month))
  const v = Math.max(0, Math.min(1, pace.ratio))
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(v))
    return () => cancelAnimationFrame(id)
  }, [v])
  const showTick = month >= today().slice(0, 7) && pace.marker > 0 && pace.marker < 1
  return (
    <div className={`hbar is-${pace.status}`}>
      <div className="hbar-track" role="progressbar" aria-label={`${label}: ${pace.label}, ${Math.round(pace.ratio * 100)}% used`} aria-valuenow={Math.round(pace.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div className="hbar-fill" style={{ '--p': shown } as CSSProperties} />
        {showTick && <span className="hbar-tick" style={{ left: `${pace.marker * 100}%` }} aria-hidden />}
      </div>
      <div className="hbar-words">
        <span className="hbar-state">{pace.label}</span>
        <span>{Math.round(pace.ratio * 100)}% used{showTick ? `, month ${Math.round(pace.marker * 100)}% gone` : ''}</span>
      </div>
    </div>
  )
}
