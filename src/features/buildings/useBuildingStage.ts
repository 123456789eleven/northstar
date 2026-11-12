// Reads the live data a building's stage needs and hands it to the pure buildingStage(). One query set per building.
import { useLiveQuery } from 'dexie-react-hooks'
import type { DistrictId } from '../../components/districts'
import { db, type CalendarEvent, type Habit, type HabitLog, type ISODate, type Interaction, type Meal, type Person, type Task, type Goal, type WeightEntry } from '../../db'
import { addDays, startOfWeek, today } from '../../lib/dates'
import { BODY_DEFAULTS, findLiftHabit, readBodySettings } from '../body/bodyData'
import { averageAt, movingAverage } from '../body/model'
import { checkpointFlags } from '../body/pathModel'
import { blockMeta } from '../planner/timeBlock'
import { circleWarmth } from '../people/warmth'
import { personStatus } from '../people/people'
import { buildingStage, type BuildingStage, type GymSnapshot, type ParkSnapshot, type TownSnapshot } from './stage'

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

export interface TownRaw {
  tasks: Pick<Task, 'focusDate' | 'status' | 'doneAt'>[]
  goals: Pick<Goal, 'status' | 'horizon'>[]
  events: CalendarEvent[]
  logs: Pick<HabitLog, 'date'>[]
}

/** Pure: the Town hall snapshot for the day `t` and its Monday-to-Sunday week. */
export function townSnapshotFrom(raw: TownRaw, t: ISODate): TownSnapshot {
  const wk = startOfWeek(t)
  const wkEnd = addDays(wk, 6)
  const inWeek = (d: string) => d >= wk && d <= wkEnd
  return {
    focusPinned: raw.tasks.filter((x) => x.focusDate === t && (x.status === 'open' || x.doneAt?.slice(0, 10) === t)).length,
    doneToday: raw.tasks.filter((x) => x.status === 'done' && x.doneAt?.slice(0, 10) === t).length,
    blocksThisWeek: raw.events.filter((e) => inWeek(e.date) && blockMeta(e)).length,
    seasonGoals: raw.goals.filter((g) => g.status === 'active' && g.horizon === 'quarter').length,
    habitDaysThisWeek: new Set(raw.logs.filter((l) => inWeek(l.date)).map((l) => l.date)).size,
  }
}

export interface ParkRaw {
  people: Person[]
  interactions: Pick<Interaction, 'personId' | 'date'>[]
}

/** Pure: the Park snapshot as of `t`. */
export function parkSnapshotFrom(raw: ParkRaw, t: ISODate): ParkSnapshot {
  const wk = startOfWeek(t)
  const wkEnd = addDays(wk, 6)
  const tracked = raw.people.filter((p) => p.cadenceDays > 0)
  return {
    people: raw.people.length,
    withRhythm: tracked.length,
    reachedThisWeek: new Set(raw.interactions.filter((i) => i.date >= wk && i.date <= wkEnd).map((i) => i.personId)).size,
    warmthPct: circleWarmth(raw.people, t).pct,
    overdue: tracked.filter((p) => personStatus(p, t).overdue).length,
  }
}

/** Live stage for a building, undefined while loading, null when the building has no stage yet. */
export function useBuildingStage(id: DistrictId): BuildingStage | null | undefined {
  return useLiveQuery(async () => {
    const t = today()
    const wk = startOfWeek(t)
    if (id === 'plan') {
      const [tasks, goals, events, logs] = await Promise.all([
        db.tasks.toArray(),
        db.goals.toArray(),
        db.calendar.where('date').between(wk, addDays(wk, 6), true, true).toArray(),
        db.habitLogs.where('date').between(wk, addDays(wk, 6), true, true).toArray(),
      ])
      return buildingStage('plan', { plan: townSnapshotFrom({ tasks, goals, events, logs }, t) })
    }
    if (id === 'people') {
      const [people, interactions] = await Promise.all([db.people.toArray(), db.interactions.where('date').between(wk, addDays(wk, 6), true, true).toArray()])
      return buildingStage('people', { people: parkSnapshotFrom({ people, interactions }, t) })
    }
    if (id !== 'body') return null
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
