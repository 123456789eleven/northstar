import { describe, expect, it } from 'vitest'
import { addMonths, advance, nextRecurrence, nextWeekday } from './capture'

describe('addMonths', () => {
  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29') // leap year
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })
  it('crosses years in both directions', () => {
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
    expect(addMonths('2026-01-15', -2)).toBe('2025-11-15')
  })
  it('n = 0 is identity', () => {
    expect(addMonths('2026-05-31', 0)).toBe('2026-05-31')
  })
})

describe('nextWeekday', () => {
  it('is strictly after the starting date', () => {
    expect(nextWeekday('2026-05-08', 5)).toBe('2026-05-15') // Friday -> next Friday
    expect(nextWeekday('2026-05-08', 6)).toBe('2026-05-09')
    expect(nextWeekday('2026-05-08', 0)).toBe('2026-05-10')
  })
})

describe('advance', () => {
  it('steps by recurrence', () => {
    expect(advance('2026-05-08', 'daily')).toBe('2026-05-09')
    expect(advance('2026-05-08', 'weekly')).toBe('2026-05-15')
    expect(advance('2026-05-08', 'monthly')).toBe('2026-06-08')
    expect(advance('2026-05-08', 'none')).toBe('2026-05-08')
  })
})

describe('nextRecurrence', () => {
  it('none -> undefined', () => {
    expect(nextRecurrence('2026-05-08', 'none', '2026-05-08')).toBeUndefined()
  })
  it('daily/weekly land strictly after today', () => {
    expect(nextRecurrence('2026-05-08', 'daily', '2026-05-08')).toBe('2026-05-09')
    expect(nextRecurrence('2026-05-01', 'weekly', '2026-05-20')).toBe('2026-05-22') // overdue task catches up
  })
  it('no due date -> steps from today', () => {
    expect(nextRecurrence(undefined, 'weekly', '2026-05-08')).toBe('2026-05-15')
  })
  it('completing early still moves to the next period after today', () => {
    expect(nextRecurrence('2026-05-20', 'weekly', '2026-05-08')).toBe('2026-05-27')
  })
  it('monthly: Jan 31 -> Feb 28 -> Mar 31 keeps the original day', () => {
    const feb = nextRecurrence('2026-01-31', 'monthly', '2026-01-31')
    expect(feb).toBe('2026-02-28')
    // second step receives the anchor day carried by the recurring task
    expect(nextRecurrence(feb, 'monthly', '2026-02-28', 31)).toBe('2026-03-31')
  })
  it('monthly with anchor survives a full year of short months', () => {
    let due: string | undefined = '2026-01-31'
    const seen: string[] = []
    for (let i = 0; i < 12; i++) {
      due = nextRecurrence(due, 'monthly', due!, 31)
      seen.push(due!)
    }
    expect(seen).toEqual([
      '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30', '2026-07-31',
      '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31', '2027-01-31',
    ])
  })
  it('without an anchor the day is taken from the due date', () => {
    expect(nextRecurrence('2026-05-15', 'monthly', '2026-05-15')).toBe('2026-06-15')
  })
})
