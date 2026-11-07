import { describe, expect, it } from 'vitest'
import { buildShareModel, weekRangeLabel } from './shareCard'
import type { WeekDigest } from './summary'
import type { NumberItem } from './weekNumbers'

const digest = { tasksDone: 12, goalsCompleted: 0, goalUpdates: 0, spent: 412.5, spentPrev: 0, hasMoney: true, mealDays: 5, studyMinutes: 90, peopleContacted: 1, milestones: [{ title: 'Finished module two' }], slipped: [], eventCount: 0 } as unknown as WeekDigest
const item = (key: string, value: string, empty = false) => ({ key, label: key, value, note: '', href: '', linkLabel: '', empty }) as NumberItem

describe('buildShareModel', () => {
  it('builds the card from real week data', () => {
    const m = buildShareModel({ weekOf: '2026-11-02', digest, items: [item('weight', '181.2 lb'), item('spend', '', true), item('goals', 'x')], wins: 'Shipped the report\n\nLed standup', focusNext: 'Plan the move\nmore' })
    expect(m.range).toBe('Nov 2 to 8')
    expect(m.tasksDone).toBe(12)
    expect(m.stats[0]).toEqual({ label: 'days with meals', value: '5 of 7' })
    expect(m.stats[2].label).toBe('person reached')
    expect(m.wins).toEqual(['Finished module two', 'Shipped the report', 'Led standup'])
    expect(m.numbers).toEqual([{ label: 'weight', value: '181.2 lb' }])
    expect(m.next).toBe('Plan the move')
  })
  it('spans months in the range label', () => {
    expect(weekRangeLabel('2026-10-26')).toBe('Oct 26 to Nov 1')
  })
})
