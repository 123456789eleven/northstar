// Building stage (BUILDINGS_PLAN.md): five windows per building, each lit by one concrete thing you did, never by points.
// Pure: the hook in useBuildingStage.ts reads the data; this file only decides. A building without a stage returns null.
import type { DistrictId } from '../../components/districts'
import { bankSteps, type BankSnapshot } from './bankStage'

export const STAGES = 5

export interface StageStep {
  id: string
  /** Under 4 words: what lights this window. */
  label: string
  done: boolean
  /** Short "what is left" for the next line, e.g. "2 more weigh-ins". */
  todo: string
}

export interface BuildingStage {
  /** Windows lit, 0..5 (order-free: each step counts once it is true). */
  stage: number
  steps: StageStep[]
  /** The first unlit step, or null when all five are lit. */
  next: StageStep | null
  /** One short status line: "Next: 2 more weigh-ins" or the full-building line. */
  line: string
}

/** Gym (Body) inputs, all counted from real logs. */
export interface GymSnapshot {
  /** A goal weight saved in settings (not the default). */
  goalSet: boolean
  weighInsThisMonth: number
  /** Distinct days with a meal logged, Monday to Sunday. */
  mealDaysThisWeek: number
  trainingThisWeek: number
  trainingTarget: number
  /** 5 lb checkpoint flags the 7-day average has crossed. */
  flagsCrossed: number
}

export interface BuildingSnapshot { body?: GymSnapshot; money?: BankSnapshot }

export const GYM_WEIGH_INS = 4
export const GYM_MEAL_DAYS = 5

const more = (n: number, one: string, many = `${one}s`) => `${n} more ${n === 1 ? one : many}`

function gymSteps(s: GymSnapshot): StageStep[] {
  const target = Math.max(1, s.trainingTarget)
  return [
    { id: 'goal', label: 'Goal weight set', done: s.goalSet, todo: 'set a goal weight' },
    { id: 'weigh', label: `${GYM_WEIGH_INS} weigh-ins`, done: s.weighInsThisMonth >= GYM_WEIGH_INS, todo: more(GYM_WEIGH_INS - s.weighInsThisMonth, 'weigh-in') },
    { id: 'meals', label: `Meals ${GYM_MEAL_DAYS} days`, done: s.mealDaysThisWeek >= GYM_MEAL_DAYS, todo: `meals ${more(GYM_MEAL_DAYS - s.mealDaysThisWeek, 'day')}` },
    { id: 'train', label: 'Training target hit', done: s.trainingThisWeek >= target, todo: more(target - s.trainingThisWeek, 'session') },
    { id: 'flag', label: '5 lb flag', done: s.flagsCrossed > 0, todo: 'cross a 5 lb flag' },
  ]
}

const FULL: Partial<Record<DistrictId, string>> = { body: 'Every window lit', money: 'Every window lit. The Bank is open late' }

/** The building's stage from its snapshot, or null for a building that has no stage yet. */
export function buildingStage(district: DistrictId, snap: BuildingSnapshot): BuildingStage | null {
  let steps: StageStep[] | null = null
  if (district === 'body' && snap.body) steps = gymSteps(snap.body)
  if (district === 'money' && snap.money) steps = bankSteps(snap.money)
  if (!steps) return null
  const stage = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done) ?? null
  return { stage, steps, next, line: next ? `Next: ${next.todo}` : (FULL[district] ?? 'Every window lit') }
}
