// The weekly consistency dots.
import type { StreakState } from '../types'
import { parseISODate, today } from '../../../lib/dates'

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Mon..Sun dots: filled = active day (or covered by a rest token), ring = today. Text alternative on the list. */
export function WeekDots({ streak, showLabels = true }: { streak: StreakState; showLabels?: boolean }) {
  const todayIdx = (parseISODate(today()).getDay() + 6) % 7
  return (
    <ol className="weekdots" aria-label={`This week: ${streak.daysThisWeek} of ${streak.target} active days`}>
      {streak.weekDots.map((on, i) => (
        <li key={i} className={`wd ${on ? 'on' : ''} ${i === todayIdx ? 'today' : ''}`}>
          <span className="wd-dot" aria-hidden />
          {showLabels && <span className="wd-day" aria-hidden>{DAYS[i]}</span>}
          <span className="sr-only">{DAY_NAMES[i]}{on ? ': active' : ''}{i === todayIdx ? ' (today)' : ''}</span>
        </li>
      ))}
    </ol>
  )
}
