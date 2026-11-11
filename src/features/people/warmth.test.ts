import { describe, expect, it } from 'vitest'
import type { Person } from '../../db'
import { circleWarmth, formGuide, isWarm, personWarmth, records } from './warmth'
import { contactWords, reachLine, starterFor, tagsOf } from './starter'

const NOW = '2026-06-15' // a Monday
const P = (id: number, over: Partial<Person> = {}): Person => ({ id, name: `Pal${id} Test`, relation: 'friend', cadenceDays: 14, ...over })

describe('warmth', () => {
  it('person warmth fades from 1 to 0 over twice the cadence', () => {
    expect(personWarmth(P(1, { lastContact: NOW }), NOW)).toBe(1)
    expect(personWarmth(P(1, { lastContact: '2026-06-01' }), NOW)).toBe(0.5)
    expect(personWarmth(P(1, { lastContact: '2026-01-01' }), NOW)).toBe(0)
    expect(personWarmth(P(1), NOW)).toBe(0)
    expect(personWarmth(P(1, { cadenceDays: 0 }), NOW)).toBeNull()
  })
  it('isWarm is true until the cadence runs out', () => {
    expect(isWarm(P(1, { lastContact: '2026-06-02' }), NOW)).toBe(true)
    expect(isWarm(P(1, { lastContact: '2026-06-01' }), NOW)).toBe(false)
  })
  it('circle warmth averages tracked people and reports its inputs', () => {
    const c = circleWarmth([P(1, { lastContact: NOW }), P(2, { lastContact: '2026-06-01' }), P(3, { cadenceDays: 0 })], NOW)
    expect(c).toEqual({ pct: 75, tracked: 2, warm: 1, cooling: 1, untracked: 1 })
    expect(circleWarmth([P(1, { cadenceDays: 0 })], NOW).pct).toBeNull()
  })
})

describe('formGuide', () => {
  const people = [P(1), P(2), P(3), P(4)]
  it('marks weeks W, D or L by how many tracked people you reached', () => {
    const g = formGuide(people, [
      { personId: 1, date: '2026-06-15' }, // this week: 1 of 4 = D
      { personId: 1, date: '2026-06-09' }, { personId: 2, date: '2026-06-10' }, // last week: 2 of 4 = W
    ], NOW)
    expect(g).toHaveLength(8)
    expect(g[7]).toMatchObject({ mark: 'D', reached: 1, current: true })
    expect(g[6]).toMatchObject({ mark: 'W', reached: 2 })
    expect(g[0]).toMatchObject({ mark: 'L', reached: 0 })
  })
  it('is empty when nobody is tracked', () => {
    expect(formGuide([P(1, { cadenceDays: 0 })], [], NOW)).toEqual([])
  })
})

describe('records', () => {
  it('finds the oldest reconnect, busiest month and the longest everyone-warm stretch', () => {
    const people = [P(1, { cadenceDays: 14, lastContact: '2026-06-10' }), P(2, { cadenceDays: 30, lastContact: '2026-06-12' })]
    const r = records(people, [
      { personId: 1, date: '2026-01-01' }, { personId: 1, date: '2026-01-10' }, { personId: 1, date: '2026-06-10' },
      { personId: 2, date: '2026-01-05' }, { personId: 2, date: '2026-06-12' },
    ], NOW)
    expect(r.oldestReconnect).toEqual({ name: 'Pal2 Test', days: 158, date: '2026-06-12' })
    expect(r.busiestMonth).toEqual({ count: 2, month: '2026-06' })
    expect(r.warmStretch).toMatchObject({ days: 23, start: '2026-01-01' })
  })
  it('returns nulls with no history', () => {
    expect(records([P(1)], [], NOW)).toEqual({ warmStretch: null, busiestMonth: null, oldestReconnect: null })
  })
})

describe('starters', () => {
  it('is deterministic for the same person and varies with the inputs', () => {
    const p = P(5, { lastContact: '2026-06-08' })
    expect(starterFor(p, NOW)).toBe(starterFor(p, NOW))
    const variants = new Set(Array.from({ length: 12 }, (_, i) => starterFor(P(i + 1, { lastContact: '2026-06-08' }), NOW)))
    expect(variants.size).toBeGreaterThan(3)
  })
  it('leads with a birthday, then a long gap, then notes', () => {
    expect(starterFor(P(1, { name: 'Aisha K', birthday: '06-17', lastContact: '2026-06-01' }), NOW)).toMatch(/birthday/i)
    expect(starterFor(P(1, { name: 'Aisha K', lastContact: '2026-04-10', notes: 'Training for a marathon' }), NOW)).toMatch(/56|long gap|days/)
    expect(starterFor(P(1, { name: 'Aisha K', lastContact: '2026-06-01', notes: 'Training for a marathon' }), NOW)).toMatch(/training for a marathon/i)
  })
  it('uses shared tags and handles a never-contacted person', () => {
    const a = P(1, { name: 'Aisha K', lastContact: '2026-06-05', notes: '#climbing' })
    const b = P(2, { name: 'Ben R', notes: '#climbing' })
    expect(starterFor(a, NOW, [a, b])).toMatch(/#climbing/)
    expect(starterFor(P(3, { name: 'Cy' }), NOW)).toMatch(/Cy/)
    expect(tagsOf(a)).toEqual(['#climbing'])
  })
  it('plain-words lines never guilt and carry the real number', () => {
    expect(contactWords({ lastContact: NOW }, NOW)).toBe('You spoke today')
    expect(contactWords({ lastContact: '2026-04-24' }, NOW)).toBe('You spoke 52 days ago')
    expect(reachLine({ name: 'Aisha K', cadenceDays: 14, lastContact: '2026-04-24' }, NOW)).toBe('Aisha has been waiting 52 days. Bring them back into the game.')
    expect(reachLine({ name: 'Ben R', cadenceDays: 14, lastContact: '2026-06-10' }, NOW)).toBe('Ben is up in 9 days. Get ahead of it.')
  })
})
