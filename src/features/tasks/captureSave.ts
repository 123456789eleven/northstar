// Persists a parsed Capture. Returns a label for the confirmation and an undo function.
import { db, logEvent } from '../../db'
import type { Capture } from '../../lib/capture'
import { logWeight } from '../body/bodyData'
import { appendToToday } from '../journal/journalData'

export interface Saved {
  label: string
  undo: () => Promise<void>
}

export async function saveCapture(c: Capture): Promise<Saved | null> {
  const now = new Date().toISOString()
  switch (c.kind) {
    case 'empty':
      return null
    case 'task': {
      if (!c.title) return null
      const id = await db.tasks.add({
        title: c.title,
        due: c.due,
        priority: c.priority,
        status: 'open',
        recurrence: c.recurrence,
        goalId: c.goalId,
        createdAt: now,
      })
      return { label: 'Task added', undo: () => db.tasks.delete(id) }
    }
    case 'transaction': {
      const id = await db.transactions.add({ date: c.date, amount: c.amount, description: c.description, category: 'Uncategorized' })
      return { label: c.amount < 0 ? 'Expense logged' : 'Income logged', undo: () => db.transactions.delete(id) }
    }
    case 'meal': {
      const id = await db.meals.add({ date: c.date, slot: c.slot, name: c.name, calories: c.calories })
      return { label: 'Meal logged', undo: () => db.meals.delete(id) }
    }
    case 'journal': {
      const undo = await appendToToday(c.text)
      return { label: 'Added to journal', undo }
    }
    case 'weight': {
      const r = await logWeight(c.date, c.weight)
      if (!r) return null
      return { label: r.updated ? 'Weight updated' : 'Weight logged', undo: r.undo }
    }
    case 'win': {
      const id = await logEvent({ area: c.area, kind: 'win', title: c.title, milestone: true })
      return { label: 'Win recorded', undo: () => db.events.delete(id) }
    }
  }
}
