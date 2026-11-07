import { describe, expect, it } from 'vitest'
import { paceNote, seasonOf, storyOrder } from './season'

describe('seasonOf', () => {
  it('names the quarter and counts days left', () => {
    expect(seasonOf('2026-11-05')).toMatchObject({ name: 'Q4 2026', start: '2026-10-01', end: '2026-12-31', daysLeft: 56, totalDays: 92 })
  })
  it('handles the year boundary', () => {
    expect(seasonOf('2026-12-31')).toMatchObject({ name: 'Q4 2026', daysLeft: 0, elapsed: 1 })
    expect(seasonOf('2027-01-01')).toMatchObject({ name: 'Q1 2027', start: '2027-01-01', end: '2027-03-31', daysLeft: 89 })
  })
  it('handles leap years', () => {
    expect(seasonOf('2028-01-01')).toMatchObject({ totalDays: 91, daysLeft: 90 })
  })
})

describe('storyOrder', () => {
  it('always opens with the summary and closes with next week, five unique cards', () => {
    const o = storyOrder({ wins: false, slipped: false, numbers: true })
    expect(o[0]).toBe('summary')
    expect(o[4]).toBe('next')
    expect(new Set(o).size).toBe(5)
  })
  it('puts cards with content first', () => {
    expect(storyOrder({ wins: false, slipped: true, numbers: true })).toEqual(['summary', 'slipped', 'numbers', 'wins', 'next'])
    expect(storyOrder({ wins: true, slipped: true, numbers: true })).toEqual(['summary', 'wins', 'slipped', 'numbers', 'next'])
  })
})

describe('paceNote', () => {
  it('names the gap in plain words', () => {
    expect(paceNote(1, 0.5, 40)).toBe('Season goal met.')
    expect(paceNote(0.5, 0.52, 40)).toBe('On pace: 50% done with 52% of the season gone.')
    expect(paceNote(0.2, 0.6, 1)).toBe('Behind pace: 20% done with 60% of the season gone. 1 day left.')
  })
})
