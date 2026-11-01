import { useLiveQuery } from 'dexie-react-hooks'
import KpiStrip from '../../components/KpiStrip'
import { db, type ISODate } from '../../db'
import { addDays, formatDate, today } from '../../lib/dates'
import MiniBars, { type BarDatum } from './MiniBars'
import { dayStreak, sumMeals, type FoodTargets } from './foodData'
import { dayState, weekSummary, type DayState } from './foodLogic'

const STATE_LABEL: Record<DayState, string> = { met: 'met', close: 'close', missed: 'missed', none: '', empty: '-' }

export default function WeekView({ end, targets, onOpen }: { end: ISODate; targets: FoodTargets; onOpen: (d: ISODate) => void }) {
  const start = addDays(end, -6)
  const meals = useLiveQuery(() => db.meals.where('date').between(start, end, true, true).toArray(), [start, end])
  const allDates = useLiveQuery(async () => new Set((await db.meals.orderBy('date').uniqueKeys()) as string[]), [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDay = days.map((d) => {
    const ms = (meals ?? []).filter((m) => m.date === d)
    return { date: d, logged: ms.length > 0, ...sumMeals(ms) }
  })
  const sum = weekSummary(byDay, targets)

  const toBars = (k: 'calories' | 'protein'): BarDatum[] =>
    byDay.map((d) => ({
      key: d.date,
      label: formatDate(d.date, { weekday: 'narrow' }),
      full: formatDate(d.date, { weekday: 'short', month: 'short', day: 'numeric' }),
      value: d[k],
    }))

  const streak = allDates ? dayStreak(allDates, today()) : 0

  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>
        {formatDate(start)} – {formatDate(end)}
      </p>
      <div className="food-strip" role="list">
        {byDay.map((d) => {
          const cs = dayState(d.calories, targets.calories, d.logged)
          const ps = dayState(d.protein, targets.protein, d.logged)
          return (
            <button key={d.date} role="listitem" className="food-strip-day" onClick={() => onOpen(d.date)} aria-label={`Open ${formatDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })}`}>
              <span className="tiny faint">{formatDate(d.date, { weekday: 'short' })}</span>
              <span className="small">{formatDate(d.date, { day: 'numeric' })}</span>
              <span className={`food-st food-st-${cs}`}>
                <span className="mono tiny">{d.logged ? d.calories.toLocaleString() : '-'}</span>
                <span className="tiny">kcal {STATE_LABEL[cs]}</span>
              </span>
              <span className={`food-st food-st-${ps}`}>
                <span className="mono tiny">{d.logged ? `${d.protein} g` : '-'}</span>
                <span className="tiny">prot {STATE_LABEL[ps]}</span>
              </span>
            </button>
          )
        })}
      </div>
      <KpiStrip
        items={[
          { label: 'Avg calories', value: sum.avgCalories.toLocaleString(), note: targets.calories ? `target ${targets.calories.toLocaleString()}` : 'per logged day' },
          { label: 'Avg protein', value: `${sum.avgProtein} g`, note: targets.protein ? `target ${targets.protein} g` : 'per logged day' },
          { label: 'Adherence', value: targets.calories || targets.protein ? `${sum.calHits}/7 · ${sum.proteinHits}/7` : '-', note: targets.calories || targets.protein ? 'days hit calories · protein' : 'set targets to track' },
          { label: 'Logging streak', value: streak, note: `${sum.loggedDays}/7 days logged` },
        ]}
      />
      {(targets.calories || targets.protein) && (
        <p className="small" style={{ margin: 0 }}>
          {[targets.calories && `${sum.calHits} of 7 days hit calories`, targets.protein && `${sum.proteinHits} of 7 days hit protein`].filter(Boolean).join(', ')}.
        </p>
      )}
      <div className="grid grid-2">
        <MiniBars title="Calories per day" data={toBars('calories')} unit="kcal" target={targets.calories} />
        <MiniBars title="Protein per day" data={toBars('protein')} unit="g" target={targets.protein} />
      </div>
    </div>
  )
}
