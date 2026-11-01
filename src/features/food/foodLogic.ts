// Pure food helpers (no DB, no React): quick-entry parsing, "left today", suggestion ranking, week adherence, templates.
import { FOODS } from '../../data/foods'
import type { MealSlot } from '../../db'
import type { FoodTargets } from './foodData'

// ---------- Quick entry ----------

export interface QuickEntry {
  name: string
  calories?: number
  protein?: number
}

/**
 * Parse one line like "3 eggs 210", "shake 600cal 40p" or "chicken rice, 650, 45g protein".
 * Protein takes a p / g / gp / protein suffix; calories take cal / kcal / calories or a bare trailing number >= 10.
 * A leading quantity stays in the name ("3 eggs"). If nothing numeric is recognised the whole text is the name.
 */
export function parseQuickEntry(input: string): QuickEntry {
  let s = ` ${input.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()} `
  let protein: number | undefined
  let calories: number | undefined
  const take = (re: RegExp): number | undefined => {
    const m = re.exec(s)
    if (!m) return undefined
    s = s.slice(0, m.index) + ' ' + s.slice(m.index + m[0].length)
    return Math.round(Number(m[1]))
  }
  protein = take(/\s(\d+(?:\.\d+)?)\s*(?:g\s*protein|gp|p|g|protein)(?=\s)/i)
  calories = take(/\s(\d+(?:\.\d+)?)\s*(?:kcal|calories|cals|cal|c)(?=\s)/i)
  s = s.replace(/\s+/g, ' ').trim()
  if (calories == null) {
    const m = /^(.*\D)\s(\d+(?:\.\d+)?)$/.exec(s)
    if (m && m[1].trim() && Number(m[2]) >= 10) {
      calories = Math.round(Number(m[2]))
      s = m[1].trim()
    }
  }
  if (!s) return { name: input.trim() }
  return { name: s, calories, protein }
}

/** "Name" scaled for a quantity multiplier: 2 -> "Name x2", with numbers doubled. */
export function scaleItem<T extends { name: string; calories?: number; protein?: number }>(item: T, n: number): T {
  if (n === 1) return item
  return {
    ...item,
    name: `${item.name} x${n}`,
    calories: item.calories != null ? Math.round(item.calories * n) : undefined,
    protein: item.protein != null ? Math.round(item.protein * n) : undefined,
  }
}

// ---------- Left today ----------

export interface Left {
  kcal: number
  protein: number
  kcalPct: number
  proteinPct: number
}

export function leftToday(targets: FoodTargets, totals: { calories: number; protein: number }): Left | null {
  if (!targets.calories && !targets.protein) return null
  const pct = (v: number, t?: number) => (t ? (v / t) * 100 : 0)
  return {
    kcal: targets.calories ? Math.max(0, targets.calories - totals.calories) : 0,
    protein: targets.protein ? Math.max(0, targets.protein - totals.protein) : 0,
    kcalPct: pct(totals.calories, targets.calories),
    proteinPct: pct(totals.protein, targets.protein),
  }
}

/** How many eating occasions are realistically left at this local hour. */
export function mealsLeft(hour: number): number {
  if (hour >= 20) return 1
  if (hour >= 16) return 2
  if (hour >= 12) return 3
  return 4
}

/** A plain "behind" sentence when it is afternoon or later and intake lags the clock, else null. */
export function behindMessage(targets: FoodTargets, totals: { calories: number; protein: number }, hour: number): string | null {
  if (!targets.calories || hour < 12) return null
  const left = targets.calories - totals.calories
  if (left <= 0) return null
  const dayFraction = Math.min(1, Math.max(0, (hour - 7) / 15))
  if (totals.calories / targets.calories >= dayFraction - 0.1) return null
  const n = mealsLeft(hour)
  const per = Math.round(left / n / 10) * 10
  return `${left.toLocaleString()} kcal to go, ${n} meal${n === 1 ? '' : 's'} of ${per.toLocaleString()}`
}

export function defaultSlot(hour: number): MealSlot {
  if (hour < 10) return 'breakfast'
  if (hour < 15) return 'lunch'
  if (hour < 17) return 'snack'
  return 'dinner'
}

/** Estimate only: weight x 15 + 400 kcal, 0.8 g protein per lb. */
export function suggestTargets(weightLb: number): { calories: number; protein: number } {
  return { calories: Math.round((weightLb * 15 + 400) / 10) * 10, protein: Math.round(weightLb * 0.8) }
}

// ---------- Suggestions ----------

export interface Candidate {
  name: string
  calories: number
  protein: number
  serving?: string
  /** user favorite / frequently logged: small nudge up */
  own?: boolean
  uses?: number
}

export interface Ranked extends Candidate {
  score: number
}

/**
 * Rank foods for "what fits what is left". Deterministic: protein density, how much of the remaining protein
 * and calories the item covers, a penalty for overshooting calories, a nudge for the user's own foods. Ties by name.
 * Items under 100 kcal are skipped (not worth the effort on a bulk). Returns [] when nothing is left to eat.
 */
