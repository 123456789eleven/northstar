import { describe, expect, it } from 'vitest'
import { db, type Review } from '../../db'
import { avgRating, reviewStreak, weekDigest } from './summary'

// Week under review: Monday 2026-06-08 .. Sunday 2026-06-14 (local time).
const WEEK = '2026-06-08'
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).toISOString()
const review = (weekOf: string, ratings: Review['ratings'] = {}): Review => ({ weekOf, wins: '', struggles: '', focusNext: '', ratings, createdAt: '2026-01-01T00:00:00Z' })

describe('weekDigest', () => {
  it('empty database -> zeros', async () => {
    expect(await weekDigest(WEEK)).toEqual({
      tasksDone: 0, goalsCompleted: 0, goalUpdates: 0, spent: 0, spentPrev: 0, hasMoney: false,
      mealDays: 0, studyMinutes: 0, peopleContacted: 0, milestones: [], eventCount: 0,
    })
  })

  it('counts only items inside the week, with inclusive start and exclusive next-Monday', async () => {
    const base = { title: 't', priority: 2 as const, status: 'done' as const, recurrence: 'none' as const, createdAt: '' }
    await db.tasks.bulkAdd([
      { ...base, doneAt: at(2026, 6, 8, 0) }, // Monday 00:00 -> in
      { ...base, doneAt: at(2026, 6, 14, 23) }, // Sunday night -> in
      { ...base, doneAt: at(2026, 6, 15, 0) }, // next Monday 00:00 -> out
      { ...base, doneAt: at(2026, 6, 7, 23) }, // previous Sunday -> out
    ])
    expect((await weekDigest(WEEK)).tasksDone).toBe(2)
  })

  it('goals completed, goal updates, milestones and event counts', async () => {
    const g = { area: 'career' as const, horizon: 'year' as const, status: 'done' as const, milestones: [], createdAt: '' }
    await db.goals.bulkAdd([
      { ...g, title: 'in', completedAt: at(2026, 6, 10) },
      { ...g, title: 'out', completedAt: at(2026, 6, 20) },
      { ...g, title: 'never', status: 'active' },
    ])
    await db.events.bulkAdd([
      { at: at(2026, 6, 10), area: 'career', kind: 'goal.done', title: 'in', refTable: 'goals', refId: 1, milestone: true },
      { at: at(2026, 6, 11), area: 'learning', kind: 'learning-completed', title: 'book', milestone: true },
      { at: at(2026, 6, 12), area: 'personal', kind: 'review.done', title: 'review', milestone: true }, // excluded from milestones
      { at: at(2026, 6, 12), area: 'tasks', kind: 'task.done', title: 'x', milestone: false },
      { at: at(2026, 6, 30), area: 'tasks', kind: 'task.done', title: 'later', milestone: false },
    ])
    const d = await weekDigest(WEEK)
    expect(d.goalsCompleted).toBe(1)
    expect(d.goalUpdates).toBe(1)
    expect(d.eventCount).toBe(4)
    expect(d.milestones.map((m) => m.title).sort()).toEqual(['book', 'in'])
  })

  it('spending: outflows only, transfers excluded, previous week compared', async () => {
    const t = (date: string, amount: number, category: string) => ({ date, amount, category, description: 'x' })
    await db.transactions.bulkAdd([
      t('2026-06-08', -40, 'Groceries'),
      t('2026-06-14', -10.5, 'Dining'),
      t('2026-06-09', 2000, 'Income'), // inflow ignored
      t('2026-06-10', -500, 'Savings/Transfer'), // transfer ignored
      t('2026-06-01', -25, 'Dining'), // previous week
      t('2026-06-15', -99, 'Dining'), // next week: ignored
    ])
    const d = await weekDigest(WEEK)
    expect(d.spent).toBe(50.5)
    expect(d.spentPrev).toBe(25)
    expect(d.hasMoney).toBe(true)
  })

  it('hasMoney is true if only the previous week has transactions', async () => {
    await db.transactions.add({ date: '2026-06-02', amount: -1, category: 'Dining', description: 'x' })
    const d = await weekDigest(WEEK)
    expect(d).toMatchObject({ hasMoney: true, spent: 0, spentPrev: 1 })
  })

  it('meal days are distinct, study minutes summed, people distinct', async () => {
    await db.meals.bulkAdd([
      { date: '2026-06-08', slot: 'lunch', name: 'a' },
      { date: '2026-06-08', slot: 'dinner', name: 'b' },
      { date: '2026-06-10', slot: 'lunch', name: 'c' },
      { date: '2026-06-15', slot: 'lunch', name: 'out' },
    ])
    await db.studySessions.bulkAdd([
      { itemId: 1, date: '2026-06-09', minutes: 30 },
      { itemId: 1, date: '2026-06-14', minutes: 45 },
      { itemId: 1, date: '2026-06-16', minutes: 999 },
    ])
    await db.interactions.bulkAdd([
      { personId: 1, date: '2026-06-09', kind: 'text' },
      { personId: 1, date: '2026-06-10', kind: 'call' },
      { personId: 2, date: '2026-06-11', kind: 'call' },
    ])
    const d = await weekDigest(WEEK)
    expect(d.mealDays).toBe(2)
    expect(d.studyMinutes).toBe(75)
    expect(d.peopleContacted).toBe(2)
  })
})

describe('reviewStreak', () => {
  const rs = (...w: string[]) => w.map((x) => review(x))
  it('counts consecutive reviewed weeks including this week', () => {
    expect(reviewStreak(rs('2026-06-15', '2026-06-08', '2026-06-01'), '2026-06-17')).toBe(3)
  })
  it('this week unreviewed: streak continues from last week', () => {
    expect(reviewStreak(rs('2026-06-08', '2026-06-01'), '2026-06-17')).toBe(2)
  })
  it('a skipped week breaks it', () => {
    expect(reviewStreak(rs('2026-06-15', '2026-06-01'), '2026-06-17')).toBe(1)
  })
  it('none, or only stale reviews -> 0', () => {
    expect(reviewStreak([], '2026-06-17')).toBe(0)
    expect(reviewStreak(rs('2026-05-04'), '2026-06-17')).toBe(0)
  })
  it('works on a Sunday (still the same Monday-based week) and across the year end', () => {
    expect(reviewStreak(rs('2026-06-08'), '2026-06-14')).toBe(1)
    expect(reviewStreak(rs('2025-12-29', '2025-12-22'), '2026-01-01')).toBe(2)
  })
})

describe('avgRating', () => {
  it('averages the areas that were rated', () => {
    expect(avgRating(review(WEEK, { career: 4, health: 2 }))).toBe(3)
  })
  it('null when nothing rated', () => {
    expect(avgRating(review(WEEK, {}))).toBeNull()
  })
})

describe('spendChange', () => {
  it('says nothing when a week has no spend or the weeks are not comparable', async () => {
    const { spendChange } = await import('./summary')
    expect(spendChange(1420, 0)).toBeNull()
    expect(spendChange(0, 300)).toBeNull()
    expect(spendChange(1420, 282)).toBeNull() // rent week vs a normal week: the old "403% more"
    expect(spendChange(150, 100)).toBe(50)
    expect(spendChange(100, 100)).toBe(0)
  })
})
