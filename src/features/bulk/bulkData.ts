// "Add many": load what already exists (for duplicate detection), insert parsed rows in ONE transaction, and undo exactly that.
// Inserts mirror the real pages: tasks/people/habits/meals add rows directly, goals go through createGoal, and transactions go
// through commitImport (batch id + History event), so Finance's import history and undoImport keep working.
import { db, getSetting } from '../../db'
import type { CaptureGoal } from '../../lib/capture'
import { createGoal } from '../goals/goalActions'
import { RULES_KEY, allRules, type Rule } from '../finance/categories'
import { commitImport, undoImport } from '../finance/importActions'
import { emptyExisting, itemKey, type BulkContext, type BulkItem, type BulkKind } from './parse'

export const BULK_IMPORT_LABEL = 'Add many'

export async function loadBulkContext(kind: BulkKind): Promise<Pick<BulkContext, 'goals' | 'rules' | 'existing'>> {
  const existing = emptyExisting()
  let goals: CaptureGoal[] | undefined
  let rules: Rule[] | undefined
  if (kind === 'tasks') {
    goals = (await db.goals.where('status').equals('active').toArray()).map((g) => ({ id: g.id!, title: g.title, area: g.area, horizon: g.horizon }))
    for (const t of await db.tasks.where('status').equals('open').toArray()) existing.tasks.add(itemKey({ kind: 'tasks', title: t.title, due: t.due, priority: t.priority, recurrence: t.recurrence }))
  } else if (kind === 'people') {
    for (const p of await db.people.toArray()) existing.people.add(p.name.trim().toLowerCase())
  } else if (kind === 'goals') {
    for (const g of await db.goals.toArray()) existing.goals.add(g.title.trim().toLowerCase())
  } else if (kind === 'habits') {
    for (const h of await db.habits.toArray()) if (!h.archived) existing.habits.add(h.name.trim().toLowerCase())
  } else if (kind === 'meals') {
    for (const m of await db.meals.toArray()) existing.meals.add(`${m.date}|${m.slot}|${m.name.trim().toLowerCase()}`)
  } else {
    rules = allRules(await getSetting<Rule[]>(RULES_KEY, []))
    for (const t of await db.transactions.toArray()) existing.transactions.add(`${t.date}|${t.amount.toFixed(2)}|${t.description.trim().toLowerCase()}`)
  }
  return { goals, rules, existing }
}

export interface BulkAdded {
  kind: BulkKind
  count: number
  undo: () => Promise<void>
}

/** Insert every item (all one kind) atomically. Returns an undo that removes exactly those rows (and the import event for transactions). */
export async function addBulk(kind: BulkKind, items: BulkItem[]): Promise<BulkAdded> {
  const createdAt = new Date().toISOString()
  const done = (undo: () => Promise<void>): BulkAdded => ({ kind, count: items.length, undo })
  if (!items.length) return done(async () => {})

  switch (kind) {
    case 'tasks': {
      const rows = items.flatMap((i) => (i.kind === 'tasks' ? [i] : []))
      const ids = await db.transaction('rw', db.tasks, () =>
        db.tasks.bulkAdd(
          rows.map((t) => ({
            title: t.title,
            notes: t.notes,
            due: t.due,
            priority: t.priority,
            status: 'open' as const,
            recurrence: t.recurrence,
            recurDay: t.recurrence === 'monthly' && t.due ? Number(t.due.slice(8, 10)) : undefined,
            goalId: t.goalId,
            createdAt,
          })),
          { allKeys: true },
        ),
      )
      return done(() => db.transaction('rw', db.tasks, () => db.tasks.bulkDelete(ids)))
    }
    case 'people': {
      const rows = items.flatMap((i) => (i.kind === 'people' ? [i] : []))
      const ids = await db.transaction('rw', db.people, () =>
        db.people.bulkAdd(rows.map((p) => ({ name: p.name, relation: p.relation, cadenceDays: p.cadenceDays, birthday: p.birthday, notes: p.notes })), { allKeys: true }),
      )
      return done(() => db.transaction('rw', db.people, () => db.people.bulkDelete(ids)))
    }
    case 'goals': {
      const rows = items.flatMap((i) => (i.kind === 'goals' ? [i] : []))
      const ids = await db.transaction('rw', db.goals, async () => {
        const out: number[] = []
        for (const g of rows) out.push((await createGoal({ title: g.title, area: g.area, horizon: g.horizon, targetDate: g.targetDate, why: g.why, status: 'active' }))!)
        return out
      })
      return done(() => db.transaction('rw', db.goals, () => db.goals.bulkDelete(ids)))
    }
    case 'habits': {
      const rows = items.flatMap((i) => (i.kind === 'habits' ? [i] : []))
      const ids = await db.transaction('rw', db.habits, () =>
        db.habits.bulkAdd(rows.map((h) => ({ name: h.name, area: h.area, perWeek: h.perWeek, createdAt })), { allKeys: true }),
      )
      return done(() => db.transaction('rw', db.habits, () => db.habits.bulkDelete(ids)))
    }
    case 'meals': {
      const rows = items.flatMap((i) => (i.kind === 'meals' ? [i] : []))
      const ids = await db.transaction('rw', db.meals, () =>
        db.meals.bulkAdd(rows.map((m) => ({ date: m.date, slot: m.slot, name: m.name, calories: m.calories })), { allKeys: true }),
      )
      return done(() => db.transaction('rw', db.meals, () => db.meals.bulkDelete(ids)))
    }
    case 'transactions': {
      const rows = items.flatMap((i) => (i.kind === 'transactions' ? [i] : []))
      const { batch } = await commitImport(BULK_IMPORT_LABEL, rows.map((t) => ({ date: t.date, amount: t.amount, description: t.description, category: t.category, account: t.account })), 0, 0)
      return done(async () => { await undoImport(batch) })
    }
  }
}
