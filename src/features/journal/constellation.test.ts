import { describe, expect, it } from 'vitest'
import { MAX_STAR, MIN_STAR, monthStars, moodStarSize, moodStep, weekDaysWritten } from './constellation'

describe('moodStarSize', () => {
  it('is 0 without words, grows monotonically, and is capped', () => {
    expect(moodStarSize(0, 150)).toBe(0)
    const a = moodStarSize(5, 150), b = moodStarSize(75, 150), c = moodStarSize(150, 150), d = moodStarSize(225, 150), e = moodStarSize(9999, 150)
    expect(a).toBeGreaterThanOrEqual(MIN_STAR)
    expect(a).toBeLessThan(b); expect(b).toBeLessThan(c); expect(c).toBeLessThan(d)
    expect(d).toBe(MAX_STAR); expect(e).toBe(MAX_STAR)
  })
})
describe('moodStep', () => {
  it('maps 1..5 and treats missing as 0', () => {
    expect(moodStep(undefined)).toBe(0); expect(moodStep(0)).toBe(0); expect(moodStep(3)).toBe(3); expect(moodStep(9)).toBe(5)
  })
})
describe('weekDaysWritten', () => {
  const words = (n: number) => Array(n).fill('w').join(' ')
  it('counts days with enough words inside the week only', () => {
    const e = [
      { date: '2026-11-02', text: words(12) }, { date: '2026-11-03', text: words(3) },
      { date: '2026-11-04', text: words(40) }, { date: '2026-10-31', text: words(40) },
    ]
    expect(weekDaysWritten(e, '2026-11-02', '2026-11-04')).toBe(2)
  })
})
describe('monthStars', () => {
  it('builds a star per day with lead offset', () => {
    const { lead, stars } = monthStars('2026-11', [{ date: '2026-11-05', text: 'one two three', mood: 4 }], 150)
    expect(lead).toBe(6)
    expect(stars).toHaveLength(30)
    expect(stars[4]).toMatchObject({ words: 3, step: 4 })
    expect(stars[4].r).toBeGreaterThan(0)
    expect(stars[0].r).toBe(0)
  })
})
