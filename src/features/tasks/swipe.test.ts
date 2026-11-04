import { describe, expect, it } from 'vitest'
import { THRESHOLD, idle, pull, swipeReduce, type SwipeEvent, type SwipeState } from './swipe'

const run = (...evs: SwipeEvent[]): SwipeState => evs.reduce(swipeReduce, idle)
const down = { type: 'down', x: 100, y: 100 } as const

describe('swipe state machine', () => {
  it('stays pending under the lock distance', () => {
    expect(run(down, { type: 'move', x: 104, y: 102 }).phase).toBe('pending')
  })
  it('locks vertical drags to scroll and ignores later horizontal travel', () => {
    const s = run(down, { type: 'move', x: 103, y: 118 }, { type: 'move', x: 260, y: 120 }, { type: 'up' })
    expect(s.phase).toBe('cancelled')
    expect(run(down, { type: 'move', x: 103, y: 118 }).phase).toBe('scroll')
  })
  it('left swipes are not a complete gesture', () => {
    expect(run(down, { type: 'move', x: 60, y: 101 }).phase).toBe('scroll')
  })
  it('completes only when released past the 72px threshold', () => {
    expect(run(down, { type: 'move', x: 100 + THRESHOLD - 1, y: 101 }, { type: 'up' }).phase).toBe('cancelled')
    expect(run(down, { type: 'move', x: 100 + THRESHOLD, y: 101 }, { type: 'up' }).phase).toBe('done')
  })
  it('un-arms when the finger returns before release', () => {
    const s = run(down, { type: 'move', x: 190, y: 101 }, { type: 'move', x: 120, y: 101 })
    expect(s.phase === 'swiping' && s.armed).toBe(false)
    expect(swipeReduce(s, { type: 'up' }).phase).toBe('cancelled')
  })
  it('cancel aborts a live swipe', () => {
    expect(run(down, { type: 'move', x: 200, y: 101 }, { type: 'cancel' }).phase).toBe('cancelled')
  })
  it('pull is rubber-banded and never negative', () => {
    expect(pull(-30)).toBe(0)
    expect(pull(40)).toBe(40)
    expect(pull(THRESHOLD + 100)).toBeLessThanOrEqual(120)
    expect(pull(THRESHOLD + 10)).toBeGreaterThan(THRESHOLD)
  })
})
