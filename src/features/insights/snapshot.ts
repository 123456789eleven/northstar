// Reads the local database into a Snapshot for the (pure) insights engine. Nothing leaves the device.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting } from '../../db'
import { BACKUP_LAST_KEY } from '../../lib/backup'
import { addDays, today } from '../../lib/dates'
import { TARGETS_KEY, type FoodTargets } from '../food/foodData'
import { generateInsights, nextBestAction, type Insight, type NextAction, type Snapshot } from './engine'

export async function loadSnapshot(): Promise<Snapshot> {
  const d = today()
  const since = addDays(d, -70) // enough history for month-over-month and streak checks
  const [tasks, goals, meals, transactions, budgets, studySessions, people, events, targets, lastBackupAt] = await Promise.all([
    db.tasks.toArray(),
    db.goals.toArray(),
    db.meals.where('date').aboveOrEqual(since).toArray(),
    db.transactions.where('date').aboveOrEqual(since).toArray(),
    db.budgets.toArray(),
    db.studySessions.where('date').aboveOrEqual(since).toArray(),
    db.people.toArray(),
    db.events.where('at').aboveOrEqual(new Date(addDays(d, -30)).toISOString()).toArray(),
    getSetting<FoodTargets>(TARGETS_KEY, {}),
    getSetting<string | null>(BACKUP_LAST_KEY, null),
  ])
  return { today: d, tasks, goals, meals, transactions, budgets, studySessions, people, events, proteinTarget: targets.protein, lastBackupAt }
}

export interface InsightsState {
  insights: Insight[]
  next: NextAction | null
}

/** Live: recomputes whenever any underlying table changes. undefined while loading. */
export function useInsights(): InsightsState | undefined {
  return useLiveQuery(async () => {
    const s = await loadSnapshot()
    return { insights: generateInsights(s), next: nextBestAction(s) }
  }, [])
}
