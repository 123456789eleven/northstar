import { describe, expect, it } from 'vitest'
import { combineDayStates, justReached, ringFill } from './ringMath'

describe('ringFill', () => {
  it('fills proportionally and reports what is left', () => {
    const r = ringFill(1200, 3000)
    expect(r.fill).toBeCloseTo(0.4)
    expect(r.left).toBe(1800)
    expect(r.reached).toBe(false)
  })
  it('caps the stroke at 1 and reports the overage', () => {
    const r = ringFill(3300, 3000)
    expect(r.fill).toBe(1)
    expect(r.over).toBe(300)
    expect(r.left).toBe(0)
    expect(r.reached).toBe(true)
  })
  it('no target means an empty ring', () => {
    expect(ringFill(500, undefined).fill).toBe(0)
    expect(ringFill(500, 0).reached).toBe(false)
  })
})

describe('justReached', () => {
  it('fires only on the crossing step', () => {
    expect(justReached(100, 150, 150)).toBe(true)
    expect(justReached(150, 200, 150)).toBe(false)
    expect(justReached(null, 200, 150)).toBe(false)
    expect(justReached(10, 20, 150)).toBe(false)
  })
})

describe('combineDayStates', () => {
  it('worst defined state wins', () => {
    expect(combineDayStates(['met', 'met'])).toBe('met')
    expect(combineDayStates(['met', 'close'])).toBe('close')
    expect(combineDayStates(['close', 'missed'])).toBe('missed')
  })
  it('ignores macros without a target; empty and none are distinct', () => {
    expect(combineDayStates(['none', 'met'])).toBe('met')
    expect(combineDayStates(['none', 'none'])).toBe('none')
    expect(combineDayStates(['empty', 'empty'])).toBe('empty')
  })
})
