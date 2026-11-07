import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db'
import { niceTicks } from './NetWorthHero'
import { detectRecurring, splitRecurring } from './recurring'

const monthly = (desc: string, cat: string, amt: number): Transaction[] =>
  ['2026-08-05', '2026-09-05', '2026-10-05'].map((date) => ({ date, amount: -amt, description: desc, category: cat }))

describe('splitRecurring', () => {
  it('keeps rent and utilities out of subscriptions', () => {
    const txs = [...monthly('Fictional Streaming', 'Subscriptions', 15.99), ...monthly('Fictional Landlord', 'Housing', 1200), ...monthly('Fictional Power', 'Utilities', 90)]
    const r = splitRecurring(detectRecurring(txs, '2026-11-01'), txs)
    expect(r.subscriptions.map((x) => x.amount)).toEqual([15.99])
    expect(r.bills).toHaveLength(2)
  })
})

describe('niceTicks', () => {
  it('uses clean steps that cover the range', () => {
    const t = niceTicks(6762, 10200)
    expect(t[0]).toBeLessThanOrEqual(6762)
    expect(t.at(-1)!).toBeGreaterThanOrEqual(10200)
    expect(t.every((v) => v % 500 === 0)).toBe(true)
  })
})
