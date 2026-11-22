import { describe, expect, it } from 'vitest'
import { filterMarkup, LENS_PRESETS, mapPixels, rimPixels, sdf } from './lens'

const px = (D: Uint8ClampedArray, w: number, x: number, y: number) => Array.from(D.slice((y * w + x) * 4, (y * w + x) * 4 + 4))

describe('lens geometry', () => {
  it('sdf is negative inside, positive outside, with an outward normal', () => {
    expect(sdf(50, 25, 100, 50, 10).d).toBeLessThan(0)
    expect(sdf(-5, 25, 100, 50, 10).d).toBeGreaterThan(0)
    const left = sdf(1, 25, 100, 50, 10)
    expect(left.nx).toBe(-1)
    expect(left.ny).toBe(0)
  })

  it('map is neutral in the body and pushes inward at the edge', () => {
    const w = 100, h = 50, D = mapPixels(w, h, 12, 20, 0)
    expect(px(D, w, 50, 25)).toEqual([128, 128, 128, 255])
    // left edge samples inward (to the right): R above 128
    expect(px(D, w, 0, 25)[0]).toBeGreaterThan(200)
    // bottom edge samples upward: G below 128
    expect(px(D, w, 50, h - 1)[1]).toBeLessThan(60)
  })

  it('rim light is brightest on the top-left, nothing in the body', () => {
    const w = 120, h = 60, D = rimPixels(w, h, 16, 24, -0.55, -0.83)
    expect(px(D, w, 60, 30)[3]).toBe(0)
    expect(px(D, w, 60, 0)[3]).toBeGreaterThan(px(D, w, 60, h - 1)[3])
  })

  it('filter markup never sets a region and drops dispersion when asked', () => {
    const withDisp = filterMarkup('data:x', 100, 50, LENS_PRESETS.sheet, true)
    const without = filterMarkup('data:x', 100, 50, LENS_PRESETS.sheet, false)
    expect(withDisp.match(/feDisplacementMap/g)).toHaveLength(3)
    expect(without.match(/feDisplacementMap/g)).toHaveLength(1)
    expect(withDisp).not.toMatch(/filterUnits/)
  })
})
