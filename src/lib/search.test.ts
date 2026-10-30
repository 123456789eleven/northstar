import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db'
import { scoreFields, searchAll, snippet } from './search'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 4, 6, 9, 0))
})
afterEach(() => vi.useRealTimers())

const now = '2026-05-06T09:00:00.000Z'
const task = (title: string, extra: object = {}) => db.tasks.add({ title, priority: 2, status: 'open', recurrence: 'none', createdAt: now, ...extra })

describe('scoreFields', () => {
  it('ranks prefix > word start > substring > none', () => {
    const p = scoreFields(['Budget review'], 'bud')
    const w = scoreFields(['Monthly budget'], 'bud')
    const s = scoreFields(['Overbudgeted'], 'bud')
    expect(p).toBeGreaterThan(w)
    expect(w).toBeGreaterThan(s)
    expect(s).toBeGreaterThan(0)
    expect(scoreFields(['Groceries'], 'bud')).toBe(0)
  })
  it('requires every token and tolerates one typo in longer words', () => {
    expect(scoreFields(['Call mom Friday'], 'mom fri')).toBeGreaterThan(0)
    expect(scoreFields(['Call mom'], 'mom dad')).toBe(0)
    expect(scoreFields(['Dentist appointment'], 'dentsit')).toBe(0)
    expect(scoreFields(['Dentist appointment'], 'dentost')).toBeGreaterThan(0)
  })
})

describe('snippet', () => {
  it('returns a short window around the match, not the whole entry', () => {
    const text = 'a'.repeat(200) + ' needle ' + 'b'.repeat(200)
    const s = snippet(text, 'needle')
    expect(s).toContain('needle')
    expect(s.length).toBeLessThan(100)
  })
})

describe('searchAll', () => {
  it('returns nothing for a blank query', async () => {
    await task('anything')
    expect(await searchAll('  ')).toEqual([])
  })

  it('searches across modules and routes each hit to its page', async () => {
    await task('Plan garden layout')
    await db.goals.add({ title: 'Garden shed', area: 'personal', horizon: 'year', status: 'active', createdAt: now, milestones: [{ id: 'm1', title: 'Buy garden hose', done: false }] })
    await db.people.add({ name: 'Garden Gnome', relation: 'friend', cadenceDays: 0 })
    await db.habits.add({ name: 'Garden walk', area: 'health', perWeek: 7, createdAt: now })
    await db.journal.add({ date: '2026-05-05', text: 'Spent the afternoon in the garden, felt calm.', createdAt: now })
    await db.meals.add({ date: '2026-05-05', slot: 'lunch', name: 'Garden salad' })
    await db.learning.add({ title: 'Garden design 101', kind: 'course', status: 'active', progress: 0, createdAt: now })
    await db.transactions.add({ date: '2026-05-01', amount: -23.5, description: 'GARDEN CENTER #4', category: 'Home' })
    await db.calendar.add({ title: 'Garden club', date: '2026-05-09', allDay: true })
    await db.events.add({ at: now, area: 'personal', kind: 'x', title: 'Finished garden bed', milestone: false })
    const res = await searchAll('garden')
    const routes = Object.fromEntries(res.map((g) => [g.group, g.hits[0].to]))
    expect(routes).toMatchObject({
      Tasks: '/tasks', Goals: '/goals', People: '/people', Habits: '/habits', Journal: '/journal',
      Food: '/food', Learning: '/learning', Finance: '/finance', Calendar: '/planner', History: '/history',
    })
  })

  it('shows only a short snippet of journal text', async () => {
    const long = 'x'.repeat(300) + ' secret plan ' + 'y'.repeat(300)
    await db.journal.add({ date: '2026-05-05', text: long, createdAt: now })
    const [g] = await searchAll('secret')
    expect(g.group).toBe('Journal')
    expect(g.hits[0].secondary.length).toBeLessThan(120)
  })

  it('caps 5 per group, 30 total, and orders prefix before substring then newest first', async () => {
    for (let i = 0; i < 8; i++) await task(`call ${i}`, { due: `2026-05-0${i + 1}` })
    await task('recall everything')
    const res = await searchAll('call')
    const tasks = res.find((g) => g.group === 'Tasks')!
    expect(tasks.hits).toHaveLength(5)
    expect(tasks.hits[0].label).toBe('call 7') // newest prefix match
    expect(tasks.hits.every((h) => h.label.startsWith('call'))).toBe(true)

    for (let i = 0; i < 12; i++) {
      await db.goals.add({ title: `call goal ${i}`, area: 'personal', horizon: 'year', status: 'active', createdAt: now, milestones: [] })
      await db.habits.add({ name: `call habit ${i}`, area: 'personal', perWeek: 1, createdAt: now })
      await db.people.add({ name: `call person ${i}`, relation: 'x', cadenceDays: 0 })
      await db.meals.add({ date: '2026-05-01', slot: 'lunch', name: `call meal ${i}` })
      await db.learning.add({ title: `call course ${i}`, kind: 'course', status: 'planned', progress: 0, createdAt: now })
      await db.calendar.add({ title: `call ev ${i}`, date: '2026-05-02', allDay: true })
      await db.events.add({ at: now, area: 'personal', kind: 'x', title: `call evt ${i}`, milestone: false })
    }
    const total = (await searchAll('call')).reduce((n, g) => n + g.hits.length, 0)
    expect(total).toBeLessThanOrEqual(30)
  })
})
