// Reads the live data a building's stage needs and hands it to the pure buildingStage(). One query set per building.
import { useLiveQuery } from 'dexie-react-hooks'
import type { DistrictId } from '../../components/districts'
import { db, type Habit, type HabitLog, type ISODate, type Meal, type WeightEntry } from '../../db'
import { addDays, startOfWeek, today } from '../../lib/dates'
import { BODY_DEFAULTS, findLiftHabit, readBodySettings } from '../body/bodyData'
import { averageAt, movingAverage } from '../body/model'
import { checkpointFlags } from '../body/pathModel'
import { librarySnapshot, officeSnapshot } from './stageMindCareer'
import { buildingStage, type BuildingStage, type GymSnapshot } from './stage'

export interface GymRaw {
  settings: { key: string; value: unknown }[]
  weights: Pick<WeightEntry, 'date' | 'weight'>[]
  meals: Pick<Meal, 'date'>[]
  habits: Habit[]
  logs: Pick<HabitLog, 'habitId' | 'date'>[]
}

/** Pure: the Gym snapshot from raw rows, counted for the month and the Monday-to-Sunday week containing `t`. */
export function gymSnapshotFrom(raw: GymRaw, t: ISODate): GymSnapshot {
  const s = readBodySettings(raw.settings)
  const month = t.slice(0, 7)
  const wk = startOfWeek(t)
  const wkEnd = addDays(wk, 6)
  const inWeek = (d: string) => d >= wk && d <= wkEnd
  const lift = findLiftHabit(raw.habits)
  const w = [...raw.weights].sort((a, b) => a.date.localeCompare(b.date))
  let flagsCrossed = 0
  if (w.length) {
    const current = averageAt(w, t) ?? movingAverage(w).at(-1)!.avg
    const start = s.startWeight ?? w[0].weight
    flagsCrossed = checkpointFlags(w, start, s.goal, current).filter((f) => f.reached && f.crossedOn).length
  }
  return {
    goalSet: raw.settings.some((r) => r.key === 'body.goal' && typeof r.value === 'number'),
    weighInsThisMonth: w.filter((x) => x.date.startsWith(month) && x.date <= t).length,
    mealDaysThisWeek: new Set(raw.meals.filter((m) => inWeek(m.date)).map((m) => m.date)).size,
    trainingThisWeek: lift?.id == null ? 0 : new Set(raw.logs.filter((l) => l.habitId === lift.id && inWeek(l.date)).map((l) => l.date)).size,
    trainingTarget: lift?.perWeek ?? s.trainDays ?? BODY_DEFAULTS.trainDays,
    flagsCrossed,
  }
}

/** Live stage for a building, undefined while loading, null when the building has no stage yet. */
export function useBuildingStage(id: DistrictId): BuildingStage | null | undefined {
  return useLiveQuery(async () => {
    if (id === 'mind') return buildingStage('mind', { mind: await librarySnapshot() })
    if (id === 'career') return buildingStage('career', { career: await officeSnapshot() })
    if (id !== 'body') return null
    const t = today()
    const wk = startOfWeek(t)
    const [settings, weights, meals, habits, logs] = await Promise.all([
      db.settings.where('key').startsWith('body.').toArray(),
      db.weights.toArray(),
      db.meals.where('date').between(wk, addDays(wk, 6), true, true).toArray(),
      db.habits.toArray(),
      db.habitLogs.where('date').between(wk, addDays(wk, 6), true, true).toArray(),
    ])
    return buildingStage('body', { body: gymSnapshotFrom({ settings, weights, meals, habits, logs }, t) })
  }, [id])
}
