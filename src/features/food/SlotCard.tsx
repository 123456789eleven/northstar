import { useState } from 'react'
import type { FavoriteMeal, ISODate, Meal, MealSlot } from '../../db'
import FoodLookup from './FoodLookup'
import { useToast } from '../../components/toastContext'
import { addMeal, applyTemplate, copyYesterdayIds, createTemplate, logFavorite, optNum, removeMeal, removeMeals, sumMeals } from './foodData'
import { parseQuickEntry, scaleItem, type MealTemplate } from './foodLogic'

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
  recents,
  hasYesterday,
  listId,
  templates,
}: {
  slot: MealSlot
  label: string
  date: ISODate
  meals: Meal[]
  favorites: FavoriteMeal[]
  /** name (lowercased) → last-known numbers, for prefill. */
  suggestions: Map<string, Suggestion>
  /** Recently logged meals for this slot that are not favorites: one-tap chips. */
  recents: Suggestion[]
  hasYesterday: boolean
  /** id of the shared recent-names datalist */
  listId: string
  templates: MealTemplate[]
}) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [fav, setFav] = useState(false)
  const [mult, setMult] = useState(1)
  const [tplName, setTplName] = useState<string | null>(null)
  const toast = useToast()
  const totals = sumMeals(meals)

  const undoable = async (message: string, ids: (number | undefined)[]) => {
    const real = ids.filter((x): x is number => x != null)
    toast({ message, undo: () => removeMeals(real) })
  }

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
    // "3 eggs 210" or "shake 600cal 40p" typed into the name box fills blank number fields.
    const p = parseQuickEntry(name)
    const id = await addMeal({ date, slot, name: p.name, calories: optNum(kcal) ?? p.calories, protein: optNum(protein) ?? p.protein }, { saveFavorite: fav })
    void undoable(`Added ${p.name}`, [id])
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
        <span className="row" style={{ gap: 4 }}>
          {meals.length > 0 && tplName == null && (
            <button className="btn btn-ghost btn-sm" onClick={() => setTplName(label === 'Snack' ? 'Usual snack' : `Usual ${label.toLowerCase()}`)}>
              Save as template
            </button>
          )}
          {hasYesterday && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                const ids = await copyYesterdayIds(date, slot)
                toast({ message: `Copied ${ids.length} from yesterday's ${label.toLowerCase()}`, undo: () => removeMeals(ids) })
              }}
              title={`Copy yesterday's ${label.toLowerCase()}`}
            >
              Copy yesterday
            </button>
          )}
        </span>
      </div>

      {tplName != null && (
        <form
          className="row food-tpl-save"
          onSubmit={async (e) => {
            e.preventDefault()
            const ok = await createTemplate(tplName, meals)
            toast({ message: ok ? `Saved template “${tplName.trim()}”` : 'Could not save template (name needed, max 20)' })
            setTplName(null)
          }}
        >
          <input className="input grow" value={tplName} onChange={(e) => setTplName(e.target.value)} aria-label="Template name" autoFocus />
          <button className="btn btn-primary btn-sm" type="submit">
            Save
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setTplName(null)}>
            Cancel
          </button>
        </form>
      )}

      {templates.length > 0 && (
        <div className="food-favs" aria-label={`Templates for ${label}`}>
          {templates.map((t) => (
            <button
              key={t.id}
              className="food-fav food-tpl-chip"
              title={t.items.map((i) => i.name).join(', ')}
              onClick={async () => {
                const ids = await applyTemplate(t, date, slot)
                toast({ message: `Added ${t.name}`, undo: () => removeMeals(ids) })
              }}
            >
              <span>+ {t.name}</span>
              <span className="faint mono">{t.items.length}</span>
            </button>
          ))}
        </div>
      )}

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

      {(favorites.length > 0 || recents.length > 0) && (
        <div className="food-favs" aria-label={`Favorites and recent for ${label}`}>
          <button className="food-fav food-mult" onClick={() => setMult(mult >= 3 ? 1 : mult + 1)} title="Quantity multiplier for the chips" aria-label={`Quantity multiplier x${mult}`}>
            x{mult}
          </button>
          {favorites.map((f) => (
            <button key={f.id} className="food-fav" onClick={async () => { const id = await logFavorite(f, date, slot, mult); void undoable(`Added ${f.name}${mult > 1 ? ` x${mult}` : ''}`, [id]) }} title={`Log ${f.name}`}>
              <span>+ {f.name}</span>
              {f.calories != null && <span className="faint mono">{f.calories}</span>}
            </button>
          ))}
          {recents.map((r) => (
            <button key={r.name} className="food-fav food-recent" onClick={async () => { const id = await addMeal({ date, slot, ...scaleItem(r, mult) }); void undoable(`Added ${r.name}${mult > 1 ? ` x${mult}` : ''}`, [id]) }} title={`Log ${r.name} again`}>
              <span>+ {r.name}</span>
              {r.calories != null && <span className="faint mono">{r.calories}</span>}
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
        <label className="food-fav-toggle small muted" title="Save as a favorite chip for this slot">
          <input type="checkbox" className="check" checked={fav} onChange={(e) => setFav(e.target.checked)} />
          Fav
        </label>
        <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      <FoodLookup
        query={name}
        onPick={(f) => {
          setName(f.name)
          setKcal(f.kcal != null ? String(f.kcal) : '')
          setProtein(f.protein != null ? String(f.protein) : '')
        }}
      />
    </section>
  )
}
