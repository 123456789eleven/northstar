import { useState } from 'react'
import { useToast } from '../../components/toastContext'
import type { ISODate, MealSlot } from '../../db'
import { addMeal, removeMeals, SLOTS } from './foodData'
import { parseQuickEntry } from './foodLogic'

/** One-line add above the slots: "3 eggs 210", "shake 600cal 40p". */
export default function QuickAdd({ date, slot, setSlot }: { date: ISODate; slot: MealSlot; setSlot: (s: MealSlot) => void }) {
  const [text, setText] = useState('')
  const toast = useToast()
  const parsed = parseQuickEntry(text)
  const submit = async () => {
    if (!text.trim()) return
    const id = await addMeal({ date, slot, ...parsed })
    setText('')
    toast({ message: `Added ${parsed.name}`, undo: () => removeMeals(id != null ? [id] : []) })
  }
  return (
    <form
      className="food-quick"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <input className="input food-quick-text" placeholder="Quick add: 3 eggs 210, or shake 600cal 40p" value={text} onChange={(e) => setText(e.target.value)} aria-label="Quick add a meal" />
      <select className="select food-quick-slot" value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} aria-label="Meal slot">
        {SLOTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <button className="btn btn-primary" type="submit" disabled={!text.trim()}>
        Add
      </button>
      {text.trim() && (parsed.calories != null || parsed.protein != null) && (
        <span className="tiny faint food-quick-preview">
          {parsed.name}: {parsed.calories != null ? `${parsed.calories} kcal` : 'no kcal'}
          {parsed.protein != null ? `, ${parsed.protein} g protein` : ''}
        </span>
      )}
    </form>
  )
}
