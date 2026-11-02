import { describe, expect, it } from 'vitest'
import { formatDelta, percentChange, trendAria, trendDirection, trendTone } from './trend'

describe('percentChange', () => {
  it('computes and handles missing or zero bases', () => {
    expect(percentChange(110, 100)).toBeCloseTo(10)
    expect(percentChange(50, 100)).toBeCloseTo(-50)
    expect(percentChange(100, 0)).toBeNull()
    expect(percentChange(undefined, 5)).toBeNull()
    expect(percentChange(5, null)).toBeNull()
    expect(percentChange(NaN, 5)).toBeNull()
    expect(percentChange(-50, -100)).toBeCloseTo(50)
  })
})

describe('direction and tone', () => {
  it('treats rounding to zero as flat', () => {
    expect(trendDirection(0.04)).toBe('flat')
    expect(trendDirection(0)).toBe('flat')
    expect(trendDirection(4.2)).toBe('up')
    expect(trendDirection(-4.2)).toBe('down')
  })
  it('maps good direction to tone', () => {
    expect(trendTone('up', 'up')).toBe('good')
    expect(trendTone('up', 'down')).toBe('warn')
    expect(trendTone('down', 'down')).toBe('good')
    expect(trendTone('up', 'neutral')).toBe('neutral')
    expect(trendTone('flat', 'up')).toBe('neutral')
    expect(trendTone('up')).toBe('neutral')
  })
})

describe('formatDelta', () => {
  it('signs, rounds and caps', () => {
    expect(formatDelta(4.23)).toBe('+4.2%')
    expect(formatDelta(-12.4)).toBe('−12%')
    expect(formatDelta(0)).toBe('0%')
    expect(formatDelta(5000)).toBe('+999%+')
    expect(formatDelta(0.6, ' lb')).toBe('+0.6 lb')
    expect(formatDelta(-2, ' pts')).toBe('−2 pts')
    expect(formatDelta(NaN)).toBe('')
    expect(formatDelta(Infinity)).toBe('')
  })
})

describe('trendAria', () => {
  it('reads naturally', () => {
    expect(trendAria({ delta: 4.2, label: 'vs last month' })).toBe('up 4.2 percent versus last month')
    expect(trendAria({ delta: -3, unit: ' lb', label: 'vs prior week' })).toBe('down 3 lb versus prior week')
    expect(trendAria({ delta: 0, label: 'vs last month' })).toBe('no change versus last month')
    expect(trendAria({ delta: 2 })).toBe('up 2.0 percent')
    expect(trendAria({ delta: 1500 })).toBe('up more than 999 percent')
  })
})
