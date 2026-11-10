import { describe, expect, it } from 'vitest'
import type { PaperTrade } from '../../db'
import { db } from '../../db'
import { currentYield, duration, yieldToMaturity } from './bonds'
import { project, projectRange } from './growth'
import { getCloses, recordQuote } from './history'
import { addPaperTrade, applyTrade, checkTrade, computePaper, emptyState, getStartCash } from './paper'
import { allocation, contributionVsGrowth, summarize, weightDrift } from './portfolio'

describe('portfolio', () => {
  const holdings = [
    { ticker: 'vti', shares: 10.5, price: 100, costBasis: 900 },
    { ticker: 'VTI', shares: 4.5, price: 100, costBasis: 500 },
    { ticker: 'BND', shares: 20, price: 50, costBasis: 1200 },
    { ticker: 'ZERO', shares: 0, price: 10 },
    { ticker: 'NOPRICE', shares: 5 },
  ]
  it('combines lots, computes value, P/L, weights and day change', () => {
    const s = summarize(holdings, { VTI: 110, BND: 49 }, { VTI: 108, BND: 50 })
    expect(s.positions.map((p) => p.ticker)).toEqual(['VTI', 'BND'])
    expect(s.totalValue).toBe(2630)
    const vti = s.positions[0]
    expect(vti.shares).toBe(15)
    expect(vti.value).toBe(1650)
    expect(vti.unrealized).toBe(250)
    expect(s.costBasis).toBe(2600)
    expect(s.unrealized).toBe(30)
    expect(s.dayChange).toBe(30 - 20)
    expect(s.positions.reduce((n, p) => n + p.weight, 0)).toBeCloseTo(1, 10)
  })
  it('handles empty input and holdings without basis', () => {
    const e = summarize([])
    expect(e).toMatchObject({ totalValue: 0, dayChange: 0, dayChangePct: 0, unrealizedPct: 0 })
    const s = summarize([{ ticker: 'A', shares: 1, price: 10 }])
    expect(s.positions[0].unrealized).toBeUndefined()
    expect(s.unrealized).toBe(0)
  })
  it('rounds to cents', () => {
    const s = summarize([{ ticker: 'A', shares: 0.333333, price: 10.005 }])
    expect(s.totalValue).toBe(3.33)
  })
  it('allocation and drift against targets, including unheld targets', () => {
    const s = summarize([{ ticker: 'A', shares: 1, price: 75 }, { ticker: 'B', shares: 1, price: 25 }])
    expect(allocation(s.positions)[0]).toMatchObject({ ticker: 'A', weight: 0.75 })
    const d = weightDrift(s.positions, { a: 0.5, b: 0.25, c: 0.25 })
    expect(d[0]).toMatchObject({ ticker: 'A', drift: 0.25 })
    expect(d.find((x) => x.ticker === 'C')).toMatchObject({ weight: 0, drift: -0.25 })
    expect(weightDrift([], {})).toEqual([])
  })
  it('splits contributions from growth', () => {
    expect(contributionVsGrowth([{ amount: 1000, kind: 'contribution' }, { amount: 200, kind: 'withdrawal' }], 1000)).toMatchObject({ contributed: 800, growth: 200, growthPct: 0.25 })
    expect(contributionVsGrowth([], 0)).toMatchObject({ contributed: 0, growth: 0, growthPct: 0 })
  })
})

const T = (o: Partial<PaperTrade>): PaperTrade => ({ symbol: 'VTI', side: 'buy', qty: 1, price: 100, date: '2026-03-01', ...o })

describe('paper trading', () => {
  it('buys, averages cost, sells, and tracks cash and realized P/L', () => {
    let s = emptyState(1000)
    s = applyTrade(s, T({ qty: 2, price: 100 }))
    s = applyTrade(s, T({ qty: 2, price: 200 }))
    expect(s.positions.get('VTI')).toMatchObject({ qty: 4, avgCost: 150 })
    expect(s.cash).toBe(400)
    s = applyTrade(s, T({ side: 'sell', qty: 1, price: 180 }))
    expect(s.realized).toBe(30)
    expect(s.cash).toBe(580)
    s = applyTrade(s, T({ side: 'sell', qty: 3, price: 150 }))
    expect(s.positions.has('VTI')).toBe(false)
    expect(s.realized).toBe(30)
  })
  it('rejects oversell, overspend, zero and bad numbers', () => {
    const s = applyTrade(emptyState(100), T({ qty: 1, price: 50 }))
    expect(checkTrade(s, T({ side: 'sell', qty: 2 }))).toMatch(/only hold/)
    expect(checkTrade(s, T({ symbol: 'NOPE', side: 'sell' }))).toMatch(/only hold/)
    expect(checkTrade(s, T({ qty: 2, price: 50.01 }))).toMatch(/Not enough/)
    expect(checkTrade(s, T({ qty: 0 }))).toMatch(/more than zero/)
    expect(checkTrade(s, T({ price: NaN }))).toMatch(/more than zero/)
    expect(() => applyTrade(s, T({ side: 'sell', qty: 5 }))).toThrow()
  })
  it('supports fractional shares without float dust', () => {
    let s = emptyState(1000)
    for (let i = 0; i < 10; i++) s = applyTrade(s, T({ qty: 0.1, price: 10 }))
    expect(s.positions.get('VTI')!.qty).toBe(1)
    s = applyTrade(s, T({ side: 'sell', qty: 1, price: 10 }))
    expect(s.positions.size).toBe(0)
  })
  it('computePaper replays in date order, values positions, and reports skipped trades', () => {
    const r = computePaper(
      [T({ id: 2, side: 'sell', qty: 1, price: 120, date: '2026-03-02' }), T({ id: 1, qty: 2, price: 100 }), T({ id: 3, side: 'sell', qty: 9, date: '2026-03-03' })],
      1000,
      { VTI: 130 },
    )
    expect(r.cash).toBe(920)
    expect(r.realized).toBe(20)
    expect(r.unrealized).toBe(30)
    expect(r.equity).toBe(1050)
    expect(r.skipped.map((t) => t.id)).toEqual([3])
    expect(computePaper([], 500)).toMatchObject({ cash: 500, equity: 500, positions: [] })
  })
  it('addPaperTrade validates against stored history and the start cash setting', async () => {
    expect(await getStartCash()).toBe(100000)
    expect((await addPaperTrade(T({ side: 'sell' }))).ok).toBe(false)
    expect((await addPaperTrade(T({ symbol: 'vti', qty: 10, price: 100 }))).ok).toBe(true)
    expect((await db.paperTrades.toArray())[0].symbol).toBe('VTI')
    expect((await addPaperTrade(T({ qty: 100000, price: 100 }))).ok).toBe(false)
    // A back-dated sell before the buy is rejected.
    expect((await addPaperTrade(T({ side: 'sell', qty: 1, date: '2026-02-01' }))).ok).toBe(false)
    expect(await db.paperTrades.count()).toBe(1)
  })
})

