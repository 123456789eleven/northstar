import { describe, expect, it } from 'vitest'
import type { JournalEntry } from '../../db'
import { highlight, lookback, monthCells, shadeLevel, shiftMonth, snippet, tagCounts, tagSuggestions, toggleTag } from './insights'

const e = (date: string, text: string): JournalEntry => ({ date, text, createdAt: '' })

describe('month map', () => {
  it('shades by share of goal', () => {
    expect([0, 10, 40, 100, 150, 400].map((w) => shadeLevel(w, 150))).toEqual([0, 1, 2, 3, 4, 4])
  })
  it('pads Monday-first and counts days', () => {
    const cells = monthCells('2026-11', [e('2026-11-03', 'one two three')])
    expect(cells.filter((c) => c.date === null)).toHaveLength(6) // 1 Nov 2026 is a Sunday
    expect(cells.filter((c) => c.date)).toHaveLength(30)
    expect(cells.find((c) => c.date === '2026-11-03')).toMatchObject({ words: 3, level: 1 })
  })
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('tags', () => {
  it('counts and suggests', () => {
    expect(tagCounts([{ tags: ['a', 'b'] }, { tags: ['b'] }])).toEqual([{ tag: 'b', n: 2 }, { tag: 'a', n: 1 }])
    expect(tagSuggestions([{ tag: 'career' }, { tag: 'run' }])).toEqual(['career', 'training', 'money', 'people', 'run'])
  })
  it('toggles on a trailing tag line', () => {
    let t = toggleTag('good day', 'career')
    expect(t).toBe('good day\n\n#career')
    t = toggleTag(t, 'money')
    expect(t).toBe('good day\n\n#career #money')
    t = toggleTag(t, 'career')
    expect(t).toBe('good day\n\n#money')
    expect(toggleTag(t, 'money')).toBe('good day')
  })
})

describe('search', () => {
  it('highlights case-insensitively', () => {
    expect(highlight('Ran 5k, ran more', 'RAN')).toEqual([
      { text: 'Ran', hit: true }, { text: ' 5k, ', hit: false }, { text: 'ran', hit: true }, { text: ' more', hit: false },
    ])
    expect(highlight('abc', '')).toEqual([{ text: 'abc', hit: false }])
  })
  it('builds a snippet around the match', () => {
    const long = `${'word '.repeat(40)}needle ${'tail '.repeat(40)}`
    const s = snippet(long, 'needle')
    expect(s).toContain('needle')
    expect(s.length).toBeLessThan(160)
    expect(snippet('first line\nsecond', '')).toBe('first line')
  })
})

describe('lookback', () => {
  it('finds same day in earlier months and years', () => {
    const rows = [e('2026-10-15', 'a'), e('2026-08-15', 'b'), e('2025-11-15', 'c'), e('2026-10-16', 'x'), e('2026-07-15', '  ')]
    expect(lookback(rows, '2026-11-15').map((l) => l.label)).toEqual(['1 month ago', '3 months ago', '1 year ago'])
  })
  it('skips months without that day', () => {
    expect(lookback([e('2026-02-28', 'x')], '2026-03-31')).toEqual([])
  })
})
