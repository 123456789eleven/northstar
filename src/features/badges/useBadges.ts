// Reads the tables badges derive from and returns deriveBadges(snapshot). Undefined while loading. Read-only.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { today } from '../../lib/dates'
import { DEFAULT_IRA_LIMIT } from '../investments/model'
import { deriveBadges, type Badge } from './badges'

export async function loadBadges(): Promise<Badge[]> {
  const [weights, meals, journal, habitLogs, events, tasksDone, budgetCount, holdingCount, contributions, balances, learning, goals, reviews] =
    await Promise.all([
      db.weights.toArray(), db.meals.toArray(), db.journal.toArray(), db.habitLogs.toArray(), db.events.toArray(),
      db.tasks.where('status').equals('done').count(), db.budgets.count(), db.holdings.count(), db.contributions.toArray(),
      db.balances.toArray(), db.learning.where('status').equals('done').toArray(), db.goals.where('status').equals('done').count(),
      db.reviews.count(),
    ])
  return deriveBadges({
    today: today(),
    weightDates: weights.map((w) => w.date),
    mealDates: meals.map((m) => m.date),
    journalDates: journal.map((j) => j.date),
    habitLogDates: habitLogs.map((h) => h.date),
    events: events.map((e) => ({ kind: e.kind, at: e.at })),
    tasksDone, budgetCount, holdingCount,
    contributions: contributions.map((c) => ({ date: c.date, amount: c.amount, kind: c.kind })),
    retirementLimit: DEFAULT_IRA_LIMIT,
    balances: balances.map((b) => ({ date: b.date, kind: b.kind, balance: b.balance })),
    learningDone: learning.map((l) => ({ completedAt: l.completedAt })),
    goalsDone: goals,
    reviews,
  })
}

export function useBadges(): Badge[] | undefined {
  return useLiveQuery(loadBadges, [])
}
