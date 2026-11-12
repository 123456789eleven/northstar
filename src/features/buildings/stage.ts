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

export interface BuildingSnapshot { body?: GymSnapshot; mind?: LibrarySnapshot; career?: OfficeSnapshot }

export const LIBRARY_DAYS = 3
export const OFFICE_WINS = 3
export const OFFICE_CASE = 60

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

const FULL: Partial<Record<DistrictId, string>> = { body: 'Every window lit', mind: 'Every window lit', career: 'Every window lit' }

/** The building's stage from its snapshot, or null for a building that has no stage yet. */
export function buildingStage(district: DistrictId, snap: BuildingSnapshot): BuildingStage | null {
  let steps: StageStep[] | null = null
  if (district === 'body' && snap.body) steps = gymSteps(snap.body)
  if (district === 'mind' && snap.mind) steps = librarySteps(snap.mind)
  if (district === 'career' && snap.career) steps = officeSteps(snap.career)
  if (!steps) return null
  const stage = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done) ?? null
  return { stage, steps, next, line: next ? `Next: ${next.todo}` : (FULL[district] ?? 'Every window lit') }
}
