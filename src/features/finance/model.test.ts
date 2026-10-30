import { describe, expect, it } from 'vitest'
import type { BalanceSnapshot, Transaction } from '../../db'
import { INCOME, TRANSFER, UNCATEGORIZED } from './categories'
import { compactMoney, monthRange, netWorthSeries, pct, shiftMonth, summarize, topMerchants } from './model'

const tx = (amount: number, category: string, description = 'x'): Transaction => ({ date: '2026-03-10', amount, category, description })

describe('summarize', () => {
  it('empty month', () => {
    const s = summarize([])
    expect(s).toMatchObject({ income: 0, spending: 0, net: 0, savingsRate: null })
    expect(s.byCategory.size).toBe(0)
  })
  it('income, spending and savings rate', () => {
    const s = summarize([tx(3000, INCOME), tx(-1000, 'Housing'), tx(-200, 'Groceries'), tx(-50, 'Groceries')])
    expect(s.income).toBe(3000)
    expect(s.spending).toBe(1250)
    expect(s.net).toBe(1750)
    expect(s.savingsRate).toBeCloseTo(1750 / 3000)
    expect(s.byCategory.get('Groceries')).toBe(250)
    expect(s.byCategory.get('Housing')).toBe(1000)
  })
  it('transfers are neither income nor spending', () => {
    const s = summarize([tx(-500, TRANSFER), tx(500, TRANSFER), tx(100, INCOME)])
    expect(s).toMatchObject({ income: 100, spending: 0, net: 100 })
    expect(s.byCategory.has(TRANSFER)).toBe(false)
  })
  it('positive uncategorized counts as income, negative as spending', () => {
    const s = summarize([tx(40, UNCATEGORIZED), tx(-15, UNCATEGORIZED)])
    expect(s).toMatchObject({ income: 40, spending: 15 })
  })
  it('refunds in an expense category reduce that category (not income)', () => {
    const s = summarize([tx(-100, 'Shopping'), tx(30, 'Shopping')])
    expect(s.spending).toBe(70)
    expect(s.byCategory.get('Shopping')).toBe(70)
    expect(s.income).toBe(0)
  })
  it('net can be negative; savings rate negative with income', () => {
    const s = summarize([tx(1000, INCOME), tx(-1500, 'Housing')])
    expect(s.net).toBe(-500)
    expect(s.savingsRate).toBe(-0.5)
  })
  it('no income -> savings rate is null even with spending', () => {
    expect(summarize([tx(-10, 'Dining')]).savingsRate).toBeNull()
  })
})

describe('topMerchants', () => {
  it('groups by merchant key, sorts by total, limits n', () => {
    const rows = [
      tx(-20, 'Groceries', 'KROGER #1'), tx(-30, 'Groceries', 'KROGER #2'),
      tx(-60, 'Dining', 'CHIPOTLE 55'), tx(-5, 'Dining', 'SHEETZ 9'),
      tx(100, INCOME, 'PAYROLL'), tx(-200, TRANSFER, 'TRANSFER'), tx(10, 'Shopping', 'REFUND STORE'),
    ]
    const top = topMerchants(rows, 2)
    expect(top).toEqual([
      ['CHIPOTLE', { total: 60, count: 1 }],
      ['KROGER', { total: 50, count: 2 }],
    ])
  })
})

describe('shiftMonth / monthRange', () => {
  it('crosses year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-03', 0)).toBe('2026-03')
    expect(shiftMonth('2026-03', -15)).toBe('2024-12')
  })
  it('monthRange is inclusive string bounds that include the 28th-31st', () => {
    const [a, b] = monthRange('2026-02')
    expect(a).toBe('2026-02-01')
    expect('2026-02-28' >= a && '2026-02-28' <= b).toBe(true)
    expect('2026-03-01' > b).toBe(true)
  })
})

describe('netWorthSeries', () => {
  const snap = (date: string, name: string, kind: 'asset' | 'liability', balance: number, id?: number): BalanceSnapshot => ({ id, date, name, kind, balance })
  it('empty -> empty', () => {
    expect(netWorthSeries([])).toEqual([])
  })
  it('carries each account latest balance forward', () => {
    const out = netWorthSeries([
      snap('2026-01-01', 'Checking', 'asset', 1000, 1),
      snap('2026-01-01', 'Card', 'liability', 400, 2),
      snap('2026-02-01', 'Savings', 'asset', 5000, 3),
      snap('2026-03-01', 'Checking', 'asset', 1500, 4),
    ])
    expect(out).toEqual([
      { date: '2026-01-01', assets: 1000, liabilities: 400, net: 600 },
      { date: '2026-02-01', assets: 6000, liabilities: 400, net: 5600 },
      { date: '2026-03-01', assets: 6500, liabilities: 400, net: 6100 },
    ])
  })
  it('is order-independent and collapses same-date snapshots, last id wins per account', () => {
    const out = netWorthSeries([
      snap('2026-02-01', 'A', 'asset', 200, 3),
      snap('2026-02-01', 'A', 'asset', 100, 2),
      snap('2026-01-01', 'B', 'liability', 50, 1),
    ])
    expect(out).toEqual([
      { date: '2026-01-01', assets: 0, liabilities: 50, net: -50 },
      { date: '2026-02-01', assets: 200, liabilities: 50, net: 150 },
    ])
  })
  it('does not mutate its input', () => {
    const input = [snap('2026-02-01', 'A', 'asset', 1, 2), snap('2026-01-01', 'A', 'asset', 2, 1)]
    netWorthSeries(input)
    expect(input[0].date).toBe('2026-02-01')
  })
})

describe('formatters', () => {
  it('pct rounds to whole percent', () => {
    expect(pct(0.256)).toBe('26%')
    expect(pct(-0.5)).toBe('-50%')
  })
  it('compactMoney abbreviates only large values', () => {
    expect(compactMoney(1234)).toMatch(/1,234/)
    expect(compactMoney(25000)).toMatch(/25K/)
  })
})
