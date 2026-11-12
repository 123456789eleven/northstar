// Reads the live data a building's stage needs and hands it to the pure buildingStage(). One query set per building.
import { useLiveQuery } from 'dexie-react-hooks'
import type { DistrictId } from '../../components/districts'
import { db, type Habit, type HabitLog, type ISODate, type Meal, type WeightEntry } from '../../db'
import { addDays, startOfWeek, today } from '../../lib/dates'
import { BODY_DEFAULTS, findLiftHabit, readBodySettings } from '../body/bodyData'
import { averageAt, movingAverage } from '../body/model'
import { checkpointFlags } from '../body/pathModel'
import { buildingStage, type BuildingStage, type GymSnapshot, type HomeBaseSnapshot } from './stage'
import { BACKUP_LAST_ENCRYPTED_KEY, BACKUP_LAST_KEY } from '../../lib/backup'
import { loadBadges } from '../badges/useBadges'
import { loadScoreSnapshot } from '../score/useScore'
import { computeStanding } from '../score/model'
import { PROFILE_KEY, progress, type Answers } from '../interview/questions'

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

export interface HomeRaw {
  backupAt: string | null
  backupEncrypted: boolean | null
  syncOn: boolean
  answers: Answers
  badgesEarned: number
  standingReady: boolean
}

/** Pure: the Home base snapshot from raw values, counted for the month containing `t`. */
export function homeSnapshotFrom(raw: HomeRaw, t: ISODate): HomeBaseSnapshot {
  return {
    backupThisMonth: !!raw.backupAt && raw.backupAt.slice(0, 7) === t.slice(0, 7),
    safeCopy: raw.syncOn || raw.backupEncrypted === true,
    interviewAnswers: progress(raw.answers).done,
    badgesEarned: raw.badgesEarned,
    standingReady: raw.standingReady,
  }
}

/** Live stage for a building, undefined while loading, null when the building has no stage yet. */
export function useBuildingStage(id: DistrictId): BuildingStage | null | undefined {
  return useLiveQuery(async () => {
    const t = today()
    if (id === 'you') {
      const get = async <T,>(k: string, d: T) => ((await db.settings.get(k))?.value as T | undefined) ?? d
      const [backupAt, backupEncrypted, syncOn, answers, badges, snap] = await Promise.all([
        get<string | null>(BACKUP_LAST_KEY, null), get<boolean | null>(BACKUP_LAST_ENCRYPTED_KEY, null),
        get<boolean>('sync.enabled', false), get<Answers>(PROFILE_KEY, {}), loadBadges(), loadScoreSnapshot().catch(() => null),
      ])
      const standingReady = !!snap && computeStanding(snap).status === 'ready'
      return buildingStage('you', { you: homeSnapshotFrom({ backupAt, backupEncrypted, syncOn, answers, badgesEarned: badges.filter((b) => b.earned).length, standingReady }, t) })
    }
    if (id !== 'body') return null
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
