import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../db'
import { isLocalOnlySetting } from '../../sync/outbox'
import { categorizeWithSource, isSpend, TRANSFER, UNCATEGORIZED, type Rule } from './categories'
import { buildRow, describeMapping, detectMapping, headerSignature, MAP_KEY_PREFIX, parseCsvText } from './csv'
import { occurrenceKeys, planImport } from './dedupe'
import { detectRecurring, monthlyTotal } from './recurring'

const t = (date: string, amount: number, description: string): Transaction => ({ date, amount, description, category: 'Dining' })

describe('CSV dedupe', () => {
  it('two identical same-day purchases are both new the first time, both dup after', () => {
    const rows = [t('2026-03-01', -4.5, 'COFFEE'), t('2026-03-01', -4.5, 'coffee '), t('2026-03-02', -9, 'LUNCH')]
    expect(planImport(rows, [])).toEqual(['new', 'new', 'new'])
    expect(planImport(rows, rows)).toEqual(['dup', 'dup', 'dup'])
    expect(occurrenceKeys(rows)[0]).not.toBe(occurrenceKeys(rows)[1])
  })
  it('overlapping date ranges only add the new tail', () => {
    const first = [t('2026-03-01', -1, 'A'), t('2026-03-02', -2, 'B'), t('2026-03-03', -3, 'C')]
    const second = [t('2026-03-02', -2, 'B'), t('2026-03-03', -3, 'C'), t('2026-03-04', -4, 'D')]
    expect(planImport(second, first)).toEqual(['dup', 'dup', 'new'])
  })
  it('a second identical purchase beyond what is stored is new', () => {
    const have = [t('2026-03-01', -4.5, 'COFFEE')]
    expect(planImport([t('2026-03-01', -4.5, 'COFFEE'), t('2026-03-01', -4.5, 'COFFEE')], have)).toEqual(['dup', 'new'])
  })
  it('unreadable rows are errors and do not shift occurrence indexes', () => {
    const have = [t('2026-03-01', -4.5, 'COFFEE')]
    expect(planImport([undefined, t('2026-03-01', -4.5, 'COFFEE')], have)).toEqual(['error', 'dup'])
  })
})

