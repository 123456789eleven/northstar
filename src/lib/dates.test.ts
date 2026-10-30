import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, monthKey, parseISODate, startOfWeek, toISODate } from './dates'

describe('dates', () => {
  it('round-trips ISO dates through local Date', () => {
    expect(toISODate(parseISODate('2026-03-08'))).toBe('2026-03-08')
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })

  it('addDays crosses month, year and leap boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-05-10', 0)).toBe('2026-05-10')
  })

  it('addDays and daysBetween are DST-safe (US spring forward 2026-03-08, fall back 2026-11-01)', () => {
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02')
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('daysBetween is signed', () => {
    expect(daysBetween('2026-05-10', '2026-05-03')).toBe(-7)
    expect(daysBetween('2026-05-10', '2026-05-10')).toBe(0)
  })

  it('startOfWeek returns Monday', () => {
    expect(startOfWeek('2026-05-04')).toBe('2026-05-04') // Monday
    expect(startOfWeek('2026-05-10')).toBe('2026-05-04') // Sunday belongs to the prior Monday
    expect(startOfWeek('2026-05-08')).toBe('2026-05-04') // Friday
    expect(startOfWeek('2026-01-01')).toBe('2025-12-29') // crosses year
  })

  it('monthKey slices YYYY-MM', () => {
    expect(monthKey('2026-07-19')).toBe('2026-07')
  })
})
