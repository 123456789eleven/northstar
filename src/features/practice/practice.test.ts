import { describe, expect, it } from 'vitest'
import type { PaperTrade, PriceBar, TradeJournalEntry } from '../../db'
import { bandRows, dca, parseNum, parsePrices, positionSize, splitRows } from './calc'
import { blankDraft, filterJournal, planStreak, rewardRisk, validateDraft } from './journal'
import { canRemoveTrade, dayChange, equityCurve, fills, lastKnownPrices, tradeStats } from './ledger'

const T = (id: number, date: string, side: 'buy' | 'sell', symbol: string, qty: number, price: number): PaperTrade => ({ id, date, side, symbol, qty, price })
const trades = [T(1, '2026-01-02', 'buy', 'AAA', 10, 100), T(2, '2026-01-05', 'sell', 'AAA', 4, 120), T(3, '2026-01-06', 'sell', 'AAA', 6, 90)]

describe('ledger', () => {
  it('computes realized fills against average cost', () => {
    const f = fills(trades, 10000)
    expect(f.map((x) => x.gain)).toEqual([80, -60])
    expect(f[0].gainPct).toBeCloseTo(20)
  })
  it('summarises wins and losses', () => {
    const s = tradeStats(fills(trades, 10000))
    expect(s).toMatchObject({ count: 2, wins: 1, losses: 1, winRate: 0.5, avgWin: 80, avgLoss: -60, net: 20 })
    expect(s.best?.gain).toBe(80)
    expect(s.worst?.gain).toBe(-60)
    expect(s.payoff).toBeCloseTo(80 / 60)
  })
  it('handles no sells', () => {
    const s = tradeStats([])
    expect(s.winRate).toBeNull()
    expect(s.best).toBeNull()
  })
  it('prefers quote, then bar, then trade price', () => {
    const bars: PriceBar[] = [{ symbol: 'AAA', date: '2026-01-07', close: 95 }]
    expect(lastKnownPrices(trades, [], {}).AAA).toBe(90)
    expect(lastKnownPrices(trades, bars, {}).AAA).toBe(95)
    expect(lastKnownPrices(trades, bars, { AAA: 99 }).AAA).toBe(99)
  })
  it('builds an equity curve from trades and bars without inventing prices', () => {
    const t = [T(1, '2026-01-02', 'buy', 'AAA', 10, 100)]
    const bars: PriceBar[] = [{ symbol: 'AAA', date: '2026-01-03', close: 110 }]
    const c = equityCurve(t, 5000, bars, '2026-01-04')
    expect(c).toEqual([
      { date: '2026-01-02', equity: 5000 },
      { date: '2026-01-03', equity: 5100 },
      { date: '2026-01-04', equity: 5100 },
    ])
    expect(equityCurve(t, 5000, bars, '2026-01-04', { AAA: 120 }).at(-1)?.equity).toBe(5200)
    expect(equityCurve([], 5000, [], '2026-01-04')).toEqual([])
  })
  it('day change versus the previous day', () => {
    const c = [{ date: '2026-01-02', equity: 5000 }, { date: '2026-01-03', equity: 5100 }]
    expect(dayChange(c, 5150, '2026-01-04', 5000)).toBe(50)
    expect(dayChange([], 5150, '2026-01-04', 5000)).toBe(150)
  })
  it('only lets a trade be removed when later trades stay valid', () => {
    expect(canRemoveTrade(trades, 3, 10000)).toBe(true)
    expect(canRemoveTrade(trades, 1, 10000)).toBe(false)
  })
  it('copes with hundreds of trades', () => {
    const many: PaperTrade[] = []
    for (let i = 0; i < 400; i++) many.push(T(i + 1, `2026-0${1 + (i % 9)}-${String(1 + (i % 27)).padStart(2, '0')}`, 'buy', 'AAA', 1, 10))
    expect(equityCurve(many, 1e6, [], '2026-12-31').length).toBeGreaterThan(10)
    expect(fills(many, 1e6)).toEqual([])
  })
})

const J = (o: Partial<TradeJournalEntry>): TradeJournalEntry => ({ date: '2026-01-01', symbol: 'AAA', thesis: 't', ...o })

