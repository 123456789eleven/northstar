import { describe, expect, it } from 'vitest'
import { comboCount } from './combo'

const m = 60_000
describe('combo window', () => {
  it('counts completions within 10 minutes', () => {
    expect(comboCount([0, 2 * m, 4 * m], 4 * m)).toBe(3)
    expect(comboCount([0, 5 * m, 11 * m], 11 * m)).toBe(2)
    expect(comboCount([0, 10 * m], 10 * m)).toBe(2)
    expect(comboCount([], 5)).toBe(0)
  })
})
