import { describe, expect, it } from 'vitest'
import { DEFAULT_CALORIE_TARGET, effectiveCalorieTarget } from './foodData'

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
