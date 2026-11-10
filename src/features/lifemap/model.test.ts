import { describe, expect, it } from 'vitest'
import { areaWeek } from '../game/areas'
import {
  behindPace, blockHeight, buildCars, buildLifeMap, buildOutskirts, buildRoads, MAX_CARS, MAX_H, MAX_OUTSKIRTS, MAX_TREES, MIN_H, money,
  rng, weightProgress, worthScore, type LifeInput,
} from './model'

const WEEK = '2026-11-09' // Monday
const base = (over: Partial<LifeInput> = {}, actions: { kind: string; skill: 'body' | 'money' | 'mind' | 'career' | 'people'; date: string }[] = []): LifeInput => ({
  areas: areaWeek(actions, WEEK, 5), target: 5, today: '2026-11-12', netWorth: null, budgetsOver: 0,
  peopleTotal: 0, peopleOverdue: 0, planLeft: 0, planTotal: 0, milestones: [], ...over,
})
const tallest = (m: ReturnType<typeof buildLifeMap>, id: string) => Math.max(...m.districts.find((d) => d.id === id)!.buildings.map((b) => b.h))

describe('buildLifeMap', () => {
  it('renders a quiet city with no data: unlit, no beacons, placeholder saplings', () => {
    const m = buildLifeMap(base())
    expect(m.empty).toBe(true)
    expect(m.districts).toHaveLength(5)
    for (const d of m.districts) {
      expect(d.buildings.every((b) => !b.lit)).toBe(true)
      expect(d.beacon).toBeNull()
      expect(d.gold).toBe(false)
    }
    const people = m.districts.find((d) => d.id === 'people')!
    expect(people.trees.every((t) => t.placeholder)).toBe(true)
    expect(m.overview.netWorth).toBe('None yet')
  })

  it('makes active areas taller and brighter than idle ones', () => {
    const acts = ['2026-11-09', '2026-11-10', '2026-11-11'].flatMap((date) => [{ kind: 'workout', skill: 'body' as const, date }, { kind: 'meal', skill: 'body' as const, date }])
    const m = buildLifeMap(base({}, acts))
    const body = m.districts.find((d) => d.id === 'body')!
    expect(body.glow).toBeCloseTo(0.6)
    expect(tallest(m, 'body')).toBeGreaterThan(tallest(m, 'mind'))
    expect(tallest(m, 'body')).toBeLessThanOrEqual(MAX_H)
    expect(body.buildings[0].e).toBeGreaterThan(m.districts.find((d) => d.id === 'mind')!.buildings[0].e)
  })

  it('raises the bank tower with net worth and adds one tower per holding share', () => {
    const poor = buildLifeMap(base({ netWorth: 500 }))
    const rich = buildLifeMap(base({ netWorth: 250000, holdings: [{ ticker: 'AAA', value: 30000 }, { ticker: 'BBB', value: 10000 }] }))
    expect(tallest(rich, 'money')).toBeGreaterThan(tallest(poor, 'money'))
    const towers = rich.districts.find((d) => d.id === 'money')!.buildings.slice(1, 5)
    expect(towers[0].h).toBeGreaterThan(towers[1].h)
    expect(towers[2].lit).toBe(false)
  })

  it('plants one tree per person (capped) with poppy only when overdue', () => {
    const people = Array.from({ length: 20 }, (_, i) => ({ id: i + 1, name: `P${i}`, ring: i === 0 ? 0 : 0.5, overdue: i === 0 }))
    const m = buildLifeMap(base({ people, peopleTotal: 20, peopleOverdue: 1 }))
    const trees = m.districts.find((d) => d.id === 'people')!.trees
    expect(trees).toHaveLength(MAX_TREES)
    expect(trees.filter((t) => t.overdue)).toHaveLength(1)
  })

  it('lights the body path toward goal weight and flags gold only when reached', () => {
    const half = buildLifeMap(base({ weight: { start: 150, current: 157.5, goal: 165 } })).districts.find((d) => d.id === 'body')!
    expect(half.path.filter((s) => s.lit).length).toBeGreaterThan(3)
    expect(half.pathDone).toBe(false)
    const done = buildLifeMap(base({ weight: { start: 150, current: 166, goal: 165 } })).districts.find((d) => d.id === 'body')!
    expect(done.path.every((s) => s.lit)).toBe(true)
    expect(done.pathDone).toBe(true)
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

describe('city helpers', () => {
  it('caps cars and outskirts and keeps them deterministic', () => {
    const roads = buildRoads()
    expect(buildCars(roads, 1)).toHaveLength(MAX_CARS)
    expect(buildCars(roads, 0).length).toBeLessThan(MAX_CARS)
    expect(buildOutskirts()).toHaveLength(MAX_OUTSKIRTS)
    expect(buildOutskirts()).toEqual(buildOutskirts())
    const a = rng(1), b = rng(1)
    expect(a()).toBe(b())
  })
  it('weightProgress works both directions and clamps', () => {
    expect(weightProgress(null)).toBeNull()
    expect(weightProgress({ start: 200, current: 190, goal: 180 })).toBeCloseTo(0.5)
    expect(weightProgress({ start: 150, current: 140, goal: 165 })).toBe(0)
  })
  it('worthScore is log scaled', () => {
    expect(worthScore(null)).toBe(0)
    expect(worthScore(-5)).toBe(0)
    expect(worthScore(1e4)).toBeLessThan(worthScore(1e6))
    expect(worthScore(1e9)).toBe(1)
  })
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
