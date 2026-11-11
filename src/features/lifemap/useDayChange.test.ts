import { describe, expect, it } from 'vitest'
import { freshness } from './useDayChange'

describe('freshness', () => {
  it('labels age in words', () => {
    expect(freshness(1000, 20_000)).toBe('updated just now')
    expect(freshness(0, 5 * 60_000)).toBe('updated 5 min ago')
    expect(freshness(0, 3 * 3_600_000)).toBe('updated 3 h ago')
  })
})
