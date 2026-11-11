import { describe, expect, it } from 'vitest'
import { DEFAULT_CALORIE_TARGET, effectiveCalorieTarget, effectiveProteinTarget } from './foodData'

describe('effectiveCalorieTarget', () => {
  it('defaults to 3000 when nothing is stored', () => {
    expect(DEFAULT_CALORIE_TARGET).toBe(3000)
    expect(effectiveCalorieTarget(undefined)).toBe(3000)
    expect(effectiveCalorieTarget({})).toBe(3000)
    expect(effectiveCalorieTarget({ calories: 0 })).toBe(3000)
  })
  it('uses the stored target', () => {
    expect(effectiveCalorieTarget({ calories: 2600, protein: 150 })).toBe(2600)
  })
})

describe('effectiveProteinTarget', () => {
  it('uses the stored protein, else 0.8 g per lb of the goal weight', () => {
    expect(effectiveProteinTarget({ protein: 150 }, 165)).toBe(150)
    expect(effectiveProteinTarget({}, 165)).toBe(132)
    expect(effectiveProteinTarget(undefined, 180)).toBe(144)
    expect(effectiveProteinTarget({ protein: 0 }, Number.NaN)).toBe(132)
  })
})
