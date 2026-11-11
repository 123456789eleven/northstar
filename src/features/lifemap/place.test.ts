import { describe, expect, it } from 'vitest'
import { areaWeek } from '../game/areas'
import { buildLifeMap } from './model'
import { backdropFocus, backdropOffset, placeAnchors } from './place'
import { DISTRICT_ORDER } from '../../components/districts'

const map = buildLifeMap({
  areas: areaWeek([], '2026-11-09', 5), target: 5, today: '2026-11-12', netWorth: null, budgetsOver: 0,
  peopleTotal: 0, peopleOverdue: 0, planLeft: 0, planTotal: 0, milestones: [],
})

describe('mini-map anchors', () => {
  it('places every district except Home inside the chip, with room for 40x32 hit targets', () => {
    const view = { w: 176, h: 100 }
    const { anchors } = placeAnchors(map, view)
    expect(anchors.map((a) => a.id).sort()).toEqual(DISTRICT_ORDER.filter((d) => d !== 'home').sort())
    for (const a of anchors) {
      expect(a.x).toBeGreaterThan(0); expect(a.x).toBeLessThan(view.w)
      expect(a.y).toBeGreaterThan(0); expect(a.y).toBeLessThan(view.h)
    }
    for (const a of anchors) for (const b of anchors) {
      if (a === b) continue
      expect(Math.abs(a.x - b.x) >= 40 || Math.abs(a.y - b.y) >= 32).toBe(true)
    }
  })
})

describe('backdrop camera', () => {
  it('looks at each place, and at the middle for Home', () => {
    const money = map.districts.find((d) => d.id === 'money')!
    expect(backdropFocus(map, 'money').x).toBe(money.centre.x)
    expect(backdropFocus(map, 'plan').y).toBeLessThan(backdropFocus(map, 'you').y)
    const mid = backdropFocus(map, 'home')
    expect(mid.x).toBeCloseTo((map.cityBounds.minX + map.cityBounds.maxX) / 2)
    expect(backdropOffset({ x: 10, y: 20 }, { minX: 0, minY: 0, maxX: 100, maxY: 100 }, 2)).toEqual({ x: 20, y: 40 })
  })
})
