import { describe, expect, it } from 'vitest'
import { behindMessage, bulkStaples, dayState, leftToday, parseQuickEntry, parseTemplates, rankSuggestions, scaleItem, serializeTemplates, suggestTargets, weekSummary } from './foodLogic'

describe('parseQuickEntry', () => {
  it('parses trailing calories', () => expect(parseQuickEntry('3 eggs 210')).toEqual({ name: '3 eggs', calories: 210, protein: undefined }))
  it('parses cal and p suffixes', () => expect(parseQuickEntry('shake 600cal 40p')).toEqual({ name: 'shake', calories: 600, protein: 40 }))
  it('parses bare calories plus g protein, commas', () => expect(parseQuickEntry('chicken rice, 650, 45g protein')).toEqual({ name: 'chicken rice', calories: 650, protein: 45 }))
  it('keeps plain names and leading quantities', () => {
    expect(parseQuickEntry('3 eggs')).toEqual({ name: '3 eggs', calories: undefined, protein: undefined })
    expect(parseQuickEntry('banana')).toEqual({ name: 'banana', calories: undefined, protein: undefined })
  })
  it('does not treat a small trailing number as calories', () => expect(parseQuickEntry('eggs 3').calories).toBeUndefined())
})

describe('left today', () => {
  it('computes remaining and clamps at 0', () => {
    expect(leftToday({ calories: 2500, protein: 130 }, { calories: 1400, protein: 140 })).toMatchObject({ kcal: 1100, protein: 0 })
    expect(leftToday({}, { calories: 1, protein: 1 })).toBeNull()
  })
  it('says behind plainly late in the day only', () => {
    expect(behindMessage({ calories: 2500 }, { calories: 1400, protein: 0 }, 17)).toBe('1,100 kcal to go, 2 meals of 550')
    expect(behindMessage({ calories: 2500 }, { calories: 1400, protein: 0 }, 9)).toBeNull()
    expect(behindMessage({ calories: 2500 }, { calories: 2400, protein: 0 }, 17)).toBeNull()
  })
  it('suggests targets as an estimate', () => expect(suggestTargets(135)).toEqual({ calories: 2430, protein: 108 }))
})

describe('rankSuggestions', () => {
  const c = [
    { name: 'Chicken', calories: 330, protein: 62 },
    { name: 'Olive oil', calories: 120, protein: 0 },
    { name: 'Tiny', calories: 40, protein: 8 },
    { name: 'Huge feast', calories: 2500, protein: 100 },
  ]
  it('is deterministic, skips tiny items and prefers protein-dense fits', () => {
    const r = rankSuggestions({ kcal: 800, protein: 80 }, c)
    expect(r).toHaveLength(3)
    expect(r[0].name).toBe('Chicken')
    expect(r.find((x) => x.name === 'Tiny')).toBeUndefined()
    expect(rankSuggestions({ kcal: 800, protein: 80 }, c)).toEqual(r)
  })
  it('returns nothing when done and respects limit', () => {
    expect(rankSuggestions({ kcal: 0, protein: 0 }, c)).toEqual([])
    expect(rankSuggestions({ kcal: 800, protein: 80 }, c, 1)).toHaveLength(1)
  })
  it('curated staples exist', () => expect(bulkStaples().length).toBeGreaterThan(15))
})

describe('week', () => {
  it('dayState thresholds', () => {
    expect(dayState(95, 100, true)).toBe('met')
    expect(dayState(80, 100, true)).toBe('close')
    expect(dayState(79, 100, true)).toBe('missed')
    expect(dayState(0, 100, false)).toBe('empty')
    expect(dayState(5, undefined, true)).toBe('none')
  })
  it('weekSummary averages logged days and counts hits', () => {
    const days = [
      { date: 'a', logged: true, calories: 2500, protein: 130 },
      { date: 'b', logged: true, calories: 2000, protein: 100 },
      { date: 'c', logged: false, calories: 0, protein: 0 },
    ]
    expect(weekSummary(days, { calories: 2500, protein: 130 })).toEqual({ loggedDays: 2, avgCalories: 2250, avgProtein: 115, calHits: 1, proteinHits: 1 })
  })
})

describe('templates and scaling', () => {
  it('round-trips and rejects junk', () => {
    const t = [{ id: 'x', name: 'Usual', items: [{ name: 'Oats', calories: 300 }] }]
    expect(parseTemplates(serializeTemplates(t))[0]).toMatchObject({ id: 'x', name: 'Usual' })
    expect(parseTemplates(null)).toEqual([])
    expect(parseTemplates({ v: 2, items: [] })).toEqual([])
    expect(parseTemplates({ v: 1, items: [{ id: 1 }] })).toEqual([])
  })
  it('scaleItem multiplies', () => expect(scaleItem({ name: 'Shake', calories: 300, protein: 25 }, 2)).toEqual({ name: 'Shake x2', calories: 600, protein: 50 }))
})
