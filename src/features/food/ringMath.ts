// Pure macro-ring math: how full a ring is, what is left, whether it just reached its target.
export interface RingFill {
  /** 0..1, for the ring stroke. */
  fill: number
  /** Raw ratio (can exceed 1). */
  ratio: number
  left: number
  over: number
  reached: boolean
}

export function ringFill(value: number, target: number | undefined): RingFill {
  if (!target || target <= 0) return { fill: 0, ratio: 0, left: 0, over: 0, reached: false }
  const v = Math.max(0, value)
  const ratio = v / target
  return { fill: Math.min(1, ratio), ratio, left: Math.max(0, Math.round(target - v)), over: Math.max(0, Math.round(v - target)), reached: v >= target }
}

/** True only on the step where the ring crosses its target (not on load, not when already full). */
export const justReached = (prev: number | null, next: number, target: number | undefined): boolean =>
  !!target && prev != null && prev < target && next >= target

export type DotState = 'met' | 'close' | 'missed' | 'none' | 'empty'

/** One dot for a day from its calorie and protein states: the worst defined state wins; nothing logged = empty; no targets = none. */
export function combineDayStates(states: DotState[]): DotState {
  const real = states.filter((s) => s !== 'none')
  if (!real.length) return 'none'
  if (real.includes('empty')) return 'empty'
  if (real.includes('missed')) return 'missed'
  if (real.includes('close')) return 'close'
  return 'met'
}
