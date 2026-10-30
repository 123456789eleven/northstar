// Install / remove starter packs. Installed rows are ordinary, syncing data. Only the bookkeeping (which rows a pack
// created and what they looked like) lives in the device-local setting `packs.<id>`, so removal can tell untouched
// rows from rows the user has edited, completed or checked in on.
import { db, logEvent, type Budget, type Goal, type Habit, type LearningItem, type Task } from '../../db'
import { addDays, today } from '../../lib/dates'
import { newId } from '../goals/progress'
import { PACKS, type Pack } from './packDefs'

export const PACK_KEY_PREFIX = 'packs.'
export const packKey = (id: string) => PACK_KEY_PREFIX + id

type PackTable = 'goals' | 'learning' | 'habits' | 'tasks' | 'budgets'
const TABLES: PackTable[] = ['goals', 'learning', 'habits', 'tasks', 'budgets']

export interface PackRecord {
  at: string
  items: Partial<Record<PackTable, { id: number; sig: string }[]>>
}
export interface InstallResult {
  added: number
  skipped: number
}
export interface RemoveResult {
  removed: number
  kept: number
}

/** Stable fingerprint of a row (key order independent, id excluded). */
export function sigOf(row: object): string {
  const o = row as Record<string, unknown>
  return JSON.stringify(Object.keys(o).filter((k) => k !== 'id').sort().map((k) => [k, o[k]]))
}

export async function getPackRecord(id: string): Promise<PackRecord | null> {
  return ((await db.settings.get(packKey(id)))?.value as PackRecord | undefined) ?? null
}

const norm = (s: string) => s.trim().toLowerCase()

export async function installPack(pack: Pack): Promise<InstallResult> {
  return db.transaction('rw', [db.goals, db.learning, db.habits, db.tasks, db.budgets, db.events, db.settings], async () => {
    if (await getPackRecord(pack.id)) return { added: 0, skipped: 0 }
    const t0 = today()
    const now = new Date().toISOString()
    const rec: PackRecord = { at: now, items: {} }
    let added = 0
    let skipped = 0
    const track = (table: PackTable, id: number, row: object) => {
      ;(rec.items[table] ??= []).push({ id, sig: sigOf(row) })
      added++
    }
    const have = async (table: PackTable, field: string) => new Set((await db.table(table).toArray()).map((r) => norm(String(r[field] ?? ''))))

    // Goals first (parents before children); a skipped duplicate still lends its id to the items that link to it.
    const goalIds = new Map<string, number>()
    const existingGoals = await db.goals.toArray()
    for (const g of pack.goals ?? []) {
      const dup = existingGoals.find((e) => norm(e.title) === norm(g.title))
      if (dup) {
        goalIds.set(g.key, dup.id!)
        skipped++
        continue
      }
      const row: Omit<Goal, 'id'> = {
        title: g.title, area: g.area, horizon: g.horizon, status: 'active', createdAt: now,
        milestones: (g.milestones ?? []).map((title) => ({ id: newId(), title, done: false })),
        ...(g.parent && goalIds.has(g.parent) ? { parentId: goalIds.get(g.parent) } : {}),
        ...(g.why ? { why: g.why } : {}),
        ...(g.targetInDays ? { targetDate: addDays(t0, g.targetInDays) } : {}),
      }
      const id = (await db.goals.add(row)) as number
      goalIds.set(g.key, id)
      existingGoals.push({ ...row, id })
      track('goals', id, row)
    }
    const link = (key?: string) => (key && goalIds.has(key) ? { goalId: goalIds.get(key) } : {})

    let names = await have('learning', 'title')
    for (const l of pack.learning ?? []) {
      if (names.has(norm(l.title))) { skipped++; continue }
      const row: Omit<LearningItem, 'id'> = { title: l.title, kind: l.kind, provider: l.note, status: 'planned', progress: 0, createdAt: now, ...link(l.goal) }
      track('learning', (await db.learning.add(row)) as number, row)
    }
    names = await have('habits', 'name')
    for (const h of pack.habits ?? []) {
      if (names.has(norm(h.name))) { skipped++; continue }
      const row: Omit<Habit, 'id'> = { name: h.name, area: h.area, perWeek: h.perWeek, createdAt: now, ...link(h.goal) }
      track('habits', (await db.habits.add(row)) as number, row)
    }
    names = await have('tasks', 'title')
    for (const k of pack.tasks ?? []) {
      if (names.has(norm(k.title))) { skipped++; continue }
      const due = addDays(t0, k.dueInDays)
      const row: Omit<Task, 'id'> = {
        title: k.title, due, priority: k.priority, status: 'open', recurrence: k.recurrence, createdAt: now,
        ...(k.recurrence === 'monthly' ? { recurDay: Number(due.slice(8, 10)) } : {}),
        ...link(k.goal),
      }
      track('tasks', (await db.tasks.add(row)) as number, row)
    }
    names = await have('budgets', 'category')
    for (const b of pack.budgets ?? []) {
      if (names.has(norm(b.category))) { skipped++; continue }
      const row: Omit<Budget, 'id'> = { category: b.category, monthlyLimit: b.monthlyLimit }
      track('budgets', (await db.budgets.add(row)) as number, row)
    }

    if (added > 0) {
      await logEvent({ area: pack.id.startsWith('career') ? 'career' : 'personal', kind: 'pack.installed', title: `Added starter pack: ${pack.name}`, refKey: packKey(pack.id) })
      await db.settings.put({ key: packKey(pack.id), value: rec })
    }
    return { added, skipped }
  })
}

