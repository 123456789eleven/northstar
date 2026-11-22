import { describe, expect, it } from 'vitest'
import { advance, addSystem, Spring, SPRING } from './liquidSpring'
import { edgePresets, stretchFrame } from './useStretch'
import { dropFrame, dropStart } from './droplet'
import { squash } from './useThumb'
import { tiltFor } from './useTilt'
import { stackOffsets, trimStack } from './toastStack'

const run = (s: Spring, ms: number) => {
  const remove = addSystem({ springs: [s], render: () => {} })
  for (let t = 0; t < ms; t += 1000 / 60) advance(1 / 60)
  remove()
}

describe('spring', () => {
  it('settles on the target within 700 ms for every preset', () => {
    for (const p of [SPRING.snappy, SPRING.smooth, SPRING.gentle]) {
      const s = new Spring(0, p, 0.05)
      s.to(300)
      run(s, 700)
      expect(Math.abs(s.x - 300)).toBeLessThan(1)
    }
  })
  it('snappy overshoots once, gentle barely', () => {
    const snappy = new Spring(0, SPRING.snappy), gentle = new Spring(0, SPRING.gentle)
    let maxS = 0, maxG = 0
    snappy.to(100); gentle.to(100)
    const remove = addSystem({ springs: [snappy, gentle], render: () => { maxS = Math.max(maxS, snappy.x); maxG = Math.max(maxG, gentle.x) } })
    for (let i = 0; i < 60; i++) advance(1 / 60)
    remove()
    expect(maxS).toBeGreaterThan(103)
    expect(maxG).toBeLessThan(101)
  })
  it('retargeting keeps velocity (interruptible)', () => {
    const s = new Spring(0, SPRING.smooth)
    s.to(100)
    run(s, 100)
    const v = s.v
    s.to(-100)
    expect(s.v).toBe(v)
  })
})

describe('stretch indicator', () => {
  it('places caps at both ends and scales the 100px middle between them', () => {
    const f = stretchFrame('x', 10, 110, 4, 17)
    expect(f.capA).toBe('translate3d(10px,4px,0)')
    expect(f.capB).toBe('translate3d(76px,4px,0)')
    expect(f.mid).toBe('translate3d(27px,4px,0) scaleX(0.66)')
  })
  it('never inverts when the edges cross', () => {
    const f = stretchFrame('y', 50, 40, 6, 10)
    expect(f.mid).toBe('translate3d(6px,60px,0) scaleY(0)')
    expect(f.capB).toBe('translate3d(6px,50px,0)')
  })
  it('the edge in the direction of travel is snappy, the trailing edge gentle', () => {
    expect(edgePresets(0, 200)).toEqual({ a: SPRING.gentle, b: SPRING.snappy })
    expect(edgePresets(200, 0)).toEqual({ a: SPRING.snappy, b: SPRING.gentle })
  })
})

describe('droplet sheet', () => {
  const sheet = { left: 0, top: 300, width: 390, height: 540 }
  it('starts clipped to a narrow trigger, at its place', () => {
    const d = dropStart(sheet, { left: 250, top: 700, width: 120, height: 44 })
    expect(d).toMatchObject({ l: 135, r: 135, b: 496, ty: 400, rad: 22 })
    expect(d.tx).toBe(250 - 135)
    const f = dropFrame(d, 0, 0, 20)
    expect(f.clip).toBe('inset(0px 135px 496px 135px round 22px)')
    expect(f.content).toBe(0)
  })
  it('a trigger wider than the sheet just rises', () => {
    const d = dropStart(sheet, { left: 0, top: 600, width: 390, height: 48 })
    expect(d.tx).toBe(0)
    expect(d.l).toBe(0)
  })
  it('lands on the sheet with no clip, transform or hidden content', () => {
    const f = dropFrame(dropStart(sheet, { left: 250, top: 700, width: 120, height: 44 }), 1, 1, 20)
    expect(f.clip).toBe('inset(0px 0px 0px 0px round 20px)')
    expect(f.transform).toBe('translate3d(0px,0px,0) scale(1,1)')
    expect(f.content).toBe(1)
  })
})

describe('toast stack', () => {
  it('stacks from the bottom with a 10px gap', () => expect(stackOffsets([44, 60, 44])).toEqual([0, 54, 124]))
  it('keeps three live toasts and lets the oldest go', () => {
    const l = trimStack([4, 3, 2, 1].map((id) => ({ id, dying: false })))
    expect(l.map((t) => t.dying)).toEqual([false, false, false, true])
  })
})

describe('thumb and tilt', () => {
  it('squash keeps volume and is capped', () => {
    expect(squash(0.5)).toEqual({ sx: 1.18, sy: 1 - 0.18 * 0.45 })
    expect(squash(0)).toEqual({ sx: 1, sy: 1 })
  })
  it('tilts at most 3 degrees', () => {
    expect(tiltFor(0.5, -0.5)).toEqual({ ry: 3, rx: 3 })
    expect(tiltFor(2, 0).ry).toBe(3)
  })
})
