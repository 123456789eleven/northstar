// Live inputs for nextTrophies(): event counts by kind plus the active weight goal and weigh-ins. Read-only.
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import { nextTrophies, type NextTrophy, type TrophyState } from './trophies'

async function loadState(): Promise<TrophyState> {
  const c = { workouts: 0, wins: 0, tasksDone: 0, reviews: 0 }
  await db.events.each((e) => {
    if (e.kind === 'workout.logged') c.workouts++
    else if (e.kind === 'career.win' || e.kind === 'win') c.wins++
    else if (e.kind === 'task.done') c.tasksDone++
    else if (e.kind === 'review.done') c.reviews++
  })
  const goal = (await db.goals.toArray()).find((g) => g.status === 'active' && g.metric?.source === 'weight')
  const weights = (await db.weights.orderBy('date').toArray()).filter((w) => Number.isFinite(w.weight))
  let weight: TrophyState['weight']
  if (goal?.metric && weights.length) weight = { start: weights[0].weight, target: goal.metric.target, current: weights[weights.length - 1].weight }
  return { ...c, weight }
}

/** Undefined while loading. */
export function useNextTrophies(max = 5): NextTrophy[] | undefined {
  return useLiveQuery(async () => nextTrophies(await loadState(), max), [max])
}
