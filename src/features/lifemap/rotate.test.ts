import { describe, expect, it } from 'vitest'
import { areaWeek } from '../game/areas'
import { project, quarter, rotateRect, rotateTile, swingMatrix, swingTransform, tiltPoint, unproject } from './iso'
import { buildLifeMap } from './model'
import { rotateMap } from './rotate'

describe('quarter turns', () => {
  it('normalises any integer to 0..3', () => {
    expect([-5, -1, 0, 3, 4, 7].map(quarter)).toEqual([3, 3, 0, 3, 0, 3])
  })
  it('rotates a tile point and comes back after four turns', () => {
    expect(rotateTile(2, 1, 1)).toEqual({ x: -1, y: 2 })
    expect(rotateTile(2, 1, 2)).toEqual({ x: -2, y: -1 })
    expect(rotateTile(2, 1, 3)).toEqual({ x: 1, y: -2 })
    let p = { x: 3, y: -4 }
    for (let i = 0; i < 4; i++) p = rotateTile(p.x, p.y, 1)
    expect(p).toEqual({ x: 3, y: -4 })
  })
  it('rotates a footprint to the same cells, back corner first', () => {
    for (const r of [0, 1, 2, 3]) {
      const o = rotateRect(1, 2, 3, 1, r)
      const corners = [[1, 2], [4, 2], [4, 3], [1, 3]].map(([x, y]) => rotateTile(x, y, r))
      expect(Math.min(...corners.map((c) => c.x))).toBeCloseTo(o.x)
      expect(Math.min(...corners.map((c) => c.y))).toBeCloseTo(o.y)
      expect(Math.max(...corners.map((c) => c.x)) - o.x).toBeCloseTo(o.w)
      expect(Math.max(...corners.map((c) => c.y)) - o.y).toBeCloseTo(o.d)
    }
  })
})

describe('rotation swing', () => {
  const apply = (m: number[], p: { x: number; y: number }) => ({ x: m[0] * p.x + m[2] * p.y, y: m[1] * p.x + m[3] * p.y })
  it('is the identity at zero and draws nothing', () => {
    const m = swingMatrix(0)
    expect(m.map((n) => Math.round(n * 1e6) / 1e6)).toEqual([1, 0, 0, 1])
    expect(swingTransform(0, { x: 5, y: 5 })).toBe('')
  })
  it('lands on the rotated projection at a quarter turn', () => {
    const m = swingMatrix(Math.PI / 2)
    for (const [x, y] of [[1, 0], [0, 1], [3, -2]]) {
      const got = apply(m, project(x, y))
      const want = rotateTile(x, y, 1)
      const back = unproject(got.x, got.y)
      expect(back.x).toBeCloseTo(want.x)
      expect(back.y).toBeCloseTo(want.y)
    }
  })
  it('keeps the pivot fixed', () => {
    const t = swingTransform(0.3, { x: 100, y: 40 })
    const [a, b, c, d, e, f] = t.slice(7, -1).split(' ').map(Number)
    expect(a * 100 + c * 40 + e).toBeCloseTo(100, 0)
    expect(b * 100 + d * 40 + f).toBeCloseTo(40, 0)
  })
})

describe('perspective tilt', () => {
  const view = { w: 1000, h: 600 }
  it('leaves the centre in place and does nothing at zero tilt', () => {
    expect(tiltPoint({ x: 500, y: 300 }, view, { rx: 12, ry: 5 })).toEqual({ x: 500, y: 300 })
    const p = tiltPoint({ x: 120, y: 80 }, view, { rx: 0, ry: 0 })
    expect(p.x).toBeCloseTo(120)
    expect(p.y).toBeCloseTo(80)
  })
  it('makes the far (top) side smaller than the near side when tilted back', () => {
    const t = { rx: 12, ry: 0 }
    const topW = tiltPoint({ x: 900, y: 0 }, view, t).x - tiltPoint({ x: 100, y: 0 }, view, t).x
    const botW = tiltPoint({ x: 900, y: 600 }, view, t).x - tiltPoint({ x: 100, y: 600 }, view, t).x
    expect(topW).toBeLessThan(800)
    expect(botW).toBeGreaterThan(800)
  })
})

describe('rotateMap', () => {
  const map = buildLifeMap({
    areas: areaWeek([{ kind: 'workout', skill: 'body', date: '2026-11-10' }, { kind: 'journal', skill: 'mind', date: '2026-11-10' }], '2026-11-09', 5),
    target: 5, today: '2026-11-11', netWorth: 50000, budgetsOver: 0, peopleTotal: 2, peopleOverdue: 0, planLeft: 1, planTotal: 2, milestones: [],
    people: [{ id: 1, name: 'A', ring: 0.5, overdue: false }, { id: 2, name: 'B', ring: null, overdue: false }],
  })
  it('returns the same object for no turn and the same map after four', () => {
    expect(rotateMap(map, 0)).toBe(map)
    let m = map
    for (let i = 0; i < 4; i++) m = rotateMap(m, 1)
    expect(m.districts.map((d) => d.origin)).toEqual(map.districts.map((d) => d.origin))
    expect(m.cityBounds.minX).toBeCloseTo(map.cityBounds.minX)
  })
  it('moves districts to the next side and keeps heights, labels and counts', () => {
    const r = rotateMap(map, 1)
    const body = r.districts.find((d) => d.id === 'body')!, was = map.districts.find((d) => d.id === 'body')!
    expect(body.centre).not.toEqual(was.centre)
    expect(was.centre.y - was.top.y).toBeCloseTo(body.centre.y - body.top.y)
    expect(body.buildings.map((b) => b.h)).toEqual(was.buildings.map((b) => b.h))
    expect(r.outskirts).toHaveLength(map.outskirts.length)
    expect(r.cars).toHaveLength(map.cars.length)
    // Money sits on the pivot, so its centre stays put.
    expect(r.districts.find((d) => d.id === 'money')!.centre.x).toBeCloseTo(map.districts.find((d) => d.id === 'money')!.centre.x)
  })
})
