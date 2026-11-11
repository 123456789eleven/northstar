// Kitchen floor hero: the calorie ring (target defaults to 3,000) and the protein ring, the day, one tap on a favorite or a
// one-line quick add. Logging sweeps the rings forward (spring) with a small pop on the number and an opt-in haptic tick.
import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useToast } from '../../components/toastContext'
import { PHONE_QUERY, useMedia } from '../../components/useMedia'
import { db, setSetting, type ISODate, type MealSlot } from '../../db'
import { addDays, relativeDay, today } from '../../lib/dates'
import { celebrate } from '../game/ui/feedback'
import MacroRings from './MacroRings'
import QuickAdd from './QuickAdd'
import { logFavorite, removeMeals, TARGETS_KEY, type FoodTargets } from './foodData'
import { behindMessage } from './foodLogic'

export default function KitchenHero({ date, setDate, targets, totals, ready, isDefault, slot, setSlot, hour }: {
  date: ISODate
  setDate: (d: ISODate) => void
  targets: FoodTargets
  totals: { calories: number; protein: number }
  ready: boolean
  isDefault: boolean
  slot: MealSlot
  setSlot: (s: MealSlot) => void
  hour: number
}) {
  const toast = useToast()
  const favorites = useLiveQuery(() => db.favoriteMeals.orderBy('uses').reverse().limit(6).toArray(), [])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const isToday = date === today()
  // The ring already says how much is left; the coach line keeps only the advice.
  const behind = isToday ? behindMessage(targets, totals, hour)?.replace(/^[\d,]+ kcal to go\.\s*/, '') || null : null
  const phone = useMedia(PHONE_QUERY)

  const saveCalories = async () => {
    const n = Math.round(Number(draft))
    if (!Number.isFinite(n) || n < 500 || n > 10000) { toast({ message: 'That target looks off. Try a number between 500 and 10,000 calories.' }); return }
    const cur = await db.settings.get(TARGETS_KEY)
    await setSetting(TARGETS_KEY, { ...((cur?.value as FoodTargets | undefined) ?? {}), calories: n } satisfies FoodTargets)
    setEditing(false)
    toast({ message: `Daily target set to ${n.toLocaleString()} kcal` })
  }

  const line = behind ?? (totals.calories === 0 ? (isToday ? 'Nothing logged yet. First plate counts.' : 'Nothing logged this day.') : null)

  return (
    <section className="card floor-hero kit-hero" aria-label="Kitchen">
      <div className="kit-day">
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
        <strong>{relativeDay(date)}</strong>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day" disabled={isToday}>›</button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(today())}>Back to today</button>}
      </div>
      <div className="kit-rings">
        <MacroRings targets={targets} totals={totals} ready={ready} size={phone ? 112 : 132} />
      </div>
      <div className="kit-main">
        {line && <p className={`kit-coach${behind ? ' is-behind' : ''}`} data-testid="food-coach">{line}</p>}
        {(favorites?.length ?? 0) > 0 && (
          <div className="kit-favs" role="group" aria-label="Favorites">
            {favorites!.map((f) => (
              <button
                key={f.id}
                className="kit-fav"
                onClick={async () => {
                  const id = await logFavorite(f, date, f.slot ?? slot, 1)
                  celebrate('tick')
                  toast({ message: `Added ${f.name}`, undo: () => removeMeals([id]) })
                }}
              >
                <span>{f.name}</span>
                {f.calories != null && <span className="mono">{f.calories}</span>}
              </button>
            ))}
          </div>
        )}
        <QuickAdd date={date} slot={slot} setSlot={setSlot} />
        {isDefault && (
          <div className="food-default small faint" data-testid="food-default">
            {editing ? (
              <form className="row" onSubmit={(e) => { e.preventDefault(); void saveCalories() }}>
                <input className="input food-default-input" inputMode="numeric" autoFocus aria-label="Daily calorie target" placeholder="3000" value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="btn btn-primary btn-sm" type="submit">Save</button>
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </form>
            ) : (
              <span>Default target. <button className="btn btn-ghost btn-sm food-default-edit" onClick={() => { setDraft(String(targets.calories ?? '')); setEditing(true) }}>Change it</button></span>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
