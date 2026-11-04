// Pure math for the Weight path: +5 lb checkpoint flags (gain, loss or flat) and the ghost line to the target date.
import type { ISODate } from '../../db'
import { addDays, daysBetween } from '../../lib/dates'
import { HEALTHY_RATE, movingAverage, type WeightPoint } from './model'

export interface CheckpointFlag {
  target: number
  /** First date the 7-day average reached this checkpoint, null while still ahead. */
  crossedOn: ISODate | null
  reached: boolean
  /** The first flag not yet reached: it shows how many lb are left. */
  next: boolean
  /** Pounds still to go (>= 0); 0 once reached. */
  lbToGo: number
  isGoal: boolean
}

/** Checkpoint targets from `start` toward `goal`: every multiple of 5 strictly between them, then the goal. Flat (start = goal): just the goal. */
export function checkpointTargets(start: number, goal: number): number[] {
  const out: number[] = []
  if (goal > start) {
    for (let t = (Math.floor(start / 5) + 1) * 5; t < goal; t += 5) out.push(t)
  } else if (goal < start) {
    for (let t = (Math.ceil(start / 5) - 1) * 5; t > goal; t -= 5) out.push(t)
  }
  out.push(goal)
  return out
}

/** Flags for the path. `current` = the 7-day average now. A flag is reached once the 7-day average has crossed it. */
export function checkpointFlags(weights: WeightPoint[], start: number, goal: number, current: number): CheckpointFlag[] {
  const series = movingAverage(weights)
  const up = goal >= start
  const hit = (avg: number, t: number) => (up ? avg >= t : avg <= t)
  let nextSet = false
  return checkpointTargets(start, goal).map((target) => {
    const crossedOn = series.find((p) => hit(p.avg, target))?.date ?? null
    const reached = crossedOn != null || hit(current, target)
    const next = !reached && !nextSet
    if (next) nextSet = true
    return { target, crossedOn, reached, next, lbToGo: reached ? 0 : Math.round(Math.abs(target - current) * 10) / 10, isGoal: target === goal }
  })
}

export interface GhostLine {
  points: { date: ISODate; ghost: number }[]
  /** Date the ghost line ends (goal reached at the healthy rate, or the target date if that comes first). */
  endDate: ISODate | null
  /** True when the healthy-rate line reaches the goal on or before the target date (or there is no target date). */
  makesTarget: boolean
}

const MAX_GHOST_DAYS = 730

/** Straight line from today's average toward the goal at `rate` lb/week, stopping at the goal or the target date. */
export function ghostLine(current: number, goal: number, from: ISODate, targetDate?: ISODate, rate = HEALTHY_RATE): GhostLine {
  const diff = goal - current
  if (Math.abs(diff) < 0.05 || rate <= 0) return { points: [], endDate: null, makesTarget: true }
  const daysToGoal = Math.min(MAX_GHOST_DAYS, Math.ceil((Math.abs(diff) / rate) * 7))
  const limit = targetDate && targetDate > from ? daysBetween(from, targetDate) : null
  const days = limit != null ? Math.min(daysToGoal, limit) : daysToGoal
  const sign = diff > 0 ? 1 : -1
  const end = current + sign * (rate / 7) * days
  const endVal = sign > 0 ? Math.min(goal, end) : Math.max(goal, end)
  return {
    points: [{ date: from, ghost: current }, { date: addDays(from, days), ghost: Math.round(endVal * 100) / 100 }],
    endDate: addDays(from, days),
    makesTarget: limit == null || daysToGoal <= limit,
  }
}
