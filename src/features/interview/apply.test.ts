import { describe, expect, it } from 'vitest'
import { db, getSetting } from '../../db'
import { applyAnswers } from './apply'
import { answersAsText, lines, progress } from './questions'

describe('interview', () => {
  it('lines strips bullets and caps', () => {
    expect(lines('- Ann\n2. Bo\n\n* Cy', 2)).toEqual(['Ann', 'Bo'])
  })
  it('progress counts answered questions', () => {
    expect(progress({ name: 'x', pull: ['Streaks'], height: 70 }).done).toBe(3)
    expect(progress({ name: '  ' }).done).toBe(0)
  })
  it('answersAsText lists answered questions only', () => {
    const t = answersAsText({ name: 'Sam' })
    expect(t).toContain('Sam')
    expect(t).not.toContain('Height')
  })
  it('applies body, holding, goal and people, and is idempotent', async () => {
    const a = { height: 70, weight: 140, goalWeight: 165, trainDays: 4, vtiShares: 12, vtiAccount: 'Test IRA', targetRole: 'Lead', circle: 'Ann\nBo', cadence: 'Weekly', calories: 3000 }
    const first = await applyAnswers(a)
    expect(first.join(' ')).toContain('VTI: 12 shares in Test IRA')
    expect(await getSetting('body.goal', 0)).toBe(165)
    expect(await db.holdings.count()).toBe(1)
    expect(await db.weights.count()).toBe(1)
    expect((await db.people.toArray()).map((p) => p.cadenceDays)).toEqual([7, 7])
    await applyAnswers({ ...a, vtiShares: 15 })
    expect(await db.holdings.count()).toBe(1)
    expect((await db.holdings.toArray())[0].shares).toBe(15)
    expect(await db.goals.count()).toBe(1)
    expect(await db.people.count()).toBe(2)
    expect(await db.habits.count()).toBe(1)
  })
})
