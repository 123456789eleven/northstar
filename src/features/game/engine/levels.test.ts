import { describe, expect, it } from 'vitest'
import { levelInfo, xpToReach } from './levels'

describe('levels', () => {
  it('follows 100*n(n+1)/2 to finish level n', () => {
    expect(xpToReach(1)).toBe(0)
    expect(xpToReach(2)).toBe(100)
    expect(xpToReach(3)).toBe(300)
    expect(xpToReach(4)).toBe(600)
  })
  it('handles boundaries', () => {
    expect(levelInfo(0)).toEqual({ level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100 })
    expect(levelInfo(99)).toMatchObject({ level: 1, xpIntoLevel: 99 })
    expect(levelInfo(100)).toMatchObject({ level: 2, xpIntoLevel: 0, xpForNext: 200 })
    expect(levelInfo(299)).toMatchObject({ level: 2, xpIntoLevel: 199 })
    expect(levelInfo(300)).toMatchObject({ level: 3, xpIntoLevel: 0, xpForNext: 300 })
  })
  it('never breaks on bad or huge input', () => {
    expect(levelInfo(-5).level).toBe(1)
    expect(levelInfo(NaN).level).toBe(1)
    const big = levelInfo(1e12)
    expect(xpToReach(big.level)).toBeLessThanOrEqual(1e12)
    expect(xpToReach(big.level + 1)).toBeGreaterThan(1e12)
    expect(big.xpIntoLevel).toBeLessThan(big.xpForNext)
  })
  it('is consistent for every level edge', () => {
    for (let n = 1; n < 500; n++) {
      expect(levelInfo(xpToReach(n)).level).toBe(n)
      expect(levelInfo(xpToReach(n + 1) - 1).level).toBe(n)
    }
  })
})
