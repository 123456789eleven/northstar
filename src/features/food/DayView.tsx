import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, Empty, Skeleton } from '../../components/ui'
import { useToast } from '../../components/toastContext'
import { db, type ISODate, type MealSlot } from '../../db'
import { addDays, formatDate, relativeDay, today } from '../../lib/dates'
import LeftToday from './LeftToday'
import QuickAdd from './QuickAdd'
import SlotCard, { type Suggestion } from './SlotCard'
import Suggestions from './Suggestions'
import { useTemplates } from './useTemplates'
import { copyYesterdayIds, removeMeals, SLOTS, sumMeals, type FoodTargets } from './foodData'
import { defaultSlot, leftToday, type Candidate } from './foodLogic'

const LIST_ID = 'food-recent-names'

export default function DayView({ date, setDate, targets, onTargets }: { date: ISODate; setDate: (d: ISODate) => void; targets: FoodTargets; onTargets: () => void }) {
  const toast = useToast()
  const templates = useTemplates()
  const [hour] = useState(() => new Date().getHours())
  const [slot, setSlot] = useState<MealSlot>(() => defaultSlot(hour))
  const picker = useRef<HTMLInputElement>(null)
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

  const counts = useMemo(() => {
    const c = new Map<string, number>()
    for (const m of recent ?? []) {
      const k = m.name.trim().toLowerCase()
      c.set(k, (c.get(k) ?? 0) + 1)
    }
    return c
  }, [recent])

  const own = useMemo(() => {
    const out: Candidate[] = []
    for (const [k, s] of suggestions) if (s.calories != null && s.protein != null) out.push({ name: s.name, calories: s.calories, protein: s.protein, own: true, uses: counts.get(k) ?? 0 })
    return out
  }, [suggestions, counts])

  const recentBySlot = useMemo(() => {
    const favNames = new Set((favorites ?? []).map((f) => f.name.trim().toLowerCase()))
    const out = new Map<string, Suggestion[]>()
    const seen = new Set<string>()
    for (const m of recent ?? []) {
      const k = `${m.slot}|${m.name.trim().toLowerCase()}`
      if (m.date === date || seen.has(k) || favNames.has(m.name.trim().toLowerCase())) continue
      seen.add(k)
      const list = out.get(m.slot) ?? []
      list.push({ name: m.name, calories: m.calories, protein: m.protein })
      out.set(m.slot, list)
    }
    for (const [k, list] of out) {
      list.sort((a, b) => (counts.get(b.name.trim().toLowerCase()) ?? 0) - (counts.get(a.name.trim().toLowerCase()) ?? 0))
      out.set(k, list.slice(0, 3))
    }
    return out
  }, [favorites, recent, date, counts])

  const totals = sumMeals(meals ?? [])
  const isToday = date === today()
  const left = leftToday(targets, totals)
  const remaining = useMemo(() => ({ kcal: left?.kcal ?? 0, protein: left?.protein ?? 0 }), [left?.kcal, left?.protein])
  const copyDay = async () => {
    const ids = await copyYesterdayIds(date)
    toast({ message: ids.length ? `Copied ${ids.length} items from yesterday` : 'Nothing to copy', undo: ids.length ? () => removeMeals(ids) : undefined })
  }

  return (
    <div className="stack food-day">
      <div className="food-stepper">
        <button className="btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
          ‹
        </button>
        <div className="food-stepper-pick">
        <button className="food-stepper-label" onClick={() => picker.current?.showPicker?.()}>
          <strong>{relativeDay(date)}</strong>
          <span className="faint small">{formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span className="sr-only">, pick a date</span>
        </button>
          <input ref={picker} className="food-date-input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} tabIndex={-1} aria-hidden="true" />
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
          <button className="btn" onClick={() => void copyDay()} title="Copy every meal from the previous day">
            Copy yesterday
          </button>
        )}
      </div>

      <LeftToday targets={targets} totals={totals} isToday={isToday} hour={hour} onTargets={onTargets} />
      <QuickAdd date={date} slot={slot} setSlot={setSlot} />
      {left && (left.kcal > 0 || left.protein > 0) && <Suggestions remaining={remaining} own={own} date={date} slot={slot} />}

      {meals && meals.length === 0 && (favorites?.length ?? 0) === 0 && (
        <Card>
          <Empty title="Nothing logged yet">Type what you ate into a slot below; numbers are optional. Tick “Fav” on meals you repeat and they become one-tap chips.</Empty>
        </Card>
      )}

      <datalist id={LIST_ID}>
        {[...suggestions.values()].map((s) => (
          <option key={s.name} value={s.name} />
        ))}
      </datalist>

      {meals === undefined && (
        <div className="grid grid-2" aria-busy="true">
          {SLOTS.map((s) => <Card key={s.value} title={s.label}><Skeleton lines={3} label={`Loading ${s.label}`} /></Card>)}
        </div>
      )}
      {meals !== undefined && <div className="grid grid-2">
        {SLOTS.map((s) => (
          <SlotCard
            key={s.value}
            slot={s.value}
            label={s.label}
            date={date}
            meals={(meals ?? []).filter((m) => m.slot === s.value)}
            favorites={(favorites ?? []).filter((f) => !f.slot || f.slot === s.value).slice(0, 8)}
            suggestions={suggestions}
            recents={recentBySlot.get(s.value) ?? []}
            hasYesterday={(prevMeals ?? []).some((m) => m.slot === s.value)}
            listId={LIST_ID}
            templates={templates}
          />
        ))}
      </div>}
    </div>
  )
}
