// Day strip: the 7 days ending at the chosen date (capped at today), each with a met / close / missed dot.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ISODate } from '../../db'
import { addDays, formatDate, today } from '../../lib/dates'
import { sumMeals, type FoodTargets } from './foodData'
import { dayState } from './foodLogic'
import { combineDayStates } from './ringMath'

const WORD = { met: 'target met', close: 'close', missed: 'missed', none: '', empty: 'nothing logged' } as const

export default function DayStrip({ date, targets, onPick }: { date: ISODate; targets: FoodTargets; onPick: (d: ISODate) => void }) {
  const end = date > today() ? date : date < addDays(today(), -6) ? date : today()
  const start = addDays(end, -6)
  const meals = useLiveQuery(() => db.meals.where('date').between(start, end, true, true).toArray(), [start, end])
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  return (
    <ol className="fday" aria-label="Last 7 days">
      {days.map((d) => {
        const ms = (meals ?? []).filter((m) => m.date === d)
        const sum = sumMeals(ms)
        const logged = ms.length > 0
        const st = combineDayStates([dayState(sum.calories, targets.calories, logged), dayState(sum.protein, targets.protein, logged)])
        const name = formatDate(d, { weekday: 'long', month: 'short', day: 'numeric' })
        return (
          <li key={d}>
            <button className={`fday-day ${d === date ? 'is-sel' : ''}`} aria-current={d === date ? 'date' : undefined} aria-label={`${name}${WORD[st] ? `, ${WORD[st]}` : ''}`} onClick={() => onPick(d)}>
              <span className="fday-wd" aria-hidden>{formatDate(d, { weekday: 'narrow' })}</span>
              <span className="fday-n" aria-hidden>{formatDate(d, { day: 'numeric' })}</span>
              <span className={`fday-dot dot-${st}`} aria-hidden />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
