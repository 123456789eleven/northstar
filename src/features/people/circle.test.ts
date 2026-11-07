import { describe, expect, it } from 'vitest'
import { GLOW_FLOOR, glowFor, layoutCircle, mostOverdue, orbitFor, reminderLine } from './circle'

const NOW = '2026-11-02'

describe('orbitFor', () => {
  it('buckets cadence days', () => {
    expect([0, 7, 14, 30, 90, 180].map(orbitFor)).toEqual(['none', 'weekly', 'monthly', 'monthly', 'quarterly', 'other'])
  })
})

describe('glowFor', () => {
  it('is brightest on the day of contact and fades monotonically to a floor', () => {
    expect(glowFor({ cadenceDays: 30, lastContact: NOW }, NOW).glow).toBe(1)
    const g = [0, 5, 10, 20, 29, 30, 60].map((d) => glowFor({ cadenceDays: 30, lastContact: new Date(2026, 10, 2 - d).toISOString().slice(0, 10) }, NOW).glow)
    for (let i = 1; i < g.length; i++) expect(g[i]).toBeLessThanOrEqual(g[i - 1])
    expect(g[g.length - 1]).toBe(GLOW_FLOOR)
  })
  it('flags overdue only once the cadence has elapsed, and never for no-cadence', () => {
    expect(glowFor({ cadenceDays: 7, lastContact: '2026-10-27' }, NOW).overdue).toBe(false)
    expect(glowFor({ cadenceDays: 7, lastContact: '2026-10-26' }, NOW).overdue).toBe(true)
    expect(glowFor({ cadenceDays: 7 }, NOW)).toMatchObject({ overdue: true, glow: GLOW_FLOOR })
    expect(glowFor({ cadenceDays: 0, lastContact: '2020-01-01' }, NOW).overdue).toBe(false)
  })
})

describe('layoutCircle', () => {
  it('places 150 people without any overlap and inside the radius', () => {
    const cads = [7, 14, 30, 90, 365, 0]
    const items = Array.from({ length: 150 }, (_, i) => ({ id: i + 1, cadenceDays: cads[i % cads.length] }))
    const L = layoutCircle(items)
    expect(L.dots).toHaveLength(150)
    const min = 2 * L.dotR
    let worst = Infinity
    for (let a = 0; a < L.dots.length; a++) {
      const d = L.dots[a]
      expect(Math.hypot(d.x, d.y) + L.dotR).toBeLessThanOrEqual(L.radius)
      for (let b = a + 1; b < L.dots.length; b++) worst = Math.min(worst, Math.hypot(d.x - L.dots[b].x, d.y - L.dots[b].y))
    }
    expect(worst).toBeGreaterThanOrEqual(min)
  })
  it('keeps weekly inside monthly inside quarterly and is deterministic', () => {
    const items = [{ id: 3, cadenceDays: 90 }, { id: 1, cadenceDays: 7 }, { id: 2, cadenceDays: 30 }]
    const L = layoutCircle(items)
    const r = (k: string) => L.orbits.find((o) => o.key === k)!.r
    expect(r('weekly')).toBeLessThan(r('monthly'))
    expect(r('monthly')).toBeLessThan(r('quarterly'))
    expect(layoutCircle(items)).toEqual(L)
  })
  it('handles an empty list', () => {
    const L = layoutCircle([])
    expect(L.dots).toEqual([])
    expect(L.radius).toBeGreaterThan(0)
  })
})

describe('mostOverdue', () => {
  it('picks never-contacted first, then the largest overdue ratio; ignores up-to-date and no-cadence', () => {
    const a = { cadenceDays: 30, lastContact: '2026-10-30' }
    const b = { cadenceDays: 30, lastContact: '2026-08-01' }
    const c = { cadenceDays: 7, lastContact: '2026-10-01' }
    const z = { cadenceDays: 0 }
    expect(mostOverdue([a, z], NOW)).toBeNull()
    expect(mostOverdue([a, b, c], NOW)).toBe(c)
    expect(mostOverdue([a, b, { cadenceDays: 14 }], NOW)).toEqual({ cadenceDays: 14 })
  })
})

describe('reminderLine', () => {
  it('states the gap plainly', () => {
    expect(reminderLine({ name: 'Aisha', lastContact: '2026-10-15' }, '2026-11-06')).toBe('Aisha, 22 days since you spoke')
    expect(reminderLine({ name: 'Aisha', lastContact: '2026-11-05' }, '2026-11-06')).toBe('Aisha, 1 day since you spoke')
    expect(reminderLine({ name: 'Aisha' }, '2026-11-06')).toBe('Aisha, no contact logged yet')
  })
})
