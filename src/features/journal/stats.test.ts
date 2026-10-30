import { describe, expect, it } from 'vitest'
import type { JournalEntry } from '../../db'
import { extractTags, groupByMonth, matchesSearch, moodSeries, onThisDay, wordCount, wordStreak } from './stats'

const e = (date: string, text = 'one two three four five six seven eight nine ten', extra: Partial<JournalEntry> = {}): JournalEntry => ({ date, text, createdAt: '', ...extra })

describe('journal stats', () => {
  it('counts words and extracts unique lowercase tags', () => {
    expect(wordCount('  a  b\nc ')).toBe(3)
    expect(wordCount('')).toBe(0)
    expect(extractTags('Good day #Work and #work #side-project, not a#tag')).toEqual(['work', 'side-project'])
  })

  it('word streak needs enough words and survives an unwritten today', () => {
    const list = [e('2026-10-27'), e('2026-10-28')]
    expect(wordStreak(list, '2026-10-29')).toBe(2)
    expect(wordStreak([...list, e('2026-10-29', 'short')], '2026-10-29')).toBe(2)
    expect(wordStreak([e('2026-10-25')], '2026-10-29')).toBe(0)
  })

  it('mood series covers 90 days with null gaps', () => {
    const s = moodSeries([e('2026-10-29', 'x', { mood: 4, energy: 2 })], '2026-10-29')
    expect(s).toHaveLength(90)
    expect(s[89]).toEqual({ date: '2026-10-29', mood: 4, energy: 2 })
    expect(s[88].mood).toBeNull()
  })

  it('finds entries from this date in earlier years', () => {
    const r = onThisDay([e('2025-10-29'), e('2024-10-29'), e('2025-10-28'), e('2026-10-29')], '2026-10-29')
    expect(r.map((x) => x.date)).toEqual(['2025-10-29', '2024-10-29'])
  })

  it('searches text and tags', () => {
    expect(matchesSearch(e('2026-10-01', 'Walked by the river'), 'RIVER')).toBe(true)
    expect(matchesSearch(e('2026-10-01', 'x', { tags: ['work'] }), '#work')).toBe(true)
    expect(matchesSearch(e('2026-10-01', 'x'), 'zzz')).toBe(false)
  })

  it('groups newest-first by month', () => {
    const g = groupByMonth([e('2026-09-30'), e('2026-10-02'), e('2026-10-20')])
    expect(g.map((x) => [x.month, x.entries.map((y) => y.date)])).toEqual([
      ['2026-10', ['2026-10-20', '2026-10-02']],
      ['2026-09', ['2026-09-30']],
    ])
  })
})
