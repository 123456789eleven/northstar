import { describe, expect, it } from 'vitest'
import { areaWeek } from '../game/areas'
import { behindPace, blockHeight, buildLifeMap, MAX_H, MIN_H, money, type LifeInput } from './model'

const WEEK = '2026-11-09' // Monday
const base = (over: Partial<LifeInput> = {}, actions: { kind: string; skill: 'body' | 'money' | 'mind' | 'career' | 'people'; date: string }[] = []): LifeInput => ({
  areas: areaWeek(actions, WEEK, 5), target: 5, today: '2026-11-12', netWorth: null, budgetsOver: 0,
  peopleTotal: 0, peopleOverdue: 0, planLeft: 0, planTotal: 0, milestones: [], ...over,
})

describe('buildLifeMap', () => {
  it('renders five quiet districts at minimum height with no data', () => {
    const m = buildLifeMap(base())
    expect(m.empty).toBe(true)
    expect(m.districts).toHaveLength(5)
    for (const d of m.districts) {
      expect(d.blocks.every((b) => b.h === MIN_H)).toBe(true)
      expect(d.beacon).toBeNull()
      expect(d.gold).toBe(false)
    }
    expect(m.overview.netWorth).toBe('None yet')
  })

  it('makes active areas taller and brighter than idle ones', () => {
    const acts = ['2026-11-09', '2026-11-10', '2026-11-11'].flatMap((date) => [{ kind: 'workout', skill: 'body' as const, date }, { kind: 'meal', skill: 'body' as const, date }])
    const m = buildLifeMap(base({}, acts))
    const body = m.districts.find((d) => d.id === 'body')!
    const mind = m.districts.find((d) => d.id === 'mind')!
    expect(body.glow).toBeCloseTo(0.6)
    expect(Math.max(...body.blocks.map((b) => b.h))).toBeGreaterThan(Math.max(...mind.blocks.map((b) => b.h)))
    expect(Math.max(...body.blocks.map((b) => b.h))).toBeLessThanOrEqual(MAX_H)
  })

  it('shows beacons for over budget, overdue people and behind pace', () => {
    const acts = [{ kind: 'journal', skill: 'mind' as const, date: '2026-11-09' }]
    const m = buildLifeMap(base({ budgetsOver: 2, peopleOverdue: 1, peopleTotal: 4, netWorth: 12500 }, acts))
    const by = Object.fromEntries(m.districts.map((d) => [d.id, d]))
    expect(by.money.beacon).toMatch(/2 budgets over/)
    expect(by.people.beacon).toMatch(/1 person due/)
    expect(by.body.beacon).toMatch(/Behind pace/)
    expect(m.overview.toContact).toBe('1')
    expect(m.overview.netWorth).toBe('$12,500')
  })

  it('marks gold only where a milestone was logged', () => {
    const m = buildLifeMap(base({ milestones: ['career'] }))
    expect(m.districts.filter((d) => d.gold).map((d) => d.id)).toEqual(['career'])
  })
})

describe('helpers', () => {
  it('behindPace waits until mid week', () => {
    expect(behindPace(0, 5, '2026-11-10')).toBe(false)
    expect(behindPace(0, 5, '2026-11-12')).toBe(true)
    expect(behindPace(3, 5, '2026-11-12')).toBe(false)
  })
  it('scales block height with a floor and a cap', () => {
    expect(blockHeight(0)).toBe(MIN_H)
    expect(blockHeight(99)).toBeLessThan(MAX_H)
  })
  it('formats money', () => { expect(money(-1234.4)).toBe('-$1,234') })
})
