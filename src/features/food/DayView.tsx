import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Empty, Progress } from '../../components/ui'
import { db, type ISODate } from '../../db'
import { addDays, formatDate, relativeDay, today } from '../../lib/dates'
import SlotCard, { type Suggestion } from './SlotCard'
import { copyYesterday, SLOTS, sumMeals, type FoodTargets } from './foodData'

const LIST_ID = 'food-recent-names'

function TotalLine({ label, value, unit, target }: { label: string; value: number; unit: string; target?: number }) {
  const left = target ? target - value : 0
  return (
    <div className="food-total">
      <span className="stat-label">{label}</span>
      <div className="food-total-value">
        <span className="stat-value">{value.toLocaleString()}</span>
        <span className="muted small">
          {target ? ` / ${target.toLocaleString()}` : ''} {unit}
        </span>
      </div>
      {target ? (
        <>
          <Progress value={(value / target) * 100} label={label} />
          <span className={`tiny ${left < 0 ? 'muted' : 'faint'}`}>{left >= 0 ? `${left.toLocaleString()} ${unit} left` : `${(-left).toLocaleString()} ${unit} over`}</span>
        </>
      ) : null}
    </div>
  )
}

export default function DayView({ date, setDate, targets }: { date: ISODate; setDate: (d: ISODate) => void; targets: FoodTargets }) {
  const yesterday = addDays(date, -1)
  const meals = useLiveQuery(() => db.meals.where('date').equals(date).toArray(), [date])
  const prevMeals = useLiveQuery(() => db.meals.where('date').equals(yesterday).toArray(), [yesterday])
  const favorites = useLiveQuery(() => db.favoriteMeals.orderBy('uses').reverse().toArray(), [])
  const recent = useLiveQuery(() => db.meals.orderBy('date').reverse().limit(400).toArray(), [])

  const suggestions = useMemo(() => {
    const map = new Map<string, Suggestion>()
    for (const f of favorites ?? []) map.set(f.name.trim().toLowerCase(), { name: f.name, calories: f.calories, protein: f.protein })
    for (const m of recent ?? []) {
      const k = m.name.trim().toLowerCase()
      if (!map.has(k)) map.set(k, { name: m.name, calories: m.calories, protein: m.protein })
      if (map.size >= 80) break
    }
    return map
  }, [favorites, recent])

  const totals = sumMeals(meals ?? [])
  const isToday = date === today()

  return (
    <div className="stack food-day">
      <div className="food-stepper">
        <button className="btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="food-stepper-label">
          <strong>{relativeDay(date)}</strong>
          <span className="faint small">{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
        <button className="btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
          ›
        </button>
        {!isToday && (
          <button className="btn btn-ghost" onClick={() => setDate(today())}>
            Today
          </button>
        )}
        <span className="grow" />
        {(prevMeals?.length ?? 0) > 0 && (
          <button className="btn" onClick={() => copyYesterday(date)} title="Copy every meal from the previous day">
            Copy yesterday
          </button>
        )}
      </div>

      <section className="card food-totals">
        <TotalLine label="Calories" value={totals.calories} unit="kcal" target={targets.calories} />
        <TotalLine label="Protein" value={totals.protein} unit="g" target={targets.protein} />
      </section>

      {meals && meals.length === 0 && (favorites?.length ?? 0) === 0 && (
        <Empty>Type what you ate into a slot below — numbers are optional. Tick “Fav” on meals you repeat and they become one-tap chips.</Empty>
      )}

      <datalist id={LIST_ID}>
        {[...suggestions.values()].map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>

      <div className="grid grid-2">
        {SLOTS.map((s) => (
          <SlotCard
            key={s.value}
            slot={s.value}
            label={s.label}
            date={date}
            meals={(meals ?? []).filter((m) => m.slot === s.value)}
            favorites={(favorites ?? []).filter((f) => !f.slot || f.slot === s.value).slice(0, 8)}
            suggestions={suggestions}
            hasYesterday={(prevMeals ?? []).some((m) => m.slot === s.value)}
            listId={LIST_ID}
          />
        ))}
      </div>
    </div>
  )
}
