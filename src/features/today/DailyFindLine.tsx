import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { addDays, today } from '../../lib/dates'
import { dailyFind, type FindInput } from './dailyFind'

/** One factual sentence from existing data; renders nothing when there is nothing honest to say. */
export function DailyFind() {
  const d = today()
  const data = useLiveQuery(async (): Promise<FindInput> => {
    const [events, meals, txs, budgets] = await Promise.all([
      db.events.filter((e) => e.kind === 'workout.logged').toArray(),
      db.meals.where('date').aboveOrEqual(addDays(d, -13)).toArray(),
      db.transactions.where('date').aboveOrEqual(`${d.slice(0, 7)}-01`).toArray(),
      db.budgets.toArray(),
    ])
    return { workouts: events.map((e) => e.at), meals, transactions: txs, budgets }
  }, [d])
  const line = data ? dailyFind(data, d) : null
  if (!line) return null
  return <p className="daily-find" data-testid="daily-find"><span className="daily-find-k">Daily find</span>{line}</p>
}