describe('CSV layouts', () => {
  const run = async (csv: string) => {
    const f = await parseCsvText('x.csv', csv)
    const m = detectMapping(f)
    return { f, m, rows: f.rows.map((r) => buildRow(r, m, [], 'acct')) }
  }
  it('BOM, preamble, quoted commas, signed amount, M/D/YY, footer', async () => {
    const { f, m, rows } = await run('﻿Account: 1234\nStatement for March\n\n"Date","Description","Amount"\n3/5/26,"SHOP, THE","-$1,234.50"\n3/6/26,PAY,"2,000.00"\nTotal,,765.50\nEnding balance 100\n')
    expect(f.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(f.rows).toHaveLength(2)
    expect(m.mode).toBe('amount')
    expect(rows[0].tx).toMatchObject({ date: '2026-03-05', amount: -1234.5, description: 'SHOP, THE' })
    expect(rows[1].tx?.amount).toBe(2000)
    expect(describeMapping(f, m)).toMatch(/Date “Date”/)
  })
  it('separate debit/credit columns, parentheses and trailing minus', async () => {
    const { m, rows } = await run('Posting Date,Description,Debit,Credit\n2026-03-05,A,12.00,\n2026-03-06,B,,50.00\n')
    expect(m.mode).toBe('split')
    expect(rows.map((r) => r.tx?.amount)).toEqual([-12, 50])
    const x = await run('Date,Description,Amount\n03/05/2026,A,(45.00)\n03/06/2026,B,10.00-\n')
    expect(x.rows.map((r) => r.tx?.amount)).toEqual([-45, -10])
  })
  it('Chase-style header prefers Description over Details', async () => {
    const { f, m } = await run('Details,Posting Date,Description,Amount,Type,Balance\nDEBIT,03/05/2026,STORE,-5.00,ACH_DEBIT,100\nCREDIT,03/06/2026,PAY,5.00,ACH_CREDIT,105\n')
    expect(f.headers[m.description]).toBe('Description')
    expect(f.headers[m.date]).toBe('Posting Date')
    expect(f.headers[m.amount]).toBe('Amount')
  })
  it('Amount (USD) header and day-first detection', async () => {
    const { m, rows } = await run('Date,Memo,Amount (USD)\n25/03/2026,X,-3.00\n01/04/2026,Y,-4.00\n')
    expect(m.dayFirst).toBe(true)
    expect(rows[1].tx?.date).toBe('2026-04-01')
  })
  it('header signature ignores case and spacing; mapping keys stay on this device', () => {
    expect(headerSignature(['Date', ' Description', 'Amount'])).toBe(headerSignature(['date', 'description ', 'AMOUNT']))
    expect(headerSignature(['Date', 'Amount'])).not.toBe(headerSignature(['Date', 'Amount', 'Memo']))
    expect(isLocalOnlySetting(`${MAP_KEY_PREFIX}3.abc`)).toBe(true)
    expect(isLocalOnlySetting('finance.rules')).toBe(false)
  })
})

describe('categories', () => {
  const mine: Rule[] = [{ pattern: 'FICTIONAL GROCER', category: 'Dining' }]
  it('user rule beats built-in default and is labelled as such', () => {
    expect(categorizeWithSource('FICTIONAL GROCER 12', -5, mine)).toEqual({ category: 'Dining', source: 'rule' })
    expect(categorizeWithSource('KROGER 123', -5, mine)).toEqual({ category: 'Groceries', source: 'default' })
    expect(categorizeWithSource('QWERTY LLC', -5, mine)).toEqual({ category: UNCATEGORIZED, source: 'none' })
  })
  it.each(['PAYMENT THANK YOU', 'ONLINE TRANSFER TO SAV', 'CARD PAYMENT CHASE', 'ONLINE PAYMENT - THANK YOU'])('"%s" is a transfer and never spending', (d) => {
    const c = categorizeWithSource(d, -100, [])
    expect(c.category).toBe(TRANSFER)
    expect(isSpend({ ...t('2026-03-01', -100, d), category: c.category })).toBe(false)
  })
})

describe('detectRecurring', () => {
  const monthly = (m: string, amt: number) => t(`2026-${m}-05`, amt, 'STREAMING CO')
  it('finds a monthly subscription with slight price drift and projects next date', () => {
    const r = detectRecurring([monthly('01', -15.49), monthly('02', -15.49), monthly('03', -16.49), monthly('04', -16.49)], '2026-04-20')
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ merchant: 'STREAMING CO', cadence: 'monthly', last: '2026-04-05', next: '2026-05-05', count: 4 })
    expect(monthlyTotal(r)).toBe(r[0].monthly)
  })
  it('weekly and yearly cadences', () => {
    const w = [1, 8, 15, 22, 29].map((d) => t(`2026-03-${String(d).padStart(2, '0')}`, -10, 'LAWN GUY'))
    expect(detectRecurring(w, '2026-04-02')[0].cadence).toBe('weekly')
    const y = detectRecurring([t('2025-03-10', -99, 'DOMAIN CO'), t('2026-03-10', -99, 'DOMAIN CO')], '2026-06-01')
    expect(y[0]).toMatchObject({ cadence: 'yearly', monthly: 8.25 })
  })
  it('ignores irregular, wildly varying, transfer, and stale series', () => {
    const varied = [t('2026-01-05', -10, 'SHOP'), t('2026-02-05', -50, 'SHOP'), t('2026-03-05', -200, 'SHOP')]
    expect(detectRecurring(varied, '2026-03-10')).toEqual([])
    const irregular = [t('2026-01-01', -10, 'ODD'), t('2026-01-09', -10, 'ODD'), t('2026-03-20', -10, 'ODD')]
    expect(detectRecurring(irregular, '2026-03-21')).toEqual([])
    const xfer = [1, 2, 3].map((m) => ({ ...t(`2026-0${m}-05`, -100, 'SAVINGS MOVE'), category: TRANSFER }))
    expect(detectRecurring(xfer, '2026-03-10')).toEqual([])
    expect(detectRecurring([monthly('01', -9), monthly('02', -9), monthly('03', -9)], '2026-09-01')).toEqual([])
  })
})
