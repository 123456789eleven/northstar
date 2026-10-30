import { describe, expect, it } from 'vitest'
import { dedupeNames, parseAmount, parseBirthday, parseTaskLines, quarterEnd, stripListMarker, yearEnd } from './setupLogic'

describe('dedupeNames', () => {
  it('drops case/space-insensitive matches of existing names and of each other', () => {
    const r = dedupeNames(['Read 20 minutes'], ['read  20 MINUTES', 'Stretch', 'stretch', '  ', 'Journal'])
    expect(r.fresh).toEqual(['Stretch', 'Journal'])
    expect(r.dupes).toEqual(['read 20 MINUTES', 'stretch'])
  })
})

describe('dates', () => {
  it('finds quarter and year end', () => {
    expect(quarterEnd(new Date(2026, 9, 30))).toBe('2026-12-31')
    expect(quarterEnd(new Date(2026, 1, 3))).toBe('2026-03-31')
    expect(quarterEnd(new Date(2026, 5, 30))).toBe('2026-06-30')
    expect(yearEnd(new Date(2026, 2, 1))).toBe('2026-12-31')
  })
})

describe('parseAmount', () => {
  it('reads money and units', () => {
    expect(parseAmount('$1,200')).toBe(1200)
    expect(parseAmount('150g')).toBe(150)
    expect(parseAmount('')).toBeUndefined()
    expect(parseAmount('0')).toBeUndefined()
    expect(parseAmount('abc')).toBeUndefined()
  })
})

describe('parseBirthday', () => {
  it('normalises to MM-DD', () => {
    expect(parseBirthday('3/14')).toBe('03-14')
    expect(parseBirthday('03-14-1990')).toBe('03-14')
    expect(parseBirthday('1990-03-14')).toBe('03-14')
    expect(parseBirthday('2/29')).toBe('02-29')
    expect(parseBirthday('2/30')).toBeUndefined()
    expect(parseBirthday('13/1')).toBeUndefined()
    expect(parseBirthday('')).toBeUndefined()
  })
})

describe('parseTaskLines', () => {
  const now = new Date(2026, 9, 30, 12) // Fri Oct 30 2026
  it('parses one task per line with capture syntax, skipping blanks and list markers', () => {
    const t = parseTaskLines('- call HR tomorrow\n\n2. pay insurance !1\n[ ] water plants every week', { now })
    expect(t.map((x) => x.title)).toEqual(['call HR', 'pay insurance', 'water plants'])
    expect(t[0].due).toBe('2026-10-31')
    expect(t[1].priority).toBe(1)
    expect(t[2].recurrence).toBe('weekly')
  })
  it('drops lines with no title left', () => {
    expect(parseTaskLines('tomorrow\n!1', { now })).toEqual([])
  })
  it('strips markers', () => {
    expect(stripListMarker('* [x] done thing')).toBe('done thing')
  })
})
