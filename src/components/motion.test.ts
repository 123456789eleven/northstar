import { describe, expect, it } from 'vitest'
import { formatNumeric, parseNumeric } from './motion'

describe('parseNumeric (CountUp input)', () => {
  it('reads plain numbers and money with grouping and decimals', () => {
    expect(parseNumeric(21)).toMatchObject({ n: 21, decimals: 0, prefix: '', suffix: '' })
    expect(parseNumeric('$1,234.50')).toMatchObject({ n: 1234.5, decimals: 2, grouped: true, prefix: '$' })
    expect(parseNumeric('1,620 cal')).toMatchObject({ n: 1620, suffix: ' cal', grouped: true })
    expect(parseNumeric('62%')).toMatchObject({ n: 62, suffix: '%' })
  })

  it('keeps the sign of negative money', () => {
    const p = parseNumeric('-$45.17')!
    expect(p).toMatchObject({ sign: '-', prefix: '$', n: 45.17 })
    expect(formatNumeric(p, 45.17)).toBe('-$45.17')
    expect(formatNumeric(p, 0)).toBe('$0.00')
  })

  it('refuses values with zero or several numbers, or non-text', () => {
    expect(parseNumeric('—')).toBeNull()
    expect(parseNumeric('1h 10m')).toBeNull()
    expect(parseNumeric('4 of 5')).toBeNull()
    expect(parseNumeric(null)).toBeNull()
    expect(parseNumeric({})).toBeNull()
  })

  it('formats intermediate frames with the same shape as the final value', () => {
    const p = parseNumeric('$1,234.50')!
    expect(formatNumeric(p, 617.25)).toBe('$617.25')
    expect(formatNumeric(p, 1234.5)).toBe('$1,234.50')
    const lb = parseNumeric('136.4 lb')!
    expect(formatNumeric(lb, 68.2)).toBe('68.2 lb')
  })
})
