// DB writes for the setup wizard. Each reuses the insert path the real page uses (createGoal, saveItem, saveCapture,
// the same tables and logEvent calls) so data entered here is ordinary user data: not tagged demo, synced like the rest.
import { db, getSetting, logEvent, setSetting, type Area, type Goal, type ISODate, type LearningItem } from '../../db'
import { money, today } from '../../lib/dates'
import type { TaskCapture } from '../../lib/capture'
import { createGoal } from '../goals/goalActions'
import { saveItem } from '../learning/learningData'
import { checkProteinStreak, TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { saveCapture } from '../tasks/captureSave'
import { nameKey, SETUP_DONE_KEY, WEEKLY_TARGET_KEY, type HabitSuggestion } from './setupLogic'

export type AddResult = 'added' | 'duplicate' | 'invalid'

export async function addGoal(title: string, horizon: Goal['horizon'], area: Area, targetDate?: ISODate): Promise<AddResult> {
  const t = title.trim()
  if (!t) return 'invalid'
  const all = await db.goals.toArray()
  if (all.some((g) => nameKey(g.title) === nameKey(t))) return 'duplicate'
  // A quarter goal hangs under the life goal when there is exactly one to choose from.
  const lifes = all.filter((g) => g.horizon === 'life' && g.status === 'active')
  const parentId = horizon === 'quarter' && lifes.length === 1 ? lifes[0].id : undefined
  await createGoal({ title: t, area, horizon, status: 'active', targetDate, parentId })
  return 'added'
}

export async function addHabit(h: HabitSuggestion | { name: string }): Promise<AddResult> {
  const name = h.name.trim()
  if (!name) return 'invalid'
  const all = await db.habits.toArray()
  if (all.some((x) => nameKey(x.name) === nameKey(name))) return 'duplicate'
  const full = { area: 'personal' as Area, perWeek: 7, ...h, name }
  await db.habits.add({ name: full.name, area: full.area, perWeek: full.perWeek, createdAt: new Date().toISOString() })
  return 'added'
}

/** Same rule as the Budgets page: upsert by category, remove when the limit is 0, log the first budget. */
export async function saveBudget(category: string, limit: number) {
  const before = await db.budgets.count()
  const existing = await db.budgets.where('category').equals(category).first()
  if (limit <= 0) {
    if (existing) await db.budgets.delete(existing.id!)
    return
  }
  const id = existing ? (await db.budgets.update(existing.id!, { monthlyLimit: limit }), existing.id!) : await db.budgets.add({ category, monthlyLimit: limit })
  if (before === 0) await logEvent({ area: 'finance', kind: 'finance.budget', title: `Set first budget: ${category} ${money(limit)}/mo`, refTable: 'budgets', refId: id })
}

/** Save only the categories whose value changed; returns how many were written. */
export async function saveBudgets(values: Record<string, number | undefined>): Promise<number> {
  const current = new Map((await db.budgets.toArray()).map((b) => [b.category, b.monthlyLimit]))
  let n = 0
  for (const [cat, v] of Object.entries(values)) {
    if (v == null) continue
    if (current.get(cat) === v) continue
    await saveBudget(cat, v)
    n++
  }
  return n
}

export async function saveFoodTargets(calories?: number, protein?: number) {
  const prev = await getSetting<FoodTargets>(TARGETS_KEY, {})
  await setSetting(TARGETS_KEY, { calories: calories ?? prev.calories, protein: protein ?? prev.protein } satisfies FoodTargets)
  await checkProteinStreak(today())
}

export async function addPerson(p: { name: string; relation: string; cadenceDays: number; birthday?: string }): Promise<AddResult> {
  const name = p.name.trim()
  if (!name) return 'invalid'
  const all = await db.people.toArray()
  if (all.some((x) => nameKey(x.name) === nameKey(name))) return 'duplicate'
  await db.people.add({ name, relation: p.relation.trim(), cadenceDays: p.cadenceDays, birthday: p.birthday })
  return 'added'
}

export async function addLearning(title: string, kind: LearningItem['kind']): Promise<AddResult> {
  const t = title.trim()
  if (!t) return 'invalid'
  const all = await db.learning.toArray()
  if (all.some((x) => nameKey(x.title) === nameKey(t))) return 'duplicate'
  await saveItem({ title: t, kind, status: 'active', progress: 0 })
  return 'added'
}

export const setWeeklyTarget = (min: number) => setSetting(WEEKLY_TARGET_KEY, min)

/** Add parsed task lines, skipping open tasks that already have the same title. Returns added/skipped counts. */
export async function addTasks(tasks: TaskCapture[]): Promise<{ added: number; skipped: number }> {
  const open = await db.tasks.where('status').equals('open').toArray()
  const seen = new Set(open.map((t) => nameKey(t.title)))
  let added = 0
  let skipped = 0
  for (const t of tasks) {
    const k = nameKey(t.title)
    if (!k || seen.has(k)) { skipped++; continue }
    seen.add(k)
    await saveCapture(t)
    added++
  }
  return { added, skipped }
}

export const markSetupDone = () => setSetting(SETUP_DONE_KEY, true)
