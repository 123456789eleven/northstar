import { describe, expect, it } from 'vitest'
import type { Goal, Task } from '../../db'
import { bossCheckpoints, bossHp, daysLeftInQuarter, exampleBosses, milestoneCheckpoints, nextStep, pickBosses, quarterRange, weightCheckpoints } from './boss'
import type { MetricResult } from '../progress/metrics'

const goal = (p: Partial<Goal> = {}): Goal => ({ id: 1, title: 'G', area: 'health', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-10-01T00:00:00.000Z', ...p })
const task = (p: Partial<Task>): Task => ({ id: 1, title: 'T', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-10-01T00:00:00.000Z', goalId: 1, ...p })
const metric = (p: Partial<MetricResult>): MetricResult => ({ source: 'weight', hasData: true, value: 150, target: 140, pct: 50, met: false, label: '', note: '', ...p })

describe('quarter', () => {
  it('bounds', () => {
    expect(quarterRange('2026-11-02')).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    expect(quarterRange('2026-02-28')).toEqual({ start: '2026-01-01', end: '2026-03-31' })
    expect(quarterRange('2026-04-01').end).toBe('2026-06-30')
  })
  it('days left, across the DST change', () => {
    expect(daysLeftInQuarter('2026-12-31')).toBe(0)
    expect(daysLeftInQuarter('2026-11-02')).toBe(59)
    expect(daysLeftInQuarter('2026-10-31')).toBe(61)
    expect(daysLeftInQuarter('2026-03-01')).toBe(30)
  })
})

describe('bossHp', () => {
  it('uses the metric when it has data', () => {
    const h = bossHp(goal({ milestones: [{ id: 'a', title: 'a', done: true }] }), [], metric({ pct: 25 }))
    expect(h).toEqual({ basis: 'metric', progress: 0.25, hp: 0.75 })
  })
  it('falls back to milestones, then tasks, then full HP', () => {
    const ms = [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false }]
    expect(bossHp(goal({ milestones: ms }), [], metric({ hasData: false })).hp).toBe(0.5)
    expect(bossHp(goal(), [task({ status: 'done' }), task({ id: 2 })]).basis).toBe('tasks')
    expect(bossHp(goal(), [])).toEqual({ basis: 'none', progress: 0, hp: 1 })
  })
  it('clamps and handles done', () => {
    expect(bossHp(goal(), [], metric({ pct: 400 })).hp).toBe(0)
    expect(bossHp(goal(), [], metric({ pct: Number.NaN })).hp).toBe(1)
    expect(bossHp(goal({ status: 'done' }), []).hp).toBe(0)
  })
})

describe('checkpoints', () => {
  it('weight flag every 5 lb going down, target last', () => {
    const c = weightCheckpoints(180, 165, 172)
    expect(c.map((x) => x.label)).toEqual(['175', '170', '165'])
    expect(c.map((x) => Math.round(x.pos))).toEqual([33, 67, 100])
    expect(c.map((x) => x.reached)).toEqual([true, false, false])
  })
  it('going up, uneven span', () => {
    const c = weightCheckpoints(150, 162, 156)
    expect(c.map((x) => x.label)).toEqual(['155', '160', '162'])
    expect(c[0].pos).toBeCloseTo(41.67, 1)
  })
  it('exact multiple has no duplicate flag; zero span is empty', () => {
    expect(weightCheckpoints(180, 170, null).map((x) => x.label)).toEqual(['175', '170'])
    expect(weightCheckpoints(170, 170, 170)).toEqual([])
  })
  it('milestones are evenly spaced', () => {
    const g = goal({ milestones: [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false }, { id: 'c', title: 'c', done: false }, { id: 'd', title: 'd', done: false }] })
    expect(milestoneCheckpoints(g).map((c) => c.pos)).toEqual([25, 50, 75, 100])
    expect(bossCheckpoints(g, null).length).toBe(4)
  })
  it('weight goal uses the metric flags', () => {
    const g = goal({ metric: { source: 'weight', target: 165 } })
    const flags = bossCheckpoints(g, metric({ value: 176 }), { today: '2026-11-02', startWeight: 180, weights: [] })
    expect(flags.map((f) => f.label)).toEqual(['175', '170', '165'])
  })
})

describe('nextStep', () => {
  const ms = [{ id: 'a', title: 'First', done: true }, { id: 'b', title: 'Second', done: false }]
  it('next unchecked milestone wins', () => {
    expect(nextStep(goal({ milestones: ms }), [task({})])).toEqual({ kind: 'milestone', text: 'Second' })
  })
  it('then the oldest open linked task', () => {
    const t = [
      task({ id: 2, title: 'newer', createdAt: '2026-10-05T00:00:00.000Z' }),
      task({ id: 3, title: 'older', createdAt: '2026-10-02T00:00:00.000Z' }),
      task({ id: 4, title: 'other goal', goalId: 9 }),
      task({ id: 5, title: 'done', status: 'done', createdAt: '2026-09-01T00:00:00.000Z' }),
    ]
    expect(nextStep(goal(), t)).toMatchObject({ kind: 'task', text: 'older', taskId: 3 })
  })
  it('then suggests linking a metric', () => {
    expect(nextStep(goal(), []).kind).toBe('link-metric')
    expect(nextStep(goal({ metric: { source: 'weight', target: 1 } }), []).kind).toBe('add-milestone')
  })
})

describe('pickBosses / examples', () => {
  it('only active quarter goals, soonest first', () => {
    const gs = [goal({ id: 1, horizon: 'year' }), goal({ id: 2, targetDate: '2026-12-31' }), goal({ id: 3, targetDate: '2026-11-30' }), goal({ id: 4, status: 'paused' })]
    expect(pickBosses(gs).map((g) => g.id)).toEqual([3, 2])
    expect(pickBosses(gs, 1)).toHaveLength(1)
  })
  it('two fictional examples ending with the quarter', () => {
    const ex = exampleBosses('2026-11-02')
    expect(ex).toHaveLength(2)
    expect(ex[0].targetDate).toBe('2026-12-31')
  })
})
