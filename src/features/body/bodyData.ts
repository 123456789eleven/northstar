// Body module writes: weigh-ins (one per date), milestone events, settings. Every write is undoable.
import { db, getSetting, logEvent, setSetting, type Habit, type ISODate, type LifeEvent } from '../../db'
import { TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { milestoneCrossings } from './model'

export interface BodySettings {
  goal: number
  goalDate?: ISODate
  startWeight?: number
  height?: number
  trainDays: number
  maintenance?: number
  surplus: number
  protein?: number
}

export const BODY_DEFAULTS: BodySettings = { goal: 165, trainDays: 4, surplus: 400 }

const KEYS = { goal: 'body.goal', goalDate: 'body.goalDate', startWeight: 'body.startWeight', height: 'body.height', trainDays: 'body.trainDays', maintenance: 'body.maintenance', surplus: 'body.surplus', protein: 'body.protein' } as const

export function readBodySettings(rows: { key: string; value: unknown }[]): BodySettings {
  const m = new Map(rows.map((r) => [r.key, r.value]))
  const num = (k: string) => (typeof m.get(k) === 'number' && Number.isFinite(m.get(k)) ? (m.get(k) as number) : undefined)
  const str = (k: string) => (typeof m.get(k) === 'string' && m.get(k) ? (m.get(k) as string) : undefined)
  return {
    goal: num(KEYS.goal) ?? BODY_DEFAULTS.goal,
    goalDate: str(KEYS.goalDate),
    startWeight: num(KEYS.startWeight),
    height: num(KEYS.height),
    trainDays: num(KEYS.trainDays) ?? BODY_DEFAULTS.trainDays,
    maintenance: num(KEYS.maintenance),
    surplus: num(KEYS.surplus) ?? BODY_DEFAULTS.surplus,
    protein: num(KEYS.protein),
  }
}

/** Save one body setting; undefined clears it (back to the default). */
export async function saveBodySetting(key: keyof typeof KEYS, value: number | string | undefined) {
  if (value === undefined) await db.settings.delete(KEYS[key])
  else await setSetting(KEYS[key], value)
}

export const validWeight = (n: number) => Number.isFinite(n) && n >= 50 && n <= 700

export interface LogResult { undo: () => Promise<void>; milestones: number[]; updated: boolean; weight: number; date: ISODate }

/** Log (or update) the weigh-in for `date`. Writes the weight, its History event, and any new 5 lb milestones, in one transaction. */
export async function logWeight(date: ISODate, weight: number, note?: string): Promise<LogResult | null> {
  if (!validWeight(weight)) return null
  const w = Math.round(weight * 10) / 10
  const created: number[] = []
  const reached: number[] = []
  let prevRow: { id: number; weight: number; note?: string } | undefined
  let prevTitle: string | undefined
  let rowId = 0
  await db.transaction('rw', db.weights, db.events, db.settings, async () => {
    const existing = await db.weights.where('date').equals(date).first()
    const title = `Weighed ${w} lb`
    if (existing?.id != null) {
      prevRow = { id: existing.id, weight: existing.weight, note: existing.note }
      rowId = existing.id
      await db.weights.update(rowId, { weight: w, note: note || existing.note })
      const ev = await db.events.filter((e) => e.kind === 'body.weight' && e.refTable === 'weights' && e.refId === rowId).first()
      if (ev?.id != null) { prevTitle = ev.title; await db.events.update(ev.id, { title }) }
      else created.push((await logEvent({ area: 'body', kind: 'body.weight', title, refTable: 'weights', refId: rowId, at: new Date().toISOString() })) as number)
    } else {
      rowId = (await db.weights.add({ date, weight: w, note: note || undefined })) as number
      created.push((await logEvent({ area: 'body', kind: 'body.weight', title, refTable: 'weights', refId: rowId })) as number)
    }
    // Milestones: the 7-day average first crossing each 5 lb step above the starting weight, then the goal.
    const all = (await db.weights.toArray()).sort((a, b) => a.date.localeCompare(b.date))
    const s = readBodySettings(await db.settings.where('key').startsWith('body.').toArray())
    const start = s.startWeight ?? all[0].weight
    for (const c of milestoneCrossings(all, start, s.goal)) {
      if (!c.date) continue
      const refKey = `body-${c.target}`
      if (await db.events.filter((e) => e.kind === 'body.milestone' && e.refKey === refKey).first()) continue
      const isGoal = c.target === s.goal
      created.push((await logEvent({ area: 'body', kind: 'body.milestone', title: isGoal ? `Reached goal weight: ${c.target} lb` : `7-day average passed ${c.target} lb`, refTable: 'weights', refId: rowId, refKey, milestone: true })) as number)
      reached.push(c.target)
    }
  })
  const undo = async () => {
    await db.transaction('rw', db.weights, db.events, async () => {
      if (prevRow) {
        await db.weights.update(prevRow.id, { weight: prevRow.weight, note: prevRow.note })
        const ev = await db.events.filter((e) => e.kind === 'body.weight' && e.refTable === 'weights' && e.refId === prevRow!.id).first()
        if (ev?.id != null && prevTitle) await db.events.update(ev.id, { title: prevTitle })
      } else {
        await db.weights.delete(rowId)
      }
      await db.events.bulkDelete(created)
    })
  }
  return { undo, milestones: reached, updated: !!prevRow, weight: w, date }
}

/** Remove a weigh-in and its events. Returns an undo that restores the row (events included). */
export async function removeWeight(id: number): Promise<(() => Promise<void>) | null> {
  const row = await db.weights.get(id)
  if (!row) return null
  const evs: LifeEvent[] = await db.events.filter((e) => e.refTable === 'weights' && e.refId === id).toArray()
  await db.transaction('rw', db.weights, db.events, async () => {
    await db.weights.delete(id)
    await db.events.bulkDelete(evs.map((e) => e.id!))
  })
  return async () => {
    const { id: _old, ...rest } = row
    void _old
    const newId = (await db.weights.add(rest)) as number
    await db.events.bulkAdd(evs.map(({ id: _e, ...e }) => ({ ...e, refId: newId })))
  }
}

export const LIFT_RE = /workout|lift|gym|train/i

export const findLiftHabit = (habits: Habit[]) => habits.find((h) => !h.archived && LIFT_RE.test(h.name))

export async function createLiftHabit(perWeek: number): Promise<number> {
  const id = (await db.habits.add({ name: 'Lift', area: 'health', perWeek: Math.min(7, Math.max(1, perWeek)), createdAt: new Date().toISOString() })) as number
  return id
}

/** Write calorie/protein targets to the Food page's own setting (food.targets), keeping any value not supplied. */
export async function applyFoodTargets(t: FoodTargets): Promise<void> {
  const cur = await getSetting<FoodTargets>(TARGETS_KEY, {})
  await setSetting(TARGETS_KEY, { ...cur, ...t })
}
