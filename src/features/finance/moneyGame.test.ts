import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db'
import { bossState, budgetPace, daysInMonthOf, dayOfMonthFor, netWorthMilestones, noSpendCount, noSpendDays } from './moneyGame'

const tx = (date: string, amount: number, category = 'Groceries'): Transaction => ({ date, amount, description: 'x', category })

describe('budgetPace', () => {
  it('on pace when spending tracks the calendar', () => {
    const p = budgetPace(100, 300, 10, 30)
    expect(p.status).toBe('on-track')
    expect(p.marker).toBeCloseTo(1 / 3)
  })
  it('watch when well ahead of pace or nearly used', () => {
    expect(budgetPace(200, 300, 10, 30).status).toBe('watch')
    expect(budgetPace(280, 300, 28, 30).status).toBe('watch')
  })
  it('over when above the limit, with words', () => {
    const p = budgetPace(320, 300, 20, 30)
    expect(p.status).toBe('over')
    expect(p.label).toBe('Over budget')
  })
  it('no limit is never a warning', () => {
    expect(budgetPace(50, 0, 3, 30).status).toBe('on-track')
  })
})

describe('bossState', () => {
  it('HP is the budget remaining', () => {
    const b = bossState(1000, 250, '2026-11', '2026-11-10')!
    expect(b.hp).toBeCloseTo(0.75)
    expect(b.remaining).toBe(750)
    expect(b.daysLeft).toBe(20)
    expect(b.status).toBe('holding')
    expect(b.headline).toBe('On budget')
  })
  it('flags being ahead of pace and being over', () => {
    expect(bossState(1000, 700, '2026-11', '2026-11-10')!.status).toBe('watch')
    const over = bossState(1000, 1150, '2026-11', '2026-11-20')!
    expect(over.status).toBe('beaten')
    expect(over.hp).toBe(0)
    expect(over.headline).toBe('150 over')
  })
  it('past months resolve to won or lost with no days left', () => {
    expect(bossState(1000, 900, '2026-10', '2026-11-02')!.status).toBe('won')
    const lost = bossState(1000, 1200, '2026-10', '2026-11-02')!
    expect(lost.status).toBe('lost')
    expect(lost.daysLeft).toBe(0)
  })
  it('no budget means no boss', () => {
    expect(bossState(0, 50, '2026-11', '2026-11-02')).toBeNull()
  })
})

describe('month helpers', () => {
  it('knows month lengths including leap years', () => {
    expect(daysInMonthOf('2024-02')).toBe(29)
    expect(daysInMonthOf('2026-02')).toBe(28)
    expect(daysInMonthOf('2026-12')).toBe(31)
  })
  it('day of month for current, past and future months', () => {
    expect(dayOfMonthFor('2026-11', '2026-11-02')).toBe(2)
    expect(dayOfMonthFor('2026-10', '2026-11-02')).toBe(31)
    expect(dayOfMonthFor('2026-12', '2026-11-02')).toBe(0)
  })
})

describe('noSpendDays', () => {
  it('marks days without spending, ignoring income and transfers', () => {
    const days = noSpendDays([tx('2026-11-01', -20), tx('2026-11-02', 1500, 'Income'), tx('2026-11-03', -5)], '2026-11', '2026-11-04')
    expect(days).toHaveLength(30)
    expect(days[0].state).toBe('spent')
    expect(days[1].state).toBe('nospend')
    expect(days[2].state).toBe('spent')
    expect(days[3].state).toBe('nospend')
    expect(days[4].state).toBe('future')
    expect(noSpendCount(days)).toBe(2)
  })
  it('ignores spending on neighbouring months at the boundary', () => {
    const days = noSpendDays([tx('2026-10-31', -20), tx('2026-12-01', -9)], '2026-11', '2026-11-30')
    expect(days[0].state).toBe('nospend')
    expect(days[29].state).toBe('nospend')
    expect(noSpendCount(days)).toBe(30)
  })
  it('February in a leap year has 29 days', () => {
    expect(noSpendDays([], '2024-02', '2024-03-01')).toHaveLength(29)
  })
})

describe('netWorthMilestones', () => {
  const s = [
    { date: '2026-01-01', net: 11000 },
    { date: '2026-02-01', net: 16000 },
    { date: '2026-03-01', net: 14000 },
  ]
  it('flags each $5k crossed and the next one', () => {
    const m = netWorthMilestones(s)
    expect(m.flags.map((f) => [f.target, f.reached, f.next])).toEqual([[15000, true, false], [20000, false, true]])
    expect(m.flags[0].reachedOn).toBe('2026-02-01')
    expect(m.high).toEqual({ date: '2026-02-01', net: 16000 })
    expect(m.toNext).toBe(6000)
  })
  it('empty series', () => {
    expect(netWorthMilestones([])).toEqual({ flags: [], high: null, toNext: null })
  })
  it('caps the flag count to the latest', () => {
    const m = netWorthMilestones([{ date: 'a', net: 0 }, { date: 'b', net: 100000 }], 5000, 4)
    expect(m.flags).toHaveLength(4)
    expect(m.flags.at(-1)!.target).toBe(105000)
  })
})
