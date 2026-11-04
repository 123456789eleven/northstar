import { describe, expect, it } from 'vitest'
import { checkpointFlags, checkpointTargets, ghostLine } from './pathModel'

describe('checkpointTargets', () => {
  it('gain: every 5 lb above start, then the goal', () => {
    expect(checkpointTargets(136, 156)).toEqual([140, 145, 150, 155, 156])
    expect(checkpointTargets(135, 150)).toEqual([140, 145, 150])
  })
  it('loss: every 5 lb below start, descending, then the goal', () => {
    expect(checkpointTargets(184, 170)).toEqual([180, 175, 170])
  })
  it('flat: only the goal', () => {
    expect(checkpointTargets(150, 150)).toEqual([150])
  })
})

describe('checkpointFlags', () => {
  const w = (d: string, weight: number) => ({ date: d, weight })
  it('lights crossed flags and marks the next with lb to go', () => {
    const flags = checkpointFlags([w('2026-01-01', 136), w('2026-01-05', 146)], 136, 150, 141)
    expect(flags.map((f) => f.reached)).toEqual([true, false, false])
    expect(flags[0].crossedOn).toBe('2026-01-05')
    expect(flags[1].next).toBe(true)
    expect(flags[1].lbToGo).toBe(4)
    expect(flags[2].next).toBe(false)
  })
  it('handles loss', () => {
    const flags = checkpointFlags([w('2026-01-01', 184), w('2026-01-05', 172)], 184, 170, 178)
    expect(flags.map((f) => [f.target, f.reached])).toEqual([[180, true], [175, false], [170, false]])
    expect(flags[1].lbToGo).toBe(3)
  })
  it('flat: the goal flag is reached', () => {
    const flags = checkpointFlags([w('2026-01-01', 150)], 150, 150, 150)
    expect(flags).toHaveLength(1)
    expect(flags[0].reached).toBe(true)
    expect(flags[0].next).toBe(false)
  })
})

describe('ghostLine', () => {
  it('runs at the healthy rate to the goal', () => {
    const g = ghostLine(140, 145, '2026-03-01', undefined, 0.75)
    expect(g.points[0]).toEqual({ date: '2026-03-01', ghost: 140 })
    expect(g.points[1].ghost).toBe(145)
    expect(g.endDate).toBe('2026-03-48'.length ? '2026-04-17' : '')
    expect(g.makesTarget).toBe(true)
  })
  it('stops at the target date when that comes first', () => {
    const g = ghostLine(140, 160, '2026-03-01', '2026-03-15', 0.7)
    expect(g.endDate).toBe('2026-03-15')
    expect(g.points[1].ghost).toBeCloseTo(141.4, 1)
    expect(g.makesTarget).toBe(false)
  })
  it('is empty when already at the goal', () => {
    expect(ghostLine(150, 150, '2026-03-01').points).toEqual([])
  })
  it('descends for a loss goal', () => {
    const g = ghostLine(180, 175, '2026-03-01', undefined, 1)
    expect(g.points[1].ghost).toBe(175)
  })
})
