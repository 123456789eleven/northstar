import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db'
import { accrued, addMonthsISO, budgetSpend, daysToDue, detectBillSuggestions, matchesBill, monthlyEquivalent, monthsElapsed, nextDue, parseBills, serializeBills, type Bill } from './bills'

const bill: Bill = { id: 'b1', name: 'State Farm', amount: 1122.03, everyMonths: 6, lastPaid: '2026-09-03', category: 'Insurance', matchText: 'state farm' }
const tx = (date: string, amount: number, description: string, category = 'Insurance'): Transaction => ({ date, amount, description, category })

describe('month math', () => {
  it('adds months across month ends and leap years', () => {
    expect(addMonthsISO('2026-09-03', 6)).toBe('2027-03-03')
    expect(addMonthsISO('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonthsISO('2027-08-31', 6)).toBe('2028-02-29')
    expect(addMonthsISO('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonthsISO('2026-11-30', 3)).toBe('2027-02-28')
  })
  it('derives monthly equivalent, next due, days to due', () => {
    expect(monthlyEquivalent(bill)).toBe(187.01)
    expect(nextDue(bill)).toBe('2027-03-03')
    expect(daysToDue(bill, '2027-02-01')).toBe(30)
  })
  it('counts whole months elapsed', () => {
    expect(monthsElapsed('2026-09-03', '2026-11-01')).toBe(1)
    expect(monthsElapsed('2026-09-03', '2026-11-03')).toBe(2)
    expect(monthsElapsed('2026-09-03', '2026-09-02')).toBe(0)
  })
  it('accrues and caps at the amount', () => {
    expect(accrued(bill, '2026-11-03')).toBe(374.02)
    expect(accrued(bill, '2028-01-01')).toBe(1122.03)
  })
})

describe('matching', () => {
  it('matches by text or by amount within 7%', () => {
    expect(matchesBill(bill, tx('2026-09-03', -50, 'STATE FARM RO 123'))).toBe(true)
    expect(matchesBill(bill, tx('2026-09-03', -1100, 'ACH PAYMENT'))).toBe(true)
    expect(matchesBill(bill, tx('2026-09-03', -1300, 'ACH PAYMENT'))).toBe(false)
    expect(matchesBill(bill, tx('2026-09-03', -1122, 'STATE FARM', 'Groceries'))).toBe(false)
    expect(matchesBill(bill, tx('2026-09-03', 1122, 'STATE FARM refund'))).toBe(false)
  })
})

describe('budgetSpend', () => {
  it('owner case: payment month no longer 600% over', () => {
    const { spent, billInfo } = budgetSpend([tx('2026-09-03', -1122.03, 'STATE FARM INSURANCE')], [bill])
    expect(spent.get('Insurance')).toBe(187.01)
    expect(billInfo.get('Insurance')?.monthly).toBe(187.01)
  })
  it('other months commit the monthly share', () => {
    expect(budgetSpend([], [bill]).spent.get('Insurance')).toBe(187.01)
  })
  it('non-matching spend in the category still counts', () => {
    const { spent } = budgetSpend([tx('2026-09-10', -40, 'Renters fee')], [bill])
    expect(spent.get('Insurance')).toBe(227.01)
  })
  it('no bills leaves cash basis', () => {
    expect(budgetSpend([tx('2026-09-03', -1122.03, 'x')], []).spent.get('Insurance')).toBe(1122.03)
  })
})

describe('parse', () => {
  it('round-trips and drops junk', () => {
    expect(parseBills(serializeBills([bill]))).toEqual([bill])
    expect(parseBills({ v: 1, items: [{ id: 1 }, bill, { ...bill, id: 'x', amount: -1 }] })).toHaveLength(1)
    expect(parseBills(null)).toEqual([])
  })
})

describe('suggestions', () => {
  it('finds a 6-month repeat and a big one-off', () => {
    const txs = [tx('2026-03-03', -1122.03, 'STATE FARM INSURANCE'), tx('2026-09-03', -1122.03, 'STATE FARM INSURANCE')]
    const s = detectBillSuggestions(txs, [], [], '2026-11-01')
    expect(s[0]).toMatchObject({ everyMonths: 6, amount: 1122.03, category: 'Insurance', confirm: false })
    const one = detectBillSuggestions([tx('2026-09-03', -1122.03, 'STATE FARM INSURANCE')], [{ category: 'Insurance', monthlyLimit: 187 }], [], '2026-11-01')
    expect(one[0]).toMatchObject({ confirm: true, amount: 1122.03 })
  })
  it('skips already-tracked bills', () => {
    const one = detectBillSuggestions([tx('2026-09-03', -1122.03, 'STATE FARM INSURANCE')], [{ category: 'Insurance', monthlyLimit: 187 }], [bill], '2026-11-01')
    expect(one).toEqual([])
  })
})
