import { useState } from 'react'
import type { FavoriteMeal, ISODate, Meal, MealSlot } from '../../db'
import { addMeal, copyYesterday, logFavorite, optNum, removeMeal, sumMeals } from './foodData'

export interface Suggestion {
  name: string
  calories?: number
  protein?: number
}

export default function SlotCard({
  slot,
  label,
  date,
  meals,
  favorites,
  suggestions,
  hasYesterday,
  listId,
}: {
  slot: MealSlot
  label: string
  date: ISODate
  meals: Meal[]
  favorites: FavoriteMeal[]
  /** name (lowercased) → last-known numbers, for prefill. */
  suggestions: Map<string, Suggestion>
  hasYesterday: boolean
  /** id of the shared recent-names datalist */
  listId: string
}) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [fav, setFav] = useState(false)
  const totals = sumMeals(meals)

  const onName = (v: string) => {
    setName(v)
    const s = suggestions.get(v.trim().toLowerCase())
    if (s) {
      if (!kcal && s.calories != null) setKcal(String(s.calories))
      if (!protein && s.protein != null) setProtein(String(s.protein))
    }
  }

  const submit = async () => {
    if (!name.trim()) return
    await addMeal({ date, slot, name, calories: optNum(kcal), protein: optNum(protein) }, { saveFavorite: fav })
    setName('')
    setKcal('')
    setProtein('')
    setFav(false)
  }

  return (
    <section className="card food-slot">
      <div className="card-title">
        <span className="food-slot-head">
          <span>{label}</span>
          {(totals.calories > 0 || totals.protein > 0) && (
            <span className="food-slot-sum mono">
              {[totals.calories > 0 && `${totals.calories.toLocaleString()} kcal`, totals.protein > 0 && `${totals.protein} g`].filter(Boolean).join(' · ')}
            </span>
          )}
        </span>
        {hasYesterday && (
          <button className="btn btn-ghost btn-sm" onClick={() => copyYesterday(date, slot)} title={`Copy yesterday's ${label.toLowerCase()}`}>
            Copy yesterday
          </button>
        )}
      </div>

      {meals.length > 0 && (
        <div className="list">
          {meals.map((m) => (
            <div key={m.id} className="list-item food-meal">
              <span className="grow food-meal-name">{m.name}</span>
              <span className="mono small muted">
                {m.calories != null ? `${m.calories} kcal` : ''}
                {m.calories != null && m.protein != null ? ' · ' : ''}
                {m.protein != null ? `${m.protein} g` : ''}
              </span>
              <button className="btn btn-ghost btn-sm food-x" onClick={() => m.id != null && removeMeal(m.id)} aria-label={`Remove ${m.name}`}>
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {favorites.length > 0 && (
        <div className="food-favs" aria-label={`Favorites for ${label}`}>
          {favorites.map((f) => (
            <button key={f.id} className="food-fav" onClick={() => logFavorite(f, date, slot)} title={`Log ${f.name}`}>
              <span>+ {f.name}</span>
              {f.calories != null && <span className="faint mono">{f.calories}</span>}
            </button>
          ))}
        </div>
      )}

      <form
        className="food-add"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <input className="input food-add-name" placeholder={`Add to ${label.toLowerCase()}…`} value={name} onChange={(e) => onName(e.target.value)} list={listId} aria-label="Meal name" />
        <input className="input food-add-num" inputMode="numeric" placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} aria-label="Calories" />
        <input className="input food-add-num" inputMode="numeric" placeholder="prot g" value={protein} onChange={(e) => setProtein(e.target.value)} aria-label="Protein grams" />
        <label className="food-fav-toggle small muted" title="Save as favorite">
          <input type="checkbox" className="check" checked={fav} onChange={(e) => setFav(e.target.checked)} />
          Fav
        </label>
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
    </section>
  )
}
