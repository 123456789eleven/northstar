import { AREAS, db, type ISODate, type LifeEvent, type Review, type Task } from '../../db'
import { isSpend } from '../finance/categories'
import { addDays, parseISODate, startOfWeek, today } from '../../lib/dates'

export interface WeekDigest {
  tasksDone: number
  goalsCompleted: number
  goalUpdates: number
  spent: number
  spentPrev: number
  hasMoney: boolean
  mealDays: number
  studyMinutes: number
  peopleContacted: number
  milestones: LifeEvent[]
  slipped: Task[]
  eventCount: number
}

const ts = (d: ISODate) => parseISODate(d).toISOString()

async function spentBetween(from: ISODate, to: ISODate) {
  const rows = await db.transactions.where('date').between(from, to, true, true).toArray()
  return {
    n: rows.length,
    spent: rows.reduce((s, t) => (isSpend(t) ? s - t.amount : s), 0),
  }
}

export async function weekDigest(weekOf: ISODate): Promise<WeekDigest> {
  const end = addDays(weekOf, 6)
  const [startTs, endTs] = [ts(weekOf), ts(addDays(weekOf, 7))]

  const [tasks, goals, events, meals, study, interactions, money, moneyPrev, dueTasks] = await Promise.all([
    db.tasks.where('doneAt').between(startTs, endTs, true, false).count(),
    db.goals.filter((g) => !!g.completedAt && g.completedAt >= startTs && g.completedAt < endTs).count(),
    db.events.where('at').between(startTs, endTs, true, false).toArray(),
    db.meals.where('date').between(weekOf, end, true, true).toArray(),
    db.studySessions.where('date').between(weekOf, end, true, true).toArray(),
    db.interactions.where('date').between(weekOf, end, true, true).toArray(),
    spentBetween(weekOf, end),
    spentBetween(addDays(weekOf, -7), addDays(weekOf, -1)),
    db.tasks.where('due').between(weekOf, end, true, true).toArray(),
  ])

  return {
    tasksDone: tasks,
    goalsCompleted: goals,
    goalUpdates: events.filter((e) => e.refTable === 'goals').length,
    spent: money.spent,
    spentPrev: moneyPrev.spent,
    hasMoney: money.n + moneyPrev.n > 0,
    mealDays: new Set(meals.map((m) => m.date)).size,
    studyMinutes: study.reduce((s, x) => s + (x.minutes || 0), 0),
    peopleContacted: new Set(interactions.map((i) => i.personId)).size,
    milestones: events.filter((e) => e.milestone && e.kind !== 'review.done'),
    eventCount: events.length,
    slipped: slippedTasks(dueTasks, weekOf),
  }
}

/** Consecutive reviewed weeks ending this week (or last week, if this week isn't reviewed yet). */
export function reviewStreak(reviews: Review[], now: ISODate = today()) {
  const have = new Set(reviews.map((r) => r.weekOf))
  let w = startOfWeek(now)
  if (!have.has(w)) w = addDays(w, -7)
  let n = 0
  while (have.has(w)) { n++; w = addDays(w, -7) }
  return n
}

export function avgRating(r: Review) {
  const vals = AREAS.map((a) => r.ratings[a]).filter((v): v is number => typeof v === 'number')
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null
}

/** Week-over-week spend change, or null unless both weeks have spend within 3x of each other (otherwise it is noise). */
export function spendChange(spent: number, prev: number): number | null {
  if (spent <= 0 || prev <= 0) return null
  const ratio = spent / prev
  if (ratio > 3 || ratio < 1 / 3) return null
  return Math.round((ratio - 1) * 100)
}

/** A review row may carry a lock timestamp (extra field on the row; no schema change, it is not indexed). */
export type LockableReview = Review & { lockedAt?: string }

/**
 * Tasks due inside the week that are still open. In the current week only days already past count, so
 * something due Friday is not "slipped" on Wednesday.
 */
export function slippedTasks(tasks: Task[], weekOf: ISODate, now: ISODate = today()): Task[] {
  const end = addDays(weekOf, 6)
  const last = now <= end ? addDays(now, -1) : end
  return tasks
    .filter((t) => t.status !== 'done' && !!t.due && t.due >= weekOf && t.due <= last)
    .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? '') || a.priority - b.priority)
}
