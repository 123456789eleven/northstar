// Habits hero: this week's ring across all habits, and a 12-week consistency grid. Empty days are simply empty; every week
// allows one grace day. No streaks, no loss language.
import { useMemo } from 'react'
import type { Habit, ISODate } from '../../db'
import { useNumberRoll } from '../../components/motion'
import { formatDate, startOfWeek } from '../../lib/dates'
import { Ring } from '../game/ui/Ring'
import { consistencyGrid, GRACE_DAYS, weekTotals, weeksOnTarget } from './consistency'

export function HabitHero({ habits, byHabit, today }: { habits: Habit[]; byHabit: Map<number, Set<ISODate>>; today: ISODate }) {
  const slim = useMemo(() => habits.map((h) => ({ id: h.id!, perWeek: h.perWeek })), [habits])
  const grid = useMemo(() => consistencyGrid(byHabit, slim.map((h) => h.id), today), [byHabit, slim, today])
  const week = useMemo(() => weekTotals(byHabit, slim, startOfWeek(today)), [byHabit, slim, today])
  const steady = useMemo(() => weeksOnTarget(byHabit, slim, today), [byHabit, slim, today])
  const done = useNumberRoll(week.done)
  const pct = week.target ? week.done / week.target : 0
  return (
    <section className="card habit-hero" aria-label="This week">
      <div className="habit-hero-ring">
        <Ring value={pct} size={112} stroke={9} tone={pct >= 1 ? 'reward' : undefined} label={`${week.done} of ${week.target} check-ins this week`}>
          <span className="habit-hero-center"><span className="habit-hero-big mono" data-testid="habit-week-done">{done}</span><span className="habit-hero-of">of {week.target}</span></span>
        </Ring>
        <div className="habit-hero-text">
          <strong>This week</strong>
          <span>{week.done} of {week.target} check-ins</span>
          <span className="faint">{steady.on} of the last {steady.of} weeks on target, with {GRACE_DAYS} grace day each week.</span>
        </div>
      </div>
      <div className="cgrid-wrap">
        <div className="cgrid" role="img" aria-label={`Check-ins over the last ${grid.length} weeks, darker means more habits done that day`} data-testid="consistency-grid">
          {grid.map((col) => (
            <div className="cgrid-col" key={col[0].date}>
              {col.map((c) => (
                <span
                  key={c.date}
                  className={`cgrid-cell l${c.level} ${c.future ? 'is-future' : ''} ${c.today ? 'is-today' : ''}`}
                  title={`${formatDate(c.date, { month: 'short', day: 'numeric' })}: ${c.count} done`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="cgrid-legend" aria-hidden><span>Fewer</span><span className="cgrid-cell l0" /><span className="cgrid-cell l1" /><span className="cgrid-cell l2" /><span className="cgrid-cell l3" /><span>More</span></div>
      </div>
    </section>
  )
}
