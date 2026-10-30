import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Empty, Field, Modal } from '../../components/ui'
import { db, setSetting, type FavoriteMeal, type MealSlot } from '../../db'
import { checkProteinStreak, optNum, SLOTS, TARGETS_KEY, type FoodTargets } from './foodData'
import { today } from '../../lib/dates'

export function TargetsModal({ targets, onClose }: { targets: FoodTargets; onClose: () => void }) {
  const [kcal, setKcal] = useState(targets.calories != null ? String(targets.calories) : '')
  const [protein, setProtein] = useState(targets.protein != null ? String(targets.protein) : '')
  const save = async () => {
    await setSetting(TARGETS_KEY, { calories: optNum(kcal), protein: optNum(protein) } satisfies FoodTargets)
    await checkProteinStreak(today())
    onClose()
  }
  return (
    <Modal title="Daily targets" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <p className="muted small" style={{ margin: 0 }}>
          Optional. Leave blank to just see totals.
        </p>
        <div className="grid grid-2">
          <Field label="Calories (kcal)">
            <input className="input" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} placeholder="e.g. 2200" autoFocus />
          </Field>
          <Field label="Protein (g)">
            <input className="input" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} placeholder="e.g. 150" />
          </Field>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

function FavRow({ f }: { f: FavoriteMeal }) {
  const [name, setName] = useState(f.name)
  const [slot, setSlot] = useState<MealSlot | ''>(f.slot ?? '')
  const [kcal, setKcal] = useState(f.calories != null ? String(f.calories) : '')
  const [protein, setProtein] = useState(f.protein != null ? String(f.protein) : '')
  const dirty =
    name.trim() !== f.name || (slot || undefined) !== f.slot || optNum(kcal) !== f.calories || optNum(protein) !== f.protein
  const save = () => {
    if (f.id == null || !name.trim()) return
    void db.favoriteMeals.update(f.id, { name: name.trim(), slot: slot || undefined, calories: optNum(kcal), protein: optNum(protein) })
  }
  return (
    <div className="list-item food-fav-row">
      <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <select className="select food-fav-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot | '')} aria-label="Slot">
        <option value="">Any slot</option>
        {SLOTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <input className="input food-add-num" inputMode="numeric" placeholder="kcal" value={kcal} onChange={(e) => setKcal(e.target.value)} aria-label="Calories" />
      <input className="input food-add-num" inputMode="numeric" placeholder="prot g" value={protein} onChange={(e) => setProtein(e.target.value)} aria-label="Protein" />
      <span className="faint tiny mono food-fav-uses" title="Times logged">
        {f.uses}×
      </span>
      <button className="btn btn-sm" disabled={!dirty || !name.trim()} onClick={save}>
        Save
      </button>
      <button className="btn btn-ghost btn-sm btn-danger" onClick={() => f.id != null && db.favoriteMeals.delete(f.id)}>
        Delete
      </button>
    </div>
  )
}

export function FavoritesModal({ onClose }: { onClose: () => void }) {
  const favs = useLiveQuery(() => db.favoriteMeals.orderBy('uses').reverse().toArray(), [])
  return (
    <Modal title="Favorites" onClose={onClose}>
      {favs && favs.length === 0 ? (
        <Empty>No favorites yet. Tick “Fav” when adding a meal and it becomes a one-tap chip.</Empty>
      ) : (
        <div className="list">
          {favs?.map((f) => (
            <FavRow key={f.id} f={f} />
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
