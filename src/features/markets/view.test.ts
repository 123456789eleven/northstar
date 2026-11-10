import { describe, expect, it } from 'vitest'
import {
  ageLabel, alertState, applyOrder, backoffSeconds, capBucket, criteriaCount, fmtDrift, fmtMarketCap, fmtPct, fmtPrice, fmtSignedMoney, freshness,
  matchesScreen, moveSymbol, newsWindow, numField, parseOptionalPrice, parseTargetPct, portfolioSeries, rangePosition, readScreens, readTargets,
  runScreen, sortRows, sparkPath, tickDirection, type Row,
} from './view'

describe('formatting', () => {
  it('formats prices, signs and caps', () => {
    expect(fmtPrice(1234.5)).toBe('1,234.50')
    expect(fmtPrice(0.12345)).toBe('0.1235')
    expect(fmtPrice(undefined)).toBe('—')
    expect(fmtPct(1.234)).toBe('+1.23%')
    expect(fmtPct(-0.5)).toBe('-0.50%')
    expect(fmtPct(0)).toBe('0.00%')
    expect(fmtSignedMoney(-12.3)).toBe('-$12.30')
    expect(fmtMarketCap(2_900_000)).toBe('$2.90T')
    expect(fmtMarketCap(310_500)).toBe('$310.5B')
    expect(fmtMarketCap(850)).toBe('$850M')
    expect(fmtDrift(0.032)).toBe('+3.2 pts')
    expect(fmtDrift(-0.01)).toBe('-1.0 pts')
  })
})

describe('tick direction', () => {
  it('detects up, down and no change', () => {
    expect(tickDirection(10, 11)).toBe('up')
    expect(tickDirection(10, 9.99)).toBe('down')
    expect(tickDirection(10, 10)).toBeNull()
    expect(tickDirection(undefined, 10)).toBeNull()
  })
})

describe('freshness', () => {
  const now = 1_000_000
  it('labels age honestly', () => {
    expect(ageLabel(15_000)).toBe('15 s ago')
    expect(ageLabel(2000)).toBe('just now')
    expect(ageLabel(5 * 60_000)).toBe('5 min ago')
    expect(ageLabel(3 * 3_600_000)).toBe('3 h ago')
  })
  it('covers every state', () => {
    expect(freshness({ now, hasKey: false }).tone).toBe('none')
    expect(freshness({ now, hasKey: true })).toEqual({ label: 'Waiting for prices', tone: 'none' })
    expect(freshness({ now, hasKey: true, fetchedAt: now - 15_000, marketOpen: true }).label).toBe('Updated 15 s ago')
    expect(freshness({ now, hasKey: true, fetchedAt: now - 15_000, marketOpen: false })).toEqual({ label: 'Market closed', tone: 'closed' })
    expect(freshness({ now, hasKey: true, fetchedAt: now - 200_000 })).toEqual({ label: 'Delayed, 3 min ago', tone: 'delayed' })
    expect(freshness({ now, hasKey: true, offline: true, fetchedAt: now - 60_000 }).label).toBe('Offline, last price 1 min ago')
  })
  it('counts the back-off down', () => {
    expect(backoffSeconds(30_000, 0, 5000)).toBe(25)
    expect(backoffSeconds(30_000, 0, 60_000)).toBe(0)
    expect(backoffSeconds(undefined, 0, 0)).toBe(30)
  })
})

describe('range position', () => {
  it('clamps and rejects bad ranges', () => {
    expect(rangePosition(150, 100, 200)).toBe(0.5)
    expect(rangePosition(250, 100, 200)).toBe(1)
    expect(rangePosition(50, 100, 200)).toBe(0)
    expect(rangePosition(5, 10, 10)).toBeNull()
    expect(rangePosition(undefined, 1, 2)).toBeNull()
  })
})

const rows: Row[] = [
  { symbol: 'AAA', price: 10, changePct: 2, week52Low: 5, week52High: 15, pe: 12, dividendYield: 3, marketCap: 500_000 },
  { symbol: 'BBB', price: 100, changePct: -1, week52Low: 50, week52High: 110, pe: 30, dividendYield: 0, marketCap: 5000 },
  { symbol: 'CCC', price: 55 },
]

