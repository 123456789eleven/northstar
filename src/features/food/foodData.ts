// Food module data helpers. All writes go through here so favorites, uses and milestones stay consistent.
import { db, getSetting, logEvent, setSetting, type FavoriteMeal, type ISODate, type Meal, type MealSlot } from '../../db'
import { addDays, today } from '../../lib/dates'
import { MAX_TEMPLATES, MAX_TEMPLATE_ITEMS, parseTemplates, serializeTemplates, TEMPLATES_KEY, type MealTemplate } from './foodLogic'

export const SLOTS: { value: MealSlot; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

export interface FoodTargets {
  calories?: number
  protein?: number
}

export const TARGETS_KEY = 'food.targets'
export { TEMPLATES_KEY }

/** Parse an optional positive number from a text field; blank/invalid → undefined. */
export function optNum(s: string): number | undefined {
  const t = s.trim()
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined
}

export function sumMeals(meals: Meal[]) {
  let calories = 0
  let protein = 0
  for (const m of meals) {
    calories += m.calories ?? 0
    protein += m.protein ?? 0
  }
  return { calories, protein }
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export async function addMeal(m: Omit<Meal, 'id'>, opts: { saveFavorite?: boolean } = {}): Promise<number | undefined> {
  const name = m.name.trim()
  if (!name) return undefined
  const id = (await db.meals.add({ ...m, name })) as number
  if (opts.saveFavorite) {
    const favs = await db.favoriteMeals.toArray()
    const existing = favs.find((f) => sameName(f.name, name))
    if (existing?.id != null) {
      await db.favoriteMeals.update(existing.id, {
        calories: m.calories ?? existing.calories,
        protein: m.protein ?? existing.protein,
        uses: existing.uses + 1,
      })
    } else {
      await db.favoriteMeals.add({ name, slot: m.slot, calories: m.calories, protein: m.protein, uses: 1 })
    }
  }
  await checkProteinStreak(m.date)
  return id
}

export async function logFavorite(f: FavoriteMeal, date: ISODate, slot: MealSlot, times = 1): Promise<number> {
  const n = Math.max(1, times)
  const id = (await db.meals.add({
    date,
    slot,
    name: n === 1 ? f.name : `${f.name} x${n}`,
    calories: f.calories != null ? Math.round(f.calories * n) : undefined,
    protein: f.protein != null ? Math.round(f.protein * n) : undefined,
  })) as number
  if (f.id != null) await db.favoriteMeals.update(f.id, { uses: (f.uses ?? 0) + 1 })
  await checkProteinStreak(date)
  return id
}

/** Undo helper: remove rows added by a one-tap action. */
export async function removeMeals(ids: number[]) {
  if (ids.length) await db.meals.bulkDelete(ids)
}

export async function removeMeal(id: number) {
  await db.meals.delete(id)
}

/** Copy the previous day's meals into `date`. Pass a slot to copy just that slot. Returns rows copied. */
export async function copyYesterday(date: ISODate, slot?: MealSlot): Promise<number> {
  return (await copyYesterdayIds(date, slot)).length
}

/** Same as copyYesterday but returns the new row ids so the caller can offer Undo. */
export async function copyYesterdayIds(date: ISODate, slot?: MealSlot): Promise<number[]> {
  const prev = await db.meals.where('date').equals(addDays(date, -1)).toArray()
  const rows = prev
    .filter((m) => !slot || m.slot === slot)
    .map(({ slot: s, name, calories, protein, notes }) => ({ date, slot: s, name, calories, protein, notes }))
  const ids = rows.length ? ((await db.meals.bulkAdd(rows, { allKeys: true })) as number[]) : []
  await checkProteinStreak(date)
  return ids
}

// ---- Meal templates (settings key food.templates, versioned JSON) ----

export async function loadTemplates(): Promise<MealTemplate[]> {
  return parseTemplates(await getSetting<unknown>(TEMPLATES_KEY, null))
}

export async function saveTemplates(items: MealTemplate[]) {
  await setSetting(TEMPLATES_KEY, serializeTemplates(items))
}

/** Save these meals (one slot) as a named template. Returns false when empty or the cap is reached. */
export async function createTemplate(name: string, meals: Meal[]): Promise<boolean> {
  const all = await loadTemplates()
  const items = meals.slice(0, MAX_TEMPLATE_ITEMS).map((m) => ({ slot: m.slot, name: m.name, calories: m.calories, protein: m.protein }))
  if (!name.trim() || !items.length || all.length >= MAX_TEMPLATES) return false
  await saveTemplates([...all, { id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name: name.trim().slice(0, 60), items }])
  return true
}

export async function applyTemplate(t: MealTemplate, date: ISODate, slot: MealSlot): Promise<number[]> {
  const rows = t.items.map((i) => ({ date, slot, name: i.name, calories: i.calories, protein: i.protein }))
  const ids = rows.length ? ((await db.meals.bulkAdd(rows, { allKeys: true })) as number[]) : []
  await checkProteinStreak(date)
  return ids
}

async function proteinOn(date: ISODate) {
  return sumMeals(await db.meals.where('date').equals(date).toArray()).protein
}

/**
 * If the run of consecutive protein-target days containing `date` reaches 7, log one milestone for that run.
 * The run is identified by its start date (stored as refId YYYYMMDD) so the same streak is never logged twice.
 */
export async function checkProteinStreak(date: ISODate) {
  const targets = await getSetting<FoodTargets>(TARGETS_KEY, {})
  const target = targets.protein
  if (!target) return
  const hit = async (d: ISODate) => (await proteinOn(d)) >= target
  if (!(await hit(date))) return

  let start = date
  let length = 1
  while (length < 400 && (await hit(addDays(start, -1)))) {
    start = addDays(start, -1)
    length++
  }
  const t = today()
  let end = date
  while (end < t && length < 400 && (await hit(addDays(end, 1)))) {
    end = addDays(end, 1)
    length++
  }
  if (length < 7) return

  const runId = Number(start.replaceAll('-', ''))
  const existing = await db.events
    .where('area')
    .equals('health')
    .filter((e) => e.kind === 'protein-streak' && e.refId === runId)
    .count()
  if (existing) return
  await logEvent({
    area: 'health',
    kind: 'protein-streak',
    title: `Hit protein target (${target} g) 7 days straight`,
    refTable: 'meals',
    refId: runId,
    milestone: true,
  })
}

/** Consecutive days with at least one entry, ending today (or yesterday if today has nothing yet). */
export function dayStreak(dates: Set<ISODate>, from: ISODate = today()): number {
  let d = dates.has(from) ? from : addDays(from, -1)
  let n = 0
  while (dates.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}
