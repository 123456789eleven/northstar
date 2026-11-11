import { describe, expect, it } from 'vitest'
import { grownKeys } from './growth'
import { fogFor, hash01, lightingAt, lightingFor, windowOn } from './light'

describe('time-of-day lighting', () => {
  it('is full night late and early, full day at midday', () => {
    expect(lightingAt(23).phase).toBe('night')
    expect(lightingAt(2).night).toBe(1)
    expect(lightingAt(13)).toMatchObject({ phase: 'day', night: 0 })
  })
  it('ramps through dawn and dusk', () => {
    expect(lightingAt(6.5).phase).toBe('dawn')
    expect(lightingAt(19).phase).toBe('dusk')
    expect(lightingAt(18).night).toBeLessThan(lightingAt(20).night)
    expect(lightingAt(6).night).toBeGreaterThan(lightingAt(7.5).night)
  })
  it('lights more windows at night but never all, and a few by day', () => {
    const day = lightingAt(12).windows, night = lightingAt(0).windows
    expect(day).toBeGreaterThan(0)
    expect(night).toBeGreaterThan(day)
    expect(night).toBeLessThan(0.8)
    expect(Math.round(night * 20)).toBe(night * 20)
  })
  it('wraps hours and reads a Date in local time', () => {
    expect(lightingAt(25)).toEqual(lightingAt(1))
    expect(lightingFor(new Date(2026, 10, 10, 22, 30)).phase).toBe('night')
  })
})

describe('windows and fog', () => {
  it('hashes deterministically into 0..1', () => {
    expect(hash01(42)).toBe(hash01(42))
    for (let i = 0; i < 50; i++) { const h = hash01(i); expect(h).toBeGreaterThanOrEqual(0); expect(h).toBeLessThan(1) }
  })
  it('only turns windows on as the share rises', () => {
    for (let i = 0; i < 40; i++) if (windowOn(3, i, 0.3)) expect(windowOn(3, i, 0.6)).toBe(true)
    expect(Array.from({ length: 40 }, (_, i) => windowOn(3, i, 0)).some(Boolean)).toBe(false)
  })
  it('fogs the back of the city and leaves the front clear', () => {
    expect(fogFor(10, 0.5)).toBe(0)
    expect(fogFor(-12, 0.5)).toBeGreaterThan(fogFor(-6, 0.5))
    expect(fogFor(-100, 0.5)).toBe(0.5)
  })
})

describe('growth', () => {
  it('raises nothing on the first look, then buildings that grew and new trees', () => {
    const a = new Map([['money:0', 40], ['money:1', 30], ['people:t1', 1]])
    expect(grownKeys(null, a).size).toBe(0)
    const b = new Map([['money:0', 80], ['money:1', 31], ['people:t1', 1], ['people:t2', 1]])
    expect([...grownKeys(a, b)].sort()).toEqual(['money:0', 'people:t2'])
  })
})
