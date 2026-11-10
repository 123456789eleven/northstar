import { describe, expect, it } from 'vitest'
import { blockFaces, boundsOf, centreOn, clamp, fitCamera, panBy, project, springSettled, springStep, unproject, worldToScreen, zoomAt } from './iso'

const view = { w: 800, h: 500 }

describe('projection', () => {
  it('projects the origin to the origin and raises with z', () => {
    expect(project(0, 0)).toEqual({ x: 0, y: 0 })
    expect(project(0, 0, 40).y).toBe(-40)
  })
  it('moves +x right and down, +y left and down', () => {
    expect(project(1, 0)).toEqual({ x: 32, y: 16 })
    expect(project(0, 1)).toEqual({ x: -32, y: 16 })
  })
  it('round-trips through unproject', () => {
    const p = project(3.5, -2)
    const q = unproject(p.x, p.y)
    expect(q.x).toBeCloseTo(3.5)
    expect(q.y).toBeCloseTo(-2)
  })
})

describe('blockFaces', () => {
  it('lifts the top by the height and keeps the base at ground', () => {
    const f = blockFaces(0, 0, 1, 1, 30)
    expect(f.base[0].y - f.top[0].y).toBe(30)
    expect(f.peak.y).toBe(project(0.5, 0.5, 30).y)
  })
  it('shares edges between faces', () => {
    const f = blockFaces(2, 1, 1, 1, 20)
    expect(f.left[0]).toEqual(f.top[3])
    expect(f.right[0]).toEqual(f.top[1])
  })
})

describe('camera', () => {
  const b = boundsOf([{ x: -200, y: -50 }, { x: 200, y: 150 }])
  it('fits bounds inside the view', () => {
    const c = fitCamera(b, view, 0.9)
    const tl = worldToScreen({ x: b.minX, y: b.minY }, c, view)
    const br = worldToScreen({ x: b.maxX, y: b.maxY }, c, view)
    expect(tl.x).toBeGreaterThanOrEqual(0)
    expect(br.x).toBeLessThanOrEqual(view.w)
    expect(tl.y).toBeGreaterThanOrEqual(0)
    expect(br.y).toBeLessThanOrEqual(view.h)
  })
  it('centres a point in the free area when space is reserved', () => {
    const c = centreOn({ x: 10, y: 20 }, 1, view, { r: 300 })
    const s = worldToScreen({ x: 10, y: 20 }, c, view)
    expect(s.x).toBeCloseTo((view.w - 300) / 2)
    expect(s.y).toBeCloseTo(view.h / 2)
  })
  it('zooms about a point and keeps it fixed', () => {
    const c = { x: 0, y: 0, k: 1 }
    const at = { x: 600, y: 100 }
    const z = zoomAt(c, 2, at, view)
    expect(z.k).toBe(2)
    const before = { x: c.x + (at.x - 400) / c.k, y: c.y + (at.y - 250) / c.k }
    const after = { x: z.x + (at.x - 400) / z.k, y: z.y + (at.y - 250) / z.k }
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
  it('clamps zoom and pan', () => {
    expect(zoomAt({ x: 0, y: 0, k: 2.5 }, 10, { x: 0, y: 0 }, view).k).toBeLessThanOrEqual(2.6)
    const p = panBy({ x: 0, y: 0, k: 1 }, -5000, 0, { minX: -100, maxX: 100, minY: -100, maxY: 100 })
    expect(p.x).toBe(100)
    expect(clamp(5, 0, 3)).toBe(3)
  })
})

describe('spring', () => {
  it('settles on the target without exploding', () => {
    let s = { v: 0, vel: 0 }
    let peak = 0
    for (let i = 0; i < 120; i++) {
      s = springStep(s, 1, 1 / 60)
      peak = Math.max(peak, s.v)
    }
    expect(springSettled(s, 1)).toBe(true)
    expect(peak).toBeLessThan(1.2)
  })
})
