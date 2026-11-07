import { describe, expect, it } from 'vitest'
import { areaWeek, inputLine } from './areas'

const W = '2026-11-02'
describe('areaWeek', () => {
  const acts = [
    { kind: 'weigh-in', skill: 'body' as const, date: '2026-11-02' },
    { kind: 'meal', skill: 'body' as const, date: '2026-11-02' },
    { kind: 'meal', skill: 'body' as const, date: '2026-11-03' },
    { kind: 'meal', skill: 'body' as const, date: '2026-11-04' },
    { kind: 'day-clear', skill: 'body' as const, date: '2026-11-04' },
    { kind: 'meal', skill: 'body' as const, date: '2026-10-30' },
    { kind: 'journal', skill: 'mind' as const, date: '2026-11-05' },
  ]
  it('counts days and inputs inside the week only', () => {
    const body = areaWeek(acts, W, 5).find((a) => a.id === 'body')!
    expect(body.days).toBe(3)
    expect(body.value).toBeCloseTo(0.6)
    expect(body.total).toBe(4)
    expect(body.inputs[0]).toMatchObject({ kind: 'meal', count: 3, label: 'meals logged' })
    expect(inputLine(body)).toBe('3 meals logged, 1 weigh-in')
  })
  it('caps at 1 and handles empty areas', () => {
    const m = areaWeek(acts, W, 1).find((a) => a.id === 'mind')!
    expect(m.value).toBe(1)
    expect(inputLine(areaWeek([], W, 5)[0])).toMatch(/Nothing counted/)
  })
})