describe('sorting and order', () => {
  it('sorts with unknowns last in both directions', () => {
    expect(sortRows(rows, 'changePct', 'desc').map((r) => r.symbol)).toEqual(['AAA', 'BBB', 'CCC'])
    expect(sortRows(rows, 'changePct', 'asc').map((r) => r.symbol)).toEqual(['BBB', 'AAA', 'CCC'])
    expect(sortRows(rows, 'week52', 'desc').map((r) => r.symbol)).toEqual(['BBB', 'AAA', 'CCC'])
    expect(sortRows(rows, 'symbol', 'desc').map((r) => r.symbol)).toEqual(['CCC', 'BBB', 'AAA'])
  })
  it('applies and moves a manual order', () => {
    expect(applyOrder(rows, ['BBB', 'AAA']).map((r) => r.symbol)).toEqual(['BBB', 'AAA', 'CCC'])
    expect(moveSymbol(['A', 'B', 'C'], 'C', -1)).toEqual(['A', 'C', 'B'])
    expect(moveSymbol(['A', 'B'], 'A', -1)).toEqual(['A', 'B'])
  })
})

describe('alerts', () => {
  it('fires above and below', () => {
    expect(alertState(101, 100, undefined)).toBe('above')
    expect(alertState(49, 100, 50)).toBe('below')
    expect(alertState(75, 100, 50)).toBeNull()
    expect(alertState(undefined, 100)).toBeNull()
  })
  it('parses optional prices', () => {
    expect(parseOptionalPrice('')).toBeUndefined()
    expect(parseOptionalPrice('1,200.5')).toBe(1200.5)
    expect(parseOptionalPrice('-3')).toBe('invalid')
    expect(parseOptionalPrice('abc')).toBe('invalid')
  })
})

describe('screen matching', () => {
  it('matches only on criteria the owner set', () => {
    expect(runScreen(rows, {}).length).toBe(3)
    expect(runScreen(rows, { priceMin: 50 }).map((r) => r.symbol)).toEqual(['BBB', 'CCC'])
    expect(runScreen(rows, { changeMin: 0 }).map((r) => r.symbol)).toEqual(['AAA'])
    expect(runScreen(rows, { posMin: 80 }).map((r) => r.symbol)).toEqual(['BBB'])
    expect(runScreen(rows, { peMax: 20 }).map((r) => r.symbol)).toEqual(['AAA'])
    expect(runScreen(rows, { yieldMin: 2 }).map((r) => r.symbol)).toEqual(['AAA'])
    expect(runScreen(rows, { caps: ['mid'] }).map((r) => r.symbol)).toEqual(['BBB'])
  })
  it('treats a missing figure as no match', () => {
    expect(matchesScreen(rows[2], { peMax: 100 })).toBe(false)
    expect(matchesScreen(rows[2], { caps: ['mega'] })).toBe(false)
  })
  it('buckets caps and counts criteria', () => {
    expect(capBucket(250_000)).toBe('mega')
    expect(capBucket(1999)).toBe('small')
    expect(capBucket(undefined)).toBeNull()
    expect(criteriaCount({ priceMin: 1, caps: ['mid'] })).toBe(2)
    expect(numField(' 2.5 ')).toBe(2.5)
    expect(numField('x')).toBeUndefined()
  })
  it('reads saved screens and targets defensively', () => {
    expect(readScreens('nope')).toEqual([])
    expect(readScreens([{ name: 'Dividend', criteria: { yieldMin: 2 } }, { bad: 1 }])).toHaveLength(1)
    expect(readTargets({ vti: 0.6, bad: 5, x: 'y' })).toEqual({ VTI: 0.6 })
    expect(parseTargetPct('25%')).toBe(0.25)
    expect(parseTargetPct('')).toBeUndefined()
    expect(parseTargetPct('150')).toBe('invalid')
  })
})

describe('series', () => {
  it('draws a path only with 2+ points', () => {
    expect(sparkPath([1], 100, 20)).toBe('')
    expect(sparkPath([1, 2, 3], 100, 20)).toMatch(/^M2\.0,18\.0L50\.0,10\.0L98\.0,2\.0$/)
  })
  it('builds portfolio value only on days every ticker has a bar', () => {
    const s = portfolioSeries(
      [{ ticker: 'A', shares: 2 }, { ticker: 'b', shares: 1 }],
      { A: { '2026-01-01': 10, '2026-01-02': 11 }, B: { '2026-01-02': 5 } },
    )
    expect(s).toEqual([{ date: '2026-01-02', value: 27 }])
  })
  it('builds a 7 day news window in local dates', () => {
    expect(newsWindow(new Date(2026, 10, 9))).toEqual({ from: '2026-11-02', to: '2026-11-09' })
  })
})
