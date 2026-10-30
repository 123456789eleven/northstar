import { useLiveQuery } from 'dexie-react-hooks'
import { Stat } from '../../components/ui'
import { db, type ISODate } from '../../db'
import { addDays, formatDate, today } from '../../lib/dates'
import MiniBars, { type BarDatum } from './MiniBars'
import { dayStreak, sumMeals, type FoodTargets } from './foodData'

export default function WeekView({ end, targets }: { end: ISODate; targets: FoodTargets }) {
  const start = addDays(end, -6)
  const meals = useLiveQuery(() => db.meals.where('date').between(start, end, true, true).toArray(), [start, end])
  const allDates = useLiveQuery(async () => new Set((await db.meals.orderBy('date').uniqueKeys()) as string[]), [])

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDay = days.map((d) => {
    const ms = (meals ?? []).filter((m) => m.date === d)
    return { date: d, logged: ms.length > 0, ...sumMeals(ms) }
  })
  const logged = byDay.filter((d) => d.logged)
  const avg = (k: 'calories' | 'protein') => (logged.length ? Math.round(logged.reduce((a, d) => a + d[k], 0) / logged.length) : 0)
  const proteinHits = targets.protein ? byDay.filter((d) => d.protein >= targets.protein!).length : 0

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
      <div className="ns-stats">
        <Stat label="Days logged" value={`${logged.length}/7`} note="in this range" />
        <Stat label="Logging streak" value={streak} note={streak === 1 ? 'day in a row' : 'days in a row'} />
        <Stat label="Avg calories" value={avg('calories').toLocaleString()} note={targets.calories ? `target ${targets.calories.toLocaleString()}` : 'per logged day'} />
        <Stat
          label="Avg protein"
          value={`${avg('protein')} g`}
          note={targets.protein ? `target hit ${proteinHits}/7 days` : 'per logged day'}
        />
      </div>
      <div className="grid grid-2">
        <MiniBars title="Calories per day" data={toBars('calories')} unit="kcal" target={targets.calories} />
        <MiniBars title="Protein per day" data={toBars('protein')} unit="g" target={targets.protein} />
      </div>
    </div>
  )
}
