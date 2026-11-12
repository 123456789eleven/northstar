// Building stage (BUILDINGS_PLAN.md): five windows per building, each lit by one concrete thing you did, never by points.
// Pure: the hook in useBuildingStage.ts reads the data; this file only decides. A building without a stage returns null.
import type { DistrictId } from '../../components/districts'

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

/** Home base (You) inputs. */
export interface HomeBaseSnapshot {
  /** A backup file was made in the current calendar month. */
  backupThisMonth: boolean
  /** Encrypted sync is on, or the last backup was encrypted. */
  safeCopy: boolean
  /** Interview questions answered. */
  interviewAnswers: number
  badgesEarned: number
  /** The scoreboard has enough weeks to show a standing. */
  standingReady: boolean
}

export interface BuildingSnapshot { body?: GymSnapshot; you?: HomeBaseSnapshot }

export const HOME_INTERVIEW_ANSWERS = 10

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

function homeSteps(s: HomeBaseSnapshot): StageStep[] {
  return [
    { id: 'backup', label: 'Backup this month', done: s.backupThisMonth, todo: 'make a backup this month' },
    { id: 'safe', label: 'Sync or encrypted', done: s.safeCopy, todo: 'turn on sync or encrypt a backup' },
    { id: 'interview', label: `${HOME_INTERVIEW_ANSWERS} interview answers`, done: s.interviewAnswers >= HOME_INTERVIEW_ANSWERS, todo: more(HOME_INTERVIEW_ANSWERS - s.interviewAnswers, 'interview answer') },
    { id: 'badge', label: 'First badge', done: s.badgesEarned > 0, todo: 'earn a badge' },
    { id: 'standing', label: 'Standing unlocked', done: s.standingReady, todo: 'finish a week to unlock your standing' },
  ]
}

const FULL: Partial<Record<DistrictId, string>> = { body: 'Every window lit', you: 'Home base fully lit' }

/** The building's stage from its snapshot, or null for a building that has no stage yet. */
export function buildingStage(district: DistrictId, snap: BuildingSnapshot): BuildingStage | null {
  let steps: StageStep[] | null = null
  if (district === 'body' && snap.body) steps = gymSteps(snap.body)
  if (district === 'you' && snap.you) steps = homeSteps(snap.you)
  if (!steps) return null
  const stage = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done) ?? null
  return { stage, steps, next, line: next ? `Next: ${next.todo}` : (FULL[district] ?? 'Every window lit') }
}
