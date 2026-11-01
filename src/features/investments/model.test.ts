import { describe, expect, it } from 'vitest'
import type { Contribution } from '../../db'
import { allocation, contributedToDate, holdingGain, holdingValue, importCandidates, isStale, monthlySeries, monthlyToMax, monthsLeft, remainingRoom, sharesFromBalance, whatIf, ytdContributions } from './model'

const c = (date: string, amount: number, kind: Contribution['kind'] = 'contribution', account = 'A'): Contribution => ({ date, amount, account, kind })

describe('investments model', () => {
  it('shares from balance and price, 3 decimals', () => {
    expect(sharesFromBalance(33700, 312.45)).toBe(107.857)
    expect(sharesFromBalance(100, 0)).toBeNull()
    expect(sharesFromBalance(-1, 10)).toBeNull()
  })
  it('value and gain', () => {
    expect(holdingValue({ shares: 10, price: 12.5 })).toBe(125)
    expect(holdingValue({ shares: 10 })).toBeNull()
    expect(holdingGain({ shares: 10, price: 12.5, costBasis: 100 })).toEqual({ amount: 25, pct: 0.25 })
    expect(holdingGain({ shares: 10, price: 12.5 })).toBeNull()
  })
  it('staleness after 7 days', () => {
    expect(isStale('2026-10-25', '2026-11-01')).toBe(false)
    expect(isStale('2026-10-24', '2026-11-01')).toBe(true)
    expect(isStale(undefined, '2026-11-01')).toBe(true)
  })
  it('YTD per year and account', () => {
    const rows = [c('2025-12-31', 900), c('2026-01-05', 500), c('2026-02-01', 100, 'withdrawal'), c('2026-03-01', 250), c('2026-03-01', 999, 'contribution', 'B')]
    expect(ytdContributions(rows, 2026, 'A')).toBe(750)
    expect(ytdContributions(rows, 2025, 'A')).toBe(900)
    expect(ytdContributions(rows, 2026)).toBe(1749)
    expect(contributedToDate(rows, 'A')).toBe(1550)
  })
  it('remaining room and monthly to max', () => {
    expect(remainingRoom(7500, 7000)).toBe(500)
    expect(remainingRoom(7500, 8000)).toBe(0)
    expect(monthsLeft('2026-11-01')).toBe(2)
    expect(monthsLeft('2026-12-31')).toBe(1)
    expect(monthsLeft('2026-01-01')).toBe(12)
    expect(monthlyToMax(7500, 0, '2026-01-15')).toBe(625)
    expect(monthlyToMax(7500, 7500, '2026-06-01')).toBe(0)
    expect(monthlyToMax(7500, 6000, '2026-11-01')).toBe(750)
  })
  it('import candidates skip recorded and positives', () => {
    const t = [
      { id: 1, date: '2026-03-01', amount: -500, description: 'SCHWAB BROKERAGE ROTH' },
      { id: 2, date: '2026-03-02', amount: -40, description: 'Grocery' },
      { id: 3, date: '2026-03-03', amount: 500, description: 'IRA refund' },
      { id: 4, date: '2026-04-01', amount: -500, description: 'Schwab' },
    ]
    expect(importCandidates(t, [c('2026-03-01', 500)]).map((x) => x.key)).toEqual(['4'])
  })
  it('allocation, monthly series, what-if', () => {
    const a = allocation([{ account: 'A', ticker: 'VTI', shares: 1, price: 75 }, { account: 'A', ticker: 'BND', shares: 1, price: 25 }, { account: 'A', ticker: 'X' }])
    expect(a.map((x) => x.share)).toEqual([0.75, 0.25])
    const s = monthlySeries([
      { id: 1, date: '2026-01-05', name: 'A', kind: 'asset', balance: 1 },
      { id: 2, date: '2026-01-20', name: 'A', kind: 'asset', balance: 2 },
      { id: 3, date: '2026-02-05', name: 'B', kind: 'asset', balance: 9 },
    ], 'A')
    expect(s).toEqual([{ date: '2026-01-20', value: 2 }])
    expect(whatIf(1000, 0, 0, 5)).toBe(1000)
    expect(whatIf(0, 100, 0, 1)).toBe(1200)
  })
})
