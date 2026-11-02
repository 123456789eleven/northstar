// DB loader for metrics.ts: one read of the tables the metrics need.
import { db, getSetting } from '../../db'
import { today as todayISO } from '../../lib/dates'
import { BILLS_KEY, parseBills } from '../finance/bills'
import { TARGETS_KEY, type FoodTargets } from '../food/foodData'
import type { MetricData } from './metrics'

export async function loadMetricData(today = todayISO()): Promise<MetricData> {
  const [weights, meals, targets, startWeight, habits, habitLogs, events, studySessions, transactions, budgets, billsRaw, balances] = await Promise.all([
    db.weights.toArray(),
    db.meals.toArray(),
    getSetting<FoodTargets>(TARGETS_KEY, {}),
    getSetting<number | undefined>('body.startWeight', undefined),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.events.toArray(),
    db.studySessions.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    getSetting<unknown>(BILLS_KEY, null),
    db.balances.toArray(),
  ])
  return {
    today, weights, meals, targets: targets ?? {}, startWeight: typeof startWeight === 'number' ? startWeight : undefined,
    habits, habitLogs, events, studySessions, transactions, budgets, bills: parseBills(billsRaw), balances,
  }
}
