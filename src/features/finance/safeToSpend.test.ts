import { describe, expect, it } from 'vitest'
import type { Budget, Transaction } from '../../db'
import type { Bill } from './bills'
import { dueText, paceLine, safeToSpend, unpaidBillsDue } from './safeToSpend'

const tx = (date: string, amount: number, description: string, category: string): Transaction => ({ date, amount, description, category })
const budgets: Budget[] = [{ category: 'Groceries', monthlyLimit: 400 }, { category: 'Dining', monthlyLimit: 200 }]
const bill: Bill = { id: 'b1', name: 'Example Insurance', amount: 100, everyMonths: 1, lastPaid: '2026-10-20', category: 'Insurance', matchText: 'example insurance' }

describe('safeToSpend', () => {
  it('is null without budgets', () => {
    expect(safeToSpend([], [], [], '2026-11', '2026-11-10')).toBeNull()
    expect(safeToSpend([{ category: 'Dining', monthlyLimit: 0 }], [], [], '2026-11', '2026-11-10')).toBeNull()
  })
  it('subtracts spend in budgeted categories and unpaid bills due this month', () => {
    const txs = [tx('2026-11-02', -50, 'Fictional Market', 'Groceries'), tx('2026-11-03', -30, 'Elsewhere', 'Shopping')]
    const r = safeToSpend(budgets, txs, [bill], '2026-11', '2026-11-10')!
    expect(r.budget).toBe(600)
    expect(r.spent).toBe(50)
    expect(r.billsDue).toBe(100)
    expect(r.left).toBe(450)
    expect(r.daysLeft).toBe(20)
  })
  it('does not count a bill already paid this month', () => {
    const txs = [tx('2026-11-20', -100, 'EXAMPLE INSURANCE', 'Insurance')]
    expect(unpaidBillsDue([bill], txs, '2026-11', '2026-11-25')).toHaveLength(0)
  })
  it('skips bills due after month end and past months', () => {
    expect(unpaidBillsDue([{ ...bill, lastPaid: '2026-11-20' }], [], '2026-11', '2026-11-25')).toHaveLength(0)
    expect(unpaidBillsDue([bill], [], '2026-10', '2026-11-10')).toHaveLength(0)
  })
  it('goes negative when over', () => {
    const r = safeToSpend(budgets, [tx('2026-11-02', -700, 'Big', 'Groceries')], [], '2026-11', '2026-11-10')!
    expect(r.left).toBe(-100)
    expect(r.freeShare).toBe(0)
  })
})

describe('paceLine', () => {
  it('reads on pace, ahead of pace and over', () => {
    expect(paceLine(600, 100, '2026-11', '2026-11-15')?.status).toBe('on-track')
    expect(paceLine(600, 450, '2026-11', '2026-11-15')?.status).toBe('watch')
    expect(paceLine(600, 700, '2026-11', '2026-11-15')?.note).toContain('$100 over')
  })
  it('is null without a budget or for a future month', () => {
    expect(paceLine(0, 10, '2026-11', '2026-11-15')).toBeNull()
    expect(paceLine(600, 0, '2026-12', '2026-11-15')).toBeNull()
  })
  it('summarises a closed month', () => {
    expect(paceLine(600, 500, '2026-10', '2026-11-15')?.note).toBe('Closed with $100 unspent.')
  })
})

describe('dueText', () => {
  it('phrases days', () => {
    expect(dueText('2026-11-10', '2026-11-10')).toBe('today')
    expect(dueText('2026-11-11', '2026-11-10')).toBe('tomorrow')
    expect(dueText('2026-11-14', '2026-11-10')).toBe('in 4 days')
    expect(dueText('2026-11-08', '2026-11-10')).toBe('2 days late')
  })
})
