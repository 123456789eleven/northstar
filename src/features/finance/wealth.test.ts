import { describe, expect, it } from 'vitest'
import type { Budget, Contribution, Transaction } from '../../db'
import { autoStep, biggestJump, bestSavingMonth, changeOver, formGuide, isNewHigh, monthlyContribution, monthlySurplus, paceText, paceToNext, underBudgetRuns, weekMark, weeklyAllowance, discretionaryBudget } from './wealth'
import { CAUGHT_UP, deriveWins } from './wins'

const tx = (date: string, amount: number, category = 'Groceries'): Transaction => ({ date, amount, description: 'x', category })
const budgets: Budget[] = [{ category: 'Groceries', monthlyLimit: 520 }] // allowance 120/week
// Today Wed 2026-11-11 -> this Monday 2026-11-09; last completed week 2026-11-02..08.
const TODAY = '2026-11-11'

describe('week marks', () => {
  it('allowance is monthly * 12 / 52', () => expect(weeklyAllowance(520)).toBe(120))
  it('win under 95%, draw within 5%, loss over', () => {
    expect(weekMark(114, 120)).toBe('W')
    expect(weekMark(115, 120)).toBe('D')
    expect(weekMark(120, 120)).toBe('D')
    expect(weekMark(120.01, 120)).toBe('L')
  })
  it('bills in budgeted categories come out of the allowance', () => {
    const bill = { id: 'b', name: 'r', amount: 120, everyMonths: 1, lastPaid: '2026-10-01', category: 'Groceries' }
    expect(discretionaryBudget(budgets, [bill])).toBe(400)
  })
})

describe('formGuide', () => {
  it('judges completed weeks only, oldest first, blank when no transactions', () => {
    const txs = [tx('2026-11-03', -50), tx('2026-10-27', -130), tx('2026-10-20', -118), tx('2026-11-10', -999)]
    const f = formGuide(txs, budgets, [], TODAY, 4)
    expect(f.map((w) => w.start)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'])
    expect(f.map((w) => w.mark)).toEqual(['none', 'D', 'L', 'W'])
  })
  it('no budget means nothing is judged', () => {
    expect(formGuide([tx('2026-11-03', -50)], [], [], TODAY, 2).every((w) => w.mark === 'none')).toBe(true)
  })
  it('ignores spending outside budgeted categories and transfers', () => {
    const f = formGuide([tx('2026-11-03', -900, 'Dining'), tx('2026-11-04', -10)], budgets, [], TODAY, 1)
    expect(f[0].spent).toBe(10)
  })
  it('runs count W and D, break on L or blank', () => {
    const mk = (marks: string[]) => marks.map((m, i) => ({ start: '', end: `e${i}`, spent: 0, allowance: 1, mark: m as 'W' }))
    expect(underBudgetRuns(mk(['W', 'D', 'L', 'W', 'W', 'D', 'none']))).toEqual({ current: 0, longest: 3, longestEnd: 'e5' })
    expect(underBudgetRuns(mk(['L', 'W', 'D'])).current).toBe(2)
  })
})

describe('net worth', () => {
  const s = [{ date: '2026-09-01', net: 1000 }, { date: '2026-10-01', net: 1500 }, { date: '2026-11-01', net: 2640 }]
  it('change over a window uses the last point on or before the cutoff', () => {
    expect(changeOver(s, 30, '2026-11-01')).toBe(1140)
    expect(changeOver(s, 7, '2026-11-01')).toBe(1140)
    expect(changeOver(s, 365, '2026-11-01')).toBeNull()
  })
  it('auto step scales', () => {
    expect([autoStep(900), autoStep(4999), autoStep(5000), autoStep(60000), autoStep(300000), autoStep(2e6)]).toEqual([1000, 1000, 5000, 10000, 50000, 100000])
  })
  it('high only when strictly earned', () => {
    expect(isNewHigh(s)).toBe(true)
    expect(isNewHigh([{ date: 'a', net: 5 }, { date: 'b', net: 5 }])).toBe(false)
    expect(isNewHigh([{ date: 'a', net: 5 }])).toBe(false)
  })
  it('pace is honest about thin data', () => {
    expect(paceToNext([{ date: '2026-11-01', net: 1 }], 100)).toEqual({ state: 'thin' })
    expect(paceToNext([{ date: '2026-11-01', net: 1 }, { date: '2026-11-05', net: 9 }], 100)).toEqual({ state: 'thin' })
    expect(paceToNext([{ date: '2026-10-01', net: 100 }, { date: '2026-11-01', net: 50 }], 100)).toEqual({ state: 'flat' })
  })
  it('pace computes weeks', () => {
    const p = paceToNext([{ date: '2026-10-01', net: 0 }, { date: '2026-10-29', net: 2800 }], 1000)
    expect(p).toMatchObject({ state: 'ok', perWeek: 700, weeks: 2 })
    expect(paceText(p, 1000, '$4,000', (n) => `$${n}`)).toContain('about 2 weeks')
  })
  it('biggest jump', () => {
    expect(biggestJump(s)).toEqual({ amount: 1140, date: '2026-11-01' })
    expect(biggestJump([{ date: 'a', net: 5 }, { date: 'b', net: 3 }])).toBeNull()
  })
})

describe('savings engine', () => {
  it('averages complete months', () => {
    const txs = [tx('2026-09-02', 3000, 'Income'), tx('2026-09-05', -1000), tx('2026-10-02', 3000, 'Income'), tx('2026-10-05', -1400), tx('2026-11-02', 9999, 'Income')]
    const s = monthlySurplus(txs, [], TODAY)!
    expect(s).toMatchObject({ income: 3000, spending: 1200, surplus: 1800, months: 2 })
    expect(monthlySurplus([tx('2026-11-02', 5)], [], TODAY)).toBeNull()
  })
  it('best month', () => {
    const txs = [tx('2026-09-02', 3000, 'Income'), tx('2026-09-05', -1000), tx('2026-10-02', 3000, 'Income'), tx('2026-10-05', -1400)]
    expect(bestSavingMonth(txs, TODAY)).toEqual({ month: '2026-09', net: 2000 })
  })
  it('contribution average over 90 days', () => {
    const c: Contribution[] = [{ date: '2026-10-15', amount: 300, account: 'a', kind: 'contribution' }, { date: '2026-01-01', amount: 900, account: 'a', kind: 'contribution' }, { date: '2026-10-16', amount: 50, account: 'a', kind: 'withdrawal' }]
    expect(monthlyContribution(c, TODAY)).toBe(100)
  })
})

describe('deriveWins', () => {
  it('lists good news only, newest first, and may be empty', () => {
    expect(deriveWins({ today: TODAY, series: [], txs: [], budgets: [], bills: [], contribs: [] })).toEqual([])
    const wins = deriveWins({
      today: TODAY,
      series: [{ date: '2026-09-20', net: 1000 }, { date: '2026-11-05', net: 2640 }],
      txs: [tx('2026-11-03', -50), tx('2026-10-27', -60)],
      budgets,
      bills: [],
      contribs: [{ date: '2026-11-01', amount: 200, account: 'a', kind: 'contribution' }],
    })
    const texts = wins.map((w) => w.text)
    expect(texts).toContain('New net worth high: $2,640.')
    expect(texts).toContain('Second straight week under budget.')
    expect(texts).toContain('$200.00 added to investments in the last 30 days.')
    expect(wins.length).toBeLessThanOrEqual(5)
    expect([...wins].sort((a, b) => b.date.localeCompare(a.date))).toEqual(wins)
    expect(CAUGHT_UP).toBe("You're caught up.")
  })
})
