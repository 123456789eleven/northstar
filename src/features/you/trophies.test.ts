import { describe, expect, it } from 'vitest'
import type { LifeEvent } from '../../db'
import { isNewMoment, kindCounts, nextTrophies, rarity } from './trophies'

const ev = (id: number, kind: string, at: string): LifeEvent => ({ id, kind, at, area: 'personal', title: kind, milestone: true })

describe('rarity', () => {
  it('uses words by how many of the kind exist', () => {
    expect(rarity(1)).toBe('Rare')
    expect(rarity(2)).toBe('Uncommon')
    expect(rarity(4)).toBe('Uncommon')
    expect(rarity(5)).toBe('Common')
  })
  it('counts kinds', () => {
    expect(kindCounts([ev(1, 'a', '2026-01-01'), ev(2, 'a', '2026-01-02'), ev(3, 'b', '2026-01-02')]).get('a')).toBe(2)
  })
})

describe('isNewMoment', () => {
  const now = new Date('2026-11-05T12:00:00Z')
  const first = ev(1, 'goal.done', '2026-11-03T10:00:00Z')
  const second = ev(2, 'goal.done', '2026-11-04T10:00:00Z')
  it('flags only the first of a kind within 7 days', () => {
    expect(isNewMoment(first, [first, second], now)).toBe(true)
    expect(isNewMoment(second, [first, second], now)).toBe(false)
  })
  it('expires after 7 days', () => {
    expect(isNewMoment(first, [first], new Date('2026-11-12T12:00:00Z'))).toBe(false)
  })
})

describe('nextTrophies', () => {
  it('derives the next rungs and sorts closest first', () => {
    const t = nextTrophies({ workouts: 8, wins: 0, tasksDone: 40, reviews: 3 })
    expect(t.map((x) => x.id)).toEqual(['workouts', 'tasks', 'reviews', 'wins'])
    expect(t[0].title).toBe('10 workouts logged')
    expect(t.find((x) => x.id === 'wins')!.title).toBe('Your first career win')
  })
  it('adds the next weight checkpoint', () => {
    const t = nextTrophies({ workouts: 0, wins: 0, tasksDone: 0, reviews: 0, weight: { start: 150, target: 130, current: 144 } })
    const w = t.find((x) => x.id === 'weight')!
    expect(w.title).toBe('Weight checkpoint: 140 lb')
    expect(w.progress).toBeCloseTo(0.2, 5)
  })
  it('stops at the top rung and caps the list', () => {
    expect(nextTrophies({ workouts: 100, wins: 100, tasksDone: 500, reviews: 52 })).toEqual([])
    expect(nextTrophies({ workouts: 0, wins: 0, tasksDone: 0, reviews: 0, weight: { start: 150, target: 130, current: 150 } }, 3)).toHaveLength(3)
  })
})
