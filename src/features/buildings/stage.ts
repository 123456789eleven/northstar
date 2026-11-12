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

/** Library (Mind) inputs. */
export interface LibrarySnapshot {
  wroteToday: boolean
  /** Distinct days with writing, Monday to Sunday. */
  daysThisWeek: number
  /** Some entry this week reached the daily word goal. */
  goalHitThisWeek: boolean
  /** Learning items in progress. */
  activeItems: number
  studyMinutesThisWeek: number
  studyTarget: number
}

/** Office (Career) inputs. */
export interface OfficeSnapshot {
  winsThisWeek: number
  winsThisMonth: number
  /** The featured project has a baseline / a result. */
  projectBaseline: boolean
  projectResult: boolean
  /** Case strength, 0..100. */
  caseScore: number
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

export interface BuildingSnapshot { body?: GymSnapshot; mind?: LibrarySnapshot; career?: OfficeSnapshot; plan?: TownSnapshot; people?: ParkSnapshot; money?: BankSnapshot; you?: HomeBaseSnapshot }

export const LIBRARY_DAYS = 3
export const OFFICE_WINS = 3
export const OFFICE_CASE = 60
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

function librarySteps(s: LibrarySnapshot): StageStep[] {
  return [
    { id: 'today', label: 'Wrote today', done: s.wroteToday, todo: 'write a line today' },
    { id: 'days', label: `${LIBRARY_DAYS} writing days`, done: s.daysThisWeek >= LIBRARY_DAYS, todo: more(LIBRARY_DAYS - s.daysThisWeek, 'writing day') },
    { id: 'goal', label: 'Word goal hit', done: s.goalHitThisWeek, todo: 'hit your word goal' },
    { id: 'course', label: 'Course on the go', done: s.activeItems > 0, todo: 'start a course' },
    { id: 'study', label: 'Study target met', done: s.studyTarget > 0 && s.studyMinutesThisWeek >= s.studyTarget, todo: `${Math.max(0, s.studyTarget - s.studyMinutesThisWeek)} more study minutes` },
  ]
}

function officeSteps(s: OfficeSnapshot): StageStep[] {
  return [
    { id: 'win', label: 'Win this week', done: s.winsThisWeek > 0, todo: 'log a win' },
    { id: 'wins', label: `${OFFICE_WINS} wins this month`, done: s.winsThisMonth >= OFFICE_WINS, todo: more(OFFICE_WINS - s.winsThisMonth, 'win') },
    { id: 'baseline', label: 'Project baseline', done: s.projectBaseline, todo: 'measure a project baseline' },
    { id: 'result', label: 'Project result', done: s.projectResult, todo: 'record a project result' },
    { id: 'case', label: `Case ${OFFICE_CASE}+`, done: s.caseScore >= OFFICE_CASE, todo: `${OFFICE_CASE - s.caseScore} more case points` },
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

function homeSteps(s: HomeBaseSnapshot): StageStep[] {
  return [
    { id: 'backup', label: 'Backup this month', done: s.backupThisMonth, todo: 'make a backup this month' },
    { id: 'safe', label: 'Sync or encrypted', done: s.safeCopy, todo: 'turn on sync or encrypt a backup' },
    { id: 'interview', label: `${HOME_INTERVIEW_ANSWERS} interview answers`, done: s.interviewAnswers >= HOME_INTERVIEW_ANSWERS, todo: more(HOME_INTERVIEW_ANSWERS - s.interviewAnswers, 'interview answer') },
    { id: 'badge', label: 'First badge', done: s.badgesEarned > 0, todo: 'earn a badge' },
    { id: 'standing', label: 'Standing unlocked', done: s.standingReady, todo: 'finish a week to unlock your standing' },
  ]
}

const FULL: Partial<Record<DistrictId, string>> = { body: 'Every window lit', money: 'Every window lit. The Bank is open late', mind: 'Every window lit', career: 'Every window lit', plan: 'Every window lit', people: 'Every window lit', you: 'Home base fully lit' }

/** The building's stage from its snapshot, or null for a building that has no stage yet. */
export function buildingStage(district: DistrictId, snap: BuildingSnapshot): BuildingStage | null {
  let steps: StageStep[] | null = null
  if (district === 'body' && snap.body) steps = gymSteps(snap.body)
  if (district === 'mind' && snap.mind) steps = librarySteps(snap.mind)
  if (district === 'career' && snap.career) steps = officeSteps(snap.career)
  if (district === 'plan' && snap.plan) steps = townSteps(snap.plan)
  if (district === 'people' && snap.people) steps = parkSteps(snap.people)
  if (district === 'money' && snap.money) steps = bankSteps(snap.money)
  if (district === 'you' && snap.you) steps = homeSteps(snap.you)
  if (!steps) return null
  const stage = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done) ?? null
  return { stage, steps, next, line: next ? `Next: ${next.todo}` : (FULL[district] ?? 'Every window lit') }
}
