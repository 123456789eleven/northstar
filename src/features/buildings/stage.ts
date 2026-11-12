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

/** Town hall (Plan) inputs. */
export interface TownSnapshot {
  /** Tasks pinned to today's focus (open or done today). */
  focusPinned: number
  doneToday: number
  /** Time blocks on this Monday-to-Sunday week. */
  blocksThisWeek: number
  /** Active quarter (season) goals. */
  seasonGoals: number
  /** Distinct days this week with at least one habit check-in. */
  habitDaysThisWeek: number
}

/** Park (People) inputs. */
export interface ParkSnapshot {
  people: number
  /** People with a check-in rhythm. */
  withRhythm: number
  /** Distinct people reached this Monday-to-Sunday week. */
  reachedThisWeek: number
  /** Circle warmth 0..100, null with nobody on a rhythm. */
  warmthPct: number | null
  /** People whose check-in is overdue. */
  overdue: number
}

export interface BuildingSnapshot { body?: GymSnapshot; plan?: TownSnapshot; people?: ParkSnapshot }

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

export const PARK_PEOPLE = 5
export const PARK_RHYTHMS = 3
export const PARK_REACHED = 2
export const PARK_WARM = 70
export const TOWN_HABIT_DAYS = 3

function townSteps(s: TownSnapshot): StageStep[] {
  return [
    { id: 'focus', label: 'Focus pinned', done: s.focusPinned > 0, todo: 'pin a task to today' },
    { id: 'done', label: 'Task done today', done: s.doneToday > 0, todo: 'finish one task' },
    { id: 'block', label: 'Time blocked', done: s.blocksThisWeek > 0, todo: 'block time for a task' },
    { id: 'season', label: 'Season goal set', done: s.seasonGoals > 0, todo: 'set a season goal' },
    { id: 'habits', label: `Habits ${TOWN_HABIT_DAYS} days`, done: s.habitDaysThisWeek >= TOWN_HABIT_DAYS, todo: `habits ${more(TOWN_HABIT_DAYS - s.habitDaysThisWeek, 'day')}` },
  ]
}

function parkSteps(s: ParkSnapshot): StageStep[] {
  return [
    { id: 'people', label: `${PARK_PEOPLE} people`, done: s.people >= PARK_PEOPLE, todo: more(PARK_PEOPLE - s.people, 'person', 'people') },
    { id: 'rhythm', label: `${PARK_RHYTHMS} rhythms set`, done: s.withRhythm >= PARK_RHYTHMS, todo: `${more(PARK_RHYTHMS - s.withRhythm, 'rhythm')} to set` },
    { id: 'reach', label: 'Reached out', done: s.reachedThisWeek >= PARK_REACHED, todo: `reach ${PARK_REACHED - s.reachedThisWeek} more ${PARK_REACHED - s.reachedThisWeek === 1 ? 'person' : 'people'}` },
    { id: 'warm', label: `Circle ${PARK_WARM}% warm`, done: (s.warmthPct ?? 0) >= PARK_WARM, todo: `warm the circle to ${PARK_WARM}%` },
    { id: 'clear', label: 'Nobody waiting', done: s.withRhythm > 0 && s.overdue === 0, todo: s.overdue ? `${s.overdue} waiting to hear from you` : 'set a rhythm' },
  ]
}

const FULL: Partial<Record<DistrictId, string>> = { body: 'Every window lit', plan: 'Every window lit', people: 'Every window lit' }

/** The building's stage from its snapshot, or null for a building that has no stage yet. */
export function buildingStage(district: DistrictId, snap: BuildingSnapshot): BuildingStage | null {
  let steps: StageStep[] | null = null
  if (district === 'body' && snap.body) steps = gymSteps(snap.body)
  if (district === 'plan' && snap.plan) steps = townSteps(snap.plan)
  if (district === 'people' && snap.people) steps = parkSteps(snap.people)
  if (!steps) return null
  const stage = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done) ?? null
  return { stage, steps, next, line: next ? `Next: ${next.todo}` : (FULL[district] ?? 'Every window lit') }
}
