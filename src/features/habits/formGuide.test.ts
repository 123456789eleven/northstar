import { describe, expect, it } from 'vitest'
import { formGuide, formSummary } from './formGuide'

describe('formGuide', () => {
  const today = '2026-11-10' // Tuesday; week starts Monday 2026-11-09
  it('returns 8 weeks oldest first, current last', () => {
    const g = formGuide(new Set(), today, 3)
    expect(g).toHaveLength(8)
    expect(g[7].start).toBe('2026-11-09')
    expect(g[7].current).toBe(true)
    expect(g[0].start).toBe('2026-09-21')
  })
  it('marks met, part and none', () => {
    const dates = new Set(['2026-11-02', '2026-11-03', '2026-11-04', '2026-10-26'])
    const g = formGuide(dates, today, 3)
    expect(g[6].mark).toBe('met')
    expect(g[5].mark).toBe('part')
    expect(g[4].mark).toBe('none')
  })
  it('summarises past weeks only', () => {
    const dates = new Set(['2026-11-02', '2026-11-03', '2026-11-04'])
    expect(formSummary(formGuide(dates, today, 3))).toBe('1 of the last 7 weeks on target')
  })
})
