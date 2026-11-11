// Gym, Kitchen floor: hero (calorie and protein rings, favourites, quick add), then meals, the week and what fits.
// Week view, favourites, templates, targets, copy yesterday and a date picker sit behind More. /food?focus=<date> still opens a day.
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useToast } from '../components/toastContext'
import { db, type ISODate, type MealSlot } from '../db'
import { addDays, today } from '../lib/dates'
import { useFocusParam, useFocusTarget } from '../lib/useFocusParam'
import { FloorCard, FloorMore, FloorView } from '../features/buildings/Floor'
import DayStrip from '../features/food/DayStrip'
import KitchenHero from '../features/food/KitchenHero'
import SlotCard, { type Suggestion } from '../features/food/SlotCard'
import Suggestions from '../features/food/Suggestions'
import WeekView from '../features/food/WeekView'
import TemplatesModal from '../features/food/TemplatesModal'
import { FavoritesModal, TargetsModal } from '../features/food/FoodModals'
import { useTemplates } from '../features/food/useTemplates'
import { copyYesterdayIds, effectiveCalorieTarget, effectiveProteinTarget, removeMeals, SLOTS, sumMeals, TARGETS_KEY, type FoodTargets } from '../features/food/foodData'
import { BODY_DEFAULTS } from '../features/body/bodyData'
import { defaultSlot, leftToday, type Candidate } from '../features/food/foodLogic'
import '../features/food/food.css'
import '../features/food/food2.css'
import '../features/body/gym.css'

const LIST_ID = 'food-recent-names'

export default function Food() {
  const toast = useToast()
  const [date, setDate] = useState<ISODate>(today())
  const [modal, setModal] = useState<'targets' | 'favorites' | 'templates' | null>(null)
  const [hour] = useState(() => new Date().getHours())
  const [slot, setSlot] = useState<MealSlot>(() => defaultSlot(hour))
  const templates = useTemplates()
  const targetsRow = useLiveQuery(() => db.settings.get(TARGETS_KEY), [])
  const goalRow = useLiveQuery(() => db.settings.get('body.goal'), [])
  const meals = useLiveQuery(() => db.meals.where('date').equals(date).toArray(), [date])
  const prevMeals = useLiveQuery(() => db.meals.where('date').equals(addDays(date, -1)).toArray(), [date])
  const favorites = useLiveQuery(() => db.favoriteMeals.orderBy('uses').reverse().toArray(), [])
  const recent = useLiveQuery(() => db.meals.orderBy('date').reverse().limit(400).toArray(), [])

  const focusDay = useFocusParam().focus
  const hasMeals = useLiveQuery(async () => (focusDay ? (await db.meals.where('date').equals(focusDay).count()) > 0 : undefined), [focusDay])
  useFocusTarget({ ready: !focusDay || hasMeals !== undefined, exists: () => !!hasMeals, reveal: (id) => setDate(id) })

  const stored = (targetsRow?.value as FoodTargets | undefined) ?? {}
  const isDefault = !stored.calories
  const targets: FoodTargets = { ...stored, calories: effectiveCalorieTarget(stored), protein: effectiveProteinTarget(stored, Number(goalRow?.value ?? BODY_DEFAULTS.goal)) }

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
    for (const m of recent ?? []) { const k = m.name.trim().toLowerCase(); c.set(k, (c.get(k) ?? 0) + 1) }
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
  const left = leftToday(targets, totals)
  const remaining = useMemo(() => ({ kcal: left?.kcal ?? 0, protein: left?.protein ?? 0 }), [left?.kcal, left?.protein])
  const copyDay = async () => {
    const ids = await copyYesterdayIds(date)
    toast({ message: ids.length ? `Copied ${ids.length} items from yesterday` : 'Nothing to copy', undo: ids.length ? () => removeMeals(ids) : undefined })
  }

  const hero = (
    <KitchenHero date={date} setDate={setDate} targets={targets} totals={totals} ready={meals !== undefined} isDefault={isDefault} slot={slot} setSlot={setSlot} hour={hour} />
  )

  const mealsCard = (
    <FloorCard key="meals" title="Meals" className="kit-meals-card">
      <datalist id={LIST_ID}>{[...suggestions.values()].map((s) => <option key={s.name} value={s.name} />)}</datalist>
      <div className="kit-meals" data-focus-id={date}>
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
      </div>
    </FloorCard>
  )

  const weekCard = (
    <FloorCard key="week" title="This week">
      <DayStrip date={date} targets={targets} onPick={setDate} />
    </FloorCard>
  )

  const fits = left && (left.kcal > 0 || left.protein > 0) ? <Suggestions key="fits" remaining={remaining} own={own} date={date} slot={slot} /> : null

  const more = (
    <FloorMore
      floor="Kitchen"
      items={[
        { id: 'week', label: 'Week view', panel: (close) => <WeekView end={date} targets={targets} onOpen={(d) => { setDate(d); close() }} /> },
        { id: 'favorites', label: 'Favorites', value: favorites?.length || undefined, onSelect: () => setModal('favorites') },
        { id: 'templates', label: 'Templates', value: templates.length || undefined, onSelect: () => setModal('templates') },
        { id: 'targets', label: 'Daily targets', value: `${(targets.calories ?? 0).toLocaleString()} kcal, ${targets.protein} g`, onSelect: () => setModal('targets') },
        ...((prevMeals?.length ?? 0) > 0 ? [{ id: 'copy', label: 'Copy yesterday', onSelect: () => void copyDay() }] : []),
        {
          id: 'date', label: 'Pick a date', panel: (close: () => void) => (
            <label className="stack" style={{ gap: 6 }}>
              <span className="small faint">Day to open</span>
              <input className="input" type="date" max={today()} value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); close() } }} />
            </label>
          ),
        },
      ]}
    />
  )

  return (
    <>
      <FloorView label="Kitchen" className="gym-floor" hero={hero} support={[mealsCard, weekCard, fits]} more={more} />
      {modal === 'targets' && <TargetsModal targets={stored} onClose={() => setModal(null)} />}
      {modal === 'templates' && <TemplatesModal onClose={() => setModal(null)} />}
      {modal === 'favorites' && <FavoritesModal onClose={() => setModal(null)} />}
    </>
  )
}
