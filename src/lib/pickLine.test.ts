import { describe, expect, it } from 'vitest'
import { pickLine } from './pickLine'

const L = ['a', 'b', 'c', 'd'] as const

describe('pickLine', () => {
  it('is deterministic for the same key and seed', () => {
    expect(pickLine('task', 3, L)).toBe(pickLine('task', 3, L))
  })
  it('never repeats on consecutive seeds', () => {
    for (let s = 0; s < 40; s++) expect(pickLine('task', s, L)).not.toBe(pickLine('task', s + 1, L))
  })
  it('visits every line across a full cycle', () => {
    expect(new Set([0, 1, 2, 3].map((s) => pickLine('k', s, L)))).toEqual(new Set(L))
  })
  it('handles one line, negative and fractional seeds', () => {
    expect(pickLine('x', 9, ['only'])).toBe('only')
    expect(L).toContain(pickLine('x', -7.9, L))
  })
  it('throws on an empty list', () => {
    expect(() => pickLine('x', 1, [])).toThrow()
  })
})