describe('growth', () => {
  it('compounds with monthly contributions', () => {
    const r = project({ principal: 1000, monthlyContribution: 0, years: 1, annualReturnPct: 5 })
    expect(r.final).toBe(1050)
    expect(r.points).toHaveLength(13)
    const c = project({ principal: 0, monthlyContribution: 100, years: 1, annualReturnPct: 0 })
    expect(c).toMatchObject({ final: 1200, contributed: 1200, growth: 0 })
  })
  it('handles zero years, bad input and negative returns; ranges carry the disclaimer', () => {
    expect(project({ principal: 500, monthlyContribution: 10, years: 0, annualReturnPct: 5 })).toMatchObject({ final: 500, growth: 0 })
    expect(project({ principal: NaN, monthlyContribution: -5, years: 1, annualReturnPct: NaN }).final).toBe(0)
    expect(project({ principal: 1000, monthlyContribution: 0, years: 1, annualReturnPct: -10 }).final).toBe(900)
    const r = projectRange({ principal: 1000, monthlyContribution: 50, years: 10 })
    expect(r.low.final).toBeLessThan(r.base.final)
    expect(r.base.final).toBeLessThan(r.high.final)
    expect(r.disclaimer).toMatch(/not a forecast/)
  })
})

describe('bonds', () => {
  it('par bond: ytm equals coupon, current yield equals coupon, duration is sensible', () => {
    const b = { price: 100, couponRatePct: 5, yearsToMaturity: 10 }
    expect(yieldToMaturity(b)!).toBeCloseTo(0.05, 6)
    expect(currentYield(b)!).toBeCloseTo(0.05, 10)
    const d = duration(b)!
    expect(d.modified).toBeCloseTo(7.79, 1)
    expect(d.macaulay).toBeGreaterThan(d.modified)
  })
  it('discount bond yields more than its coupon, premium less', () => {
    expect(yieldToMaturity({ price: 90, couponRatePct: 5, yearsToMaturity: 10 })!).toBeGreaterThan(0.05)
    expect(yieldToMaturity({ price: 110, couponRatePct: 5, yearsToMaturity: 10 })!).toBeLessThan(0.05)
  })
  it('zero coupon and edge cases', () => {
    const z = { price: 50, couponRatePct: 0, yearsToMaturity: 10, frequency: 1 }
    expect(yieldToMaturity(z)!).toBeCloseTo(Math.pow(2, 0.1) - 1, 6)
    expect(duration(z)!.macaulay).toBeCloseTo(10, 6)
    for (const bad of [{ price: 0, couponRatePct: 5, yearsToMaturity: 5 }, { price: 100, couponRatePct: 5, yearsToMaturity: 0 }, { price: NaN, couponRatePct: 5, yearsToMaturity: 5 }, { price: 100, couponRatePct: -1, yearsToMaturity: 5 }]) {
      expect(yieldToMaturity(bad)).toBeNull()
      expect(currentYield(bad)).toBeNull()
      expect(duration(bad)).toBeNull()
    }
  })
})

describe('price history', () => {
  it('upserts one bar per symbol per trade day and never fabricates', async () => {
    const t1 = new Date(2026, 2, 2, 10, 0).getTime()
    const t2 = new Date(2026, 2, 2, 15, 0).getTime()
    await recordQuote({ symbol: 'VTI', price: 100, time: t1, open: 99, high: 101, low: 98 })
    await recordQuote({ symbol: 'VTI', price: 103, time: t2, open: 99, high: 104, low: 98.5 })
    await recordQuote({ symbol: 'VTI', price: 105, time: new Date(2026, 2, 3, 12).getTime(), open: 104, high: 106, low: 103 })
    expect(await db.priceHistory.count()).toBe(2)
    const day1 = await db.priceHistory.where('[symbol+date]').equals(['VTI', '2026-03-02']).first()
    expect(day1).toMatchObject({ close: 103, open: 99, high: 104, low: 98 })
    expect((await getCloses('VTI')).map((p) => p.date)).toEqual(['2026-03-02', '2026-03-03'])
    expect(await getCloses('NOPE')).toEqual([])
    expect(await recordQuote({ symbol: 'VTI', price: 0, time: t1, open: 0, high: 0, low: 0 })).toBeNull()
    expect(await db.priceHistory.count()).toBe(2)
  })
})
