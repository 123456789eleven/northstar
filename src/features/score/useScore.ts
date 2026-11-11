// Reads the tables the scoreboard derives from into a ScoreSnapshot. Undefined while loading. Read-only.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { today } from '../../lib/dates'
import type { ScoreSnapshot } from './model'

export async function loadScoreSnapshot(): Promise<ScoreSnapshot> {
  const [events, balances, transactions, budgets, tasks, habitLogs, weights, goals, interactions, people, journal, study] = await Promise.all([
    db.events.toArray(), db.balances.toArray(), db.transactions.toArray(), db.budgets.toArray(),
    db.tasks.where('status').equals('done').toArray(), db.habitLogs.toArray(), db.weights.toArray(), db.goals.toArray(),
    db.interactions.toArray(), db.people.toArray(), db.journal.toArray(), db.studySessions.toArray(),
  ])
  const goal = goals.find((g) => g.status === 'active' && g.metric?.source === 'weight')
  return {
    today: today(),
    events: events.map((e) => ({ kind: e.kind, at: e.at, title: e.title, milestone: e.milestone })),
    balances: balances.map((b) => ({ date: b.date, kind: b.kind, balance: b.balance })),
    transactions: transactions.map((t) => ({ date: t.date, amount: t.amount, category: t.category })),
    budgets: budgets.map((b) => ({ category: b.category, monthlyLimit: b.monthlyLimit })),
    tasksDone: tasks.map((t) => (t.doneAt ?? t.createdAt).slice(0, 10)),
    habitLogs: habitLogs.map((h) => h.date),
    weights: weights.filter((w) => Number.isFinite(w.weight)).map((w) => ({ date: w.date, weight: w.weight })),
    weightTarget: goal?.metric?.target,
    interactions: interactions.map((i) => ({ personId: i.personId, date: i.date })),
    people: people.flatMap((p) => (p.id === undefined ? [] : [{ id: p.id, name: p.name }])),
    journalDates: journal.map((j) => j.date),
    study: study.map((x) => ({ date: x.date, minutes: x.minutes })),
  }
}

export function useScoreSnapshot(): ScoreSnapshot | undefined {
  return useLiveQuery(loadScoreSnapshot, [])
}
