import { afterEach, describe, expect, it } from 'vitest'
import { addSystem, runSprings, setReducedMotionForTest, Spring, springLinear, SPRINGS } from './spring'

afterEach(() => setReducedMotionForTest(null))

const settle = (ms: number) => { for (let t = 0; t < ms; t += 1000 / 60) runSprings(1 / 60) }

describe('spring', () => {
  it('overshoots on snappy and comes to rest on target', () => {
    setReducedMotionForTest(false)
    const s = new Spring(0, SPRINGS.snappy, 0.001)
    let peak = 0
    const off = addSystem({ springs: [s], render: () => { peak = Math.max(peak, s.x) } })
    s.to(1)
    settle(1000)
    off()
    expect(peak).toBeGreaterThan(1.02)
    expect(s.x).toBe(1)
    expect(s.rest).toBe(true)
  })

  it('retargeting keeps velocity (interruptible)', () => {
    setReducedMotionForTest(false)
    const s = new Spring(0, SPRINGS.smooth, 0.001)
    const off = addSystem({ springs: [s], render: () => {} })
    s.to(100)
    settle(80)
    const v = s.v
    expect(v).toBeGreaterThan(0)
    s.to(0)
    expect(s.v).toBe(v)
    off()
  })

  it('snaps under reduced motion', () => {
    setReducedMotionForTest(true)
    const s = new Spring(0)
    s.to(5)
    expect(s.x).toBe(5)
    expect(s.v).toBe(0)
  })

  it('runSprings reports idle once everything rests (the rAF loop stops)', () => {
    setReducedMotionForTest(false)
    const s = new Spring(0, SPRINGS.press, 0.001)
    const off = addSystem({ springs: [s], render: () => {} })
    s.to(1)
    expect(runSprings(1 / 60)).toBe(true)
    settle(1500)
    expect(runSprings(1 / 60)).toBe(false)
    off()
  })

  it('springLinear matches the snappy token (overshoot near 40%, about 440ms)', () => {
    const { easing, ms } = springLinear(SPRINGS.snappy)
    const stops = easing.slice(7, -1).split(', ')
    expect(stops).toHaveLength(11)
    expect(parseFloat(stops[4])).toBeGreaterThan(1.03)
    expect(ms).toBeGreaterThan(380)
    expect(ms).toBeLessThan(520)
  })
})