/** Removes only rows the pack created that are still exactly as installed. Returns how many were removed and kept. */
export async function removePack(id: string): Promise<RemoveResult> {
  return db.transaction('rw', [db.goals, db.learning, db.habits, db.habitLogs, db.tasks, db.budgets, db.events, db.settings], async () => {
    const rec = await getPackRecord(id)
    if (!rec) return { removed: 0, kept: 0 }
    let removed = 0
    let kept = 0
    const drop: Record<PackTable, number[]> = { goals: [], learning: [], habits: [], tasks: [], budgets: [] }
    for (const table of TABLES) {
      for (const it of rec.items[table] ?? []) {
        const row = await db.table(table).get(it.id)
        if (!row) continue // already deleted by the user
        let untouched = sigOf(row) === it.sig
        if (untouched && table === 'habits' && (await db.habitLogs.where('habitId').equals(it.id).count()) > 0) untouched = false
        if (untouched) drop[table].push(it.id)
        else kept++
      }
    }
    // A goal stays if anything that remains still points at it.
    const goalDrop = new Set(drop.goals)
    let changed = true
    while (changed) {
      changed = false
      const refs = new Set<number>()
      for (const t of await db.tasks.toArray()) if (t.goalId != null && !drop.tasks.includes(t.id!)) refs.add(t.goalId)
      for (const l of await db.learning.toArray()) if (l.goalId != null && !drop.learning.includes(l.id!)) refs.add(l.goalId)
      for (const h of await db.habits.toArray()) if (h.goalId != null && !drop.habits.includes(h.id!)) refs.add(h.goalId)
      for (const g of await db.goals.toArray()) if (g.parentId != null && !goalDrop.has(g.id!)) refs.add(g.parentId)
      for (const gid of [...goalDrop]) {
        if (refs.has(gid)) { goalDrop.delete(gid); kept++; changed = true }
      }
    }
    drop.goals = [...goalDrop]
    for (const table of TABLES) {
      if (drop[table].length) await db.table(table).bulkDelete(drop[table])
      removed += drop[table].length
    }
    await db.events.filter((e) => e.kind === 'pack.installed' && e.refKey === packKey(id)).delete()
    await db.settings.delete(packKey(id))
    return { removed, kept }
  })
}

export const findPack = (id: string) => PACKS.find((p) => p.id === id)
