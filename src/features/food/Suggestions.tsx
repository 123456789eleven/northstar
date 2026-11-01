import { useMemo } from 'react'
import { useToast } from '../../components/toastContext'
import type { ISODate, MealSlot } from '../../db'
import { addMeal, removeMeals } from './foodData'
import { bulkStaples, rankSuggestions, type Candidate } from './foodLogic'

export default function Suggestions({ remaining, own, date, slot }: { remaining: { kcal: number; protein: number }; own: Candidate[]; date: ISODate; slot: MealSlot }) {
  const toast = useToast()
  const ranked = useMemo(() => rankSuggestions(remaining, [...own, ...bulkStaples()], 7), [remaining, own])
  if (!ranked.length) return null
  return (
    <section className="card food-suggest">
      <div className="card-title">
        <span>Hit your numbers</span>
        <span className="tiny faint">adds to {slot}</span>
      </div>
      <div className="food-favs">
        {ranked.map((r) => (
          <button
            key={r.name}
            className="food-fav"
            title={r.serving ? `${r.serving} (approximate)` : 'From your history'}
            onClick={async () => {
              const id = await addMeal({ date, slot, name: r.name, calories: r.calories, protein: r.protein })
              toast({ message: `Added ${r.name}`, undo: () => removeMeals(id != null ? [id] : []) })
            }}
          >
            <span>+ {r.name}</span>
            <span className="faint mono">
              {r.calories} / {r.protein}g
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