export function rankSuggestions(remaining: { kcal: number; protein: number }, candidates: Candidate[], limit = 8): Ranked[] {
  const remK = Math.max(0, remaining.kcal)
  const remP = Math.max(0, remaining.protein)
  if (remK <= 0 && remP <= 0) return []
  const seen = new Set<string>()
  const out: Ranked[] = []
  for (const c of candidates) {
    const key = c.name.trim().toLowerCase()
    if (!(c.calories >= 100) || seen.has(key)) continue
    seen.add(key)
    const dens = Math.min((c.protein / c.calories) * 100, 20) / 20
    const fitP = remP > 0 ? Math.min(1, (c.protein / remP) * 3) : 0
    const fitK = remK > 0 ? Math.min(1, (c.calories / remK) * 3) : 0
    let score = 0.4 * dens + 0.3 * fitP + 0.3 * fitK
    if (remK > 0 && c.calories > remK * 1.15) score *= 0.4
    if (c.own) score += 0.05 + Math.min(c.uses ?? 0, 10) * 0.005
    out.push({ ...c, score })
  }
  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  return out.slice(0, limit)
}

// name -> bulk staples taken from the built-in reference
const BULK_FROM_REF = [
  'Peanut butter', 'Whole milk', 'Egg, large', 'Greek yogurt, plain whole', 'Rolled oats, dry', 'Chicken breast, cooked', 'Chicken thigh, cooked',
  'Bagel, plain', 'Almonds', 'Cashews', 'Olive oil', 'White rice, cooked', 'Cottage cheese, low fat', 'Ground beef 85% lean, cooked', 'Trail mix',
  'Protein bar', 'Salmon, cooked', 'PB&J sandwich', 'Chicken burrito bowl', 'Avocado',
]

// Approximate curated extras: calorie-dense, high-protein, easy.
const BULK_EXTRA: { name: string; serving: string; calories: number; protein: number }[] = [
  { name: 'Bulk shake (milk, whey, peanut butter, banana)', serving: '1 large', calories: 750, protein: 50 },
  { name: 'Whole milk, 2 cups', serving: '2 cups', calories: 300, protein: 16 },
  { name: 'Eggs, 3 scrambled in butter', serving: '3 eggs', calories: 280, protein: 19 },
  { name: 'Chicken and rice bowl', serving: '1 bowl', calories: 650, protein: 45 },
  { name: 'Peanut butter on toast, 2 slices', serving: '2 slices', calories: 430, protein: 16 },
  { name: 'Overnight oats with peanut butter', serving: '1 jar', calories: 550, protein: 24 },
  { name: 'Greek yogurt with granola and honey', serving: '1 bowl', calories: 420, protein: 22 },
  { name: 'Bagel with cream cheese and egg', serving: '1 bagel', calories: 480, protein: 22 },
]

export function bulkStaples(): Candidate[] {
  const byName = new Map(FOODS.map((f) => [f.name, f]))
  const fromRef: Candidate[] = BULK_FROM_REF.flatMap((n) => {
    const f = byName.get(n)
    return f ? [{ name: f.name, calories: f.kcal, protein: f.protein, serving: f.serving }] : []
  })
  return [...fromRef, ...BULK_EXTRA]
}

// ---------- Week adherence ----------

export type DayState = 'met' | 'close' | 'missed' | 'none' | 'empty'

/** met >= 95%, close 80-95%, else missed. 'none' = no target, 'empty' = nothing logged. */
export function dayState(value: number, target: number | undefined, logged: boolean): DayState {
  if (!target) return 'none'
  if (!logged) return 'empty'
  const r = value / target
  return r >= 0.95 ? 'met' : r >= 0.8 ? 'close' : 'missed'
}

export interface WeekDay {
  date: string
  logged: boolean
  calories: number
  protein: number
}

export function weekSummary(days: WeekDay[], targets: FoodTargets) {
  const logged = days.filter((d) => d.logged)
  const avg = (k: 'calories' | 'protein') => (logged.length ? Math.round(logged.reduce((a, d) => a + d[k], 0) / logged.length) : 0)
  const hits = (k: 'calories' | 'protein') => (targets[k] ? days.filter((d) => dayState(d[k], targets[k], d.logged) === 'met').length : 0)
  return { loggedDays: logged.length, avgCalories: avg('calories'), avgProtein: avg('protein'), calHits: hits('calories'), proteinHits: hits('protein') }
}

// ---------- Templates ----------

export interface TemplateItem {
  slot?: MealSlot
  name: string
  calories?: number
  protein?: number
}

export interface MealTemplate {
  id: string
  name: string
  items: TemplateItem[]
}

export const TEMPLATES_KEY = 'food.templates'
export const MAX_TEMPLATES = 20
export const MAX_TEMPLATE_ITEMS = 12

/** Versioned envelope; tolerant parse so a bad synced value never breaks the page. */
export function parseTemplates(raw: unknown): MealTemplate[] {
  const o = raw as { v?: number; items?: unknown } | null
  if (!o || o.v !== 1 || !Array.isArray(o.items)) return []
  const out: MealTemplate[] = []
  for (const t of o.items as Partial<MealTemplate>[]) {
    if (!t || typeof t.id !== 'string' || typeof t.name !== 'string' || !Array.isArray(t.items)) continue
    const items = t.items
      .filter((i): i is TemplateItem => !!i && typeof i.name === 'string' && i.name.trim() !== '')
      .slice(0, MAX_TEMPLATE_ITEMS)
      .map((i) => ({ slot: i.slot, name: i.name, calories: typeof i.calories === 'number' ? i.calories : undefined, protein: typeof i.protein === 'number' ? i.protein : undefined }))
    if (items.length) out.push({ id: t.id, name: t.name, items })
  }
  return out.slice(0, MAX_TEMPLATES)
}

export const serializeTemplates = (items: MealTemplate[]) => ({ v: 1, items: items.slice(0, MAX_TEMPLATES) })
