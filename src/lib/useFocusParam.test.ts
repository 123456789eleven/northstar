import { describe, expect, it } from 'vitest'
import { readFocus } from './useFocusParam'

describe('readFocus', () => {
  it('reads the focus param from a query string', () => {
    expect(readFocus('?focus=12')).toBe('12')
    expect(readFocus('?tab=transactions&focus=7&month=2026-04')).toBe('7')
    expect(readFocus(new URLSearchParams({ focus: '2026-05-05' }))).toBe('2026-05-05')
  })
  it('returns null when missing or blank', () => {
    expect(readFocus('')).toBeNull()
    expect(readFocus('?focus=')).toBeNull()
    expect(readFocus('?focus=%20')).toBeNull()
  })
})