describe('journal', () => {
  it('requires a thesis and validates the plan', () => {
    expect(validateDraft(blankDraft('2026-01-01')).errors.thesis).toBeTruthy()
    const d = { ...blankDraft('2026-01-01', 'aaa'), thesis: 'x', entry: '100', stop: '95', target: '90' }
    expect(validateDraft(d).errors.target).toMatch(/above entry/)
    expect(validateDraft({ ...d, stop: '100' }).errors.stop).toMatch(/differ/)
    const ok = validateDraft({ ...d, target: '115', tags: '#Breakout, breakout, Fed', followedPlan: 'yes' })
    expect(ok.entry).toMatchObject({ symbol: 'AAA', tags: ['breakout', 'fed'], followedPlan: true, plan: { entry: 100, stop: 95, target: 115 } })
  })
  it('reward to risk', () => {
    expect(rewardRisk({ entry: 100, stop: 95, target: 115 })).toBe(3)
    expect(rewardRisk({ entry: 100 })).toBeNull()
  })
  it('searches and filters', () => {
    const es = [J({ id: 1, thesis: 'Earnings gap', tags: ['gap'] }), J({ id: 2, symbol: 'BBB', date: '2026-02-01', lesson: 'Waited too long' })]
    expect(filterJournal(es, {}).map((e) => e.id)).toEqual([2, 1])
    expect(filterJournal(es, { text: 'waited' }).map((e) => e.id)).toEqual([2])
    expect(filterJournal(es, { symbol: 'AAA' }).map((e) => e.id)).toEqual([1])
    expect(filterJournal(es, { tag: 'gap' }).map((e) => e.id)).toEqual([1])
  })
  it('counts plan-followed days, skipping unreviewed days', () => {
    const es = [
      J({ date: '2026-01-01', followedPlan: false }),
      J({ date: '2026-01-02', followedPlan: true }),
      J({ date: '2026-01-03' }),
      J({ date: '2026-01-04', followedPlan: true }),
      J({ date: '2026-01-04', followedPlan: true }),
    ]
    expect(planStreak(es)).toEqual({ streak: 2, followedDays: 2, reviewedDays: 3 })
    expect(planStreak([])).toEqual({ streak: 0, followedDays: 0, reviewedDays: 0 })
  })
})

describe('calculators', () => {
  it('parses numbers with clear errors', () => {
    expect(parseNum('1,250', 'Amount')).toEqual({ ok: true, value: 1250 })
    expect(parseNum('', 'Amount')).toMatchObject({ ok: false })
    expect(parseNum('abc', 'Amount')).toMatchObject({ ok: false, error: 'Amount must be a number.' })
    expect(parseNum('0', 'Amount', { positive: true })).toMatchObject({ ok: false })
  })
  it('sizes a position', () => {
    const r = positionSize({ account: 10000, riskPct: 1, entry: 50, stop: 48 })
    expect(r).toMatchObject({ ok: true, value: { direction: 'long', dollarRisk: 100, shares: 50, wholeShares: 50, positionValue: 2500, pctOfAccount: 25, exceedsAccount: false } })
    expect(positionSize({ account: 10000, riskPct: 1, entry: 50, stop: 50 }).ok).toBe(false)
    expect(positionSize({ account: 1000, riskPct: 2, entry: 100, stop: 99 })).toMatchObject({ value: { exceedsAccount: true } })
    expect(positionSize({ account: 1000, riskPct: 0, entry: 100, stop: 99 }).ok).toBe(false)
  })
  it('dollar-cost averages', () => {
    const p = parsePrices('10, 20, 10')
    expect(p.ok && p.value).toEqual([10, 20, 10])
    expect(parsePrices('10').ok).toBe(false)
    expect(parsePrices('10, x').ok).toBe(false)
    const r = dca(100, [10, 20, 10])
    expect(r).toMatchObject({ ok: true, value: { invested: 300, shares: 25, avgCost: 12, finalValue: 250, gain: -50, lumpShares: 30, lumpValue: 300 } })
    expect(dca(0, [1, 2]).ok).toBe(false)
  })
  it('builds chart rows', () => {
    const pts = [0, 12, 18].map((m) => ({ month: m, balance: 100 + m, contributed: 100 }))
    expect(splitRows(pts).map((r) => r.year)).toEqual([0, 1, 1.5])
    expect(splitRows(pts)[1]).toMatchObject({ contributed: 100, growth: 12 })
    expect(bandRows(pts, pts, pts)).toHaveLength(3)
  })
})
