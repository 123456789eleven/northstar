// Town hall, Tasks floor hero: the open count (rolls down as you finish things), what is late, what is done today
// (ticks up with a small pop), the add line, and today's three focus slots. One card, one number that matters.
import type { ReactNode } from 'react'
import { useNumberRoll } from '../../components/motion'
import { usePopKey } from '../buildings/usePop'

export function TasksHero({ open, overdue, dueToday, doneToday, add, focus }: { open: number; overdue: number; dueToday: number; doneToday: number; add?: ReactNode; focus?: ReactNode }) {
  const openRoll = useNumberRoll(open, 450)
  const doneRoll = useNumberRoll(doneToday, 450)
  const pop = usePopKey(doneToday)
  return (
    <section className="card floor-hero tasks-hero" aria-label="Tasks">
      <div className="tasks-hero-main">
        <div className="tasks-hero-num">
          <span className="tasks-hero-big mono" data-testid="tasks-open">{openRoll}</span>
          <span className="tasks-hero-unit">open</span>
        </div>
        <ul className="today-counts tasks-counts" aria-label="Task counts">
          <li className={overdue ? 'is-late' : ''}><b className="mono">{overdue}</b> overdue</li>
          <li><b className="mono">{dueToday}</b> due today</li>
          <li key={pop} className={pop ? 'tick-pop' : ''}><b className="mono" data-testid="tasks-done-today">{doneRoll}</b> done today</li>
        </ul>
        {add}
      </div>
      {focus && <div className="tasks-hero-focus">{focus}</div>}
    </section>
  )
}
