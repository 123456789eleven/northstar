import { describe, expect, it } from 'vitest'
import { buildRow, dedupeKey, detectMapping, parseAmount, parseCsvText, parseDate, type Mapping } from './csv'
import { DEFAULT_RULES, INCOME, UNCATEGORIZED } from './categories'

describe('parseAmount', () => {
  it.each([
    ['12.50', 12.5], ['-12.50', -12.5], ['+12.50', 12.5], ['$1,234.56', 1234.56], ['-$1,234.56', -1234.56],
    ['(45.00)', -45], ['45.00-', -45], ['45.00 DR', -45], ['45.00 CR', 45], ['$ 7', 7], ['.5', 0.5], ['£3.20', 3.2], ['€3,20'.replace(',', '.'), 3.2],
  ])('%s -> %s', (raw, want) => {
    expect(parseAmount(raw)).toBe(want)
  })
  it.each(['', '   ', 'abc', '1.2.3', '--5', '12abc', '$'])('rejects %j', (raw) => {
    expect(parseAmount(raw)).toBeNull()
  })
  it('rounds to cents without float noise', () => {
    expect(parseAmount('0.1')! + parseAmount('0.2')!).not.toBe(0.3) // sanity: raw floats drift
    expect(parseAmount('19.999')).toBe(20)
    expect(parseAmount('1234567.89')).toBe(1234567.89)
  })
})

describe('parseDate', () => {
  it('ISO and slashed year-first', () => {
    expect(parseDate('2026-03-05', false)).toBe('2026-03-05')
    expect(parseDate('2026/3/5', false)).toBe('2026-03-05')
    expect(parseDate('2026-03-05T10:00:00Z', false)).toBe('2026-03-05')
  })
  it('compact yyyymmdd', () => {
    expect(parseDate('20260305', false)).toBe('2026-03-05')
  })
  it('month-first vs day-first', () => {
    expect(parseDate('03/05/2026', false)).toBe('2026-03-05')
    expect(parseDate('03/05/2026', true)).toBe('2026-05-03')
    expect(parseDate('25/12/2026', true)).toBe('2026-12-25')
    expect(parseDate('25/12/2026', false)).toBeNull() // month 25 is invalid
  })
  it('two-digit years and separators', () => {
    expect(parseDate('3/5/26', false)).toBe('2026-03-05')
    expect(parseDate('3-5-26', false)).toBe('2026-03-05')
    expect(parseDate('3.5.2026', false)).toBe('2026-03-05')
  })
  it('month-name formats', () => {
    expect(parseDate('Mar 5, 2026', false)).toBe('2026-03-05')
    expect(parseDate('5 March 2026', false)).toBe('2026-03-05')
  })
  it('rejects impossible calendar dates', () => {
    expect(parseDate('2026-02-30', false)).toBeNull()
    expect(parseDate('02/30/2026', false)).toBeNull()
    expect(parseDate('2026-13-01', false)).toBeNull()
    expect(parseDate('2026-00-10', false)).toBeNull()
    expect(parseDate('1800-01-01', false)).toBeNull()
  })
  it('accepts Feb 29 only on leap years', () => {
    expect(parseDate('2028-02-29', false)).toBe('2028-02-29')
    expect(parseDate('2026-02-29', false)).toBeNull()
  })
  it('rejects blanks and junk', () => {
    expect(parseDate('', false)).toBeNull()
    expect(parseDate('   ', false)).toBeNull()
    expect(parseDate('hello', false)).toBeNull()
    expect(parseDate('12345', false)).toBeNull()
  })
})

const rules = DEFAULT_RULES

describe('debit/credit (split column) file', () => {
  const csv = [
    'Account Number: 1234,,,',
    'Statement period: Mar 2026,,,',
    'Date,Description,Debit,Credit',
    '03/01/2026,KROGER #123,52.10,',
    '03/02/2026,PAYROLL ACME,,2500.00',
    '03/03/2026,NETFLIX.COM,15.49,',
    '03/04/2026,REFUND AMAZON,,20.00',
    '',
    '03/05/2026,Bad row,,',
  ].join('\n')

  it('skips preamble lines and detects the header', async () => {
    const f = await parseCsvText('chk.csv', csv)
    expect(f.headers).toEqual(['Date', 'Description', 'Debit', 'Credit'])
    expect(f.rows).toHaveLength(5)
  })
  it('detects split mode and builds signed amounts (debits negative, credits positive)', async () => {
    const f = await parseCsvText('chk.csv', csv)
    const m = detectMapping(f)
    expect(m).toMatchObject({ mode: 'split', date: 0, description: 1, debit: 2, credit: 3 })
    const out = f.rows.map((r) => buildRow(r, m, rules, ''))
    expect(out[0].tx).toMatchObject({ date: '2026-03-01', amount: -52.1, category: 'Groceries' })
    expect(out[1].tx).toMatchObject({ amount: 2500, category: INCOME })
    expect(out[2].tx).toMatchObject({ amount: -15.49, category: 'Subscriptions' })
    expect(out[3].tx).toMatchObject({ amount: 20 })
    expect(out[4].error).toBe('No readable amount')
  })
  it('a debit written as a negative number is still an outflow', () => {
    const m: Mapping = { date: 0, description: 1, amount: -1, debit: 2, credit: 3, mode: 'split', expensesPositive: false, dayFirst: false }
    expect(buildRow(['2026-03-01', 'X', '-10.00', ''], m, [], '').tx?.amount).toBe(-10)
  })
  it('both debit and credit populated nets them', () => {
    const m: Mapping = { date: 0, description: 1, amount: -1, debit: 2, credit: 3, mode: 'split', expensesPositive: false, dayFirst: false }
    expect(buildRow(['2026-03-01', 'X', '30.00', '50.00'], m, [], '').tx?.amount).toBe(20)
    expect(buildRow(['2026-03-01', 'X', '30.00', '30.00'], m, [], '').error).toBe('Zero amount')
  })
})

describe('single signed amount file', () => {
  const csv = ['Transaction Date,Description,Amount', '2026-03-01,"CHIPOTLE, INC #12",-11.25', '2026-03-02,PAYROLL,"1,800.00"', '2026-03-03,Mystery,-3.00'].join('\n')

  it('keeps signs as written and handles quoted commas', async () => {
    const f = await parseCsvText('bank.csv', csv)
    const m = detectMapping(f)
    expect(m).toMatchObject({ mode: 'amount', expensesPositive: false })
    const rows = f.rows.map((r) => buildRow(r, m, rules, 'Checking').tx!)
    expect(rows.map((r) => r.amount)).toEqual([-11.25, 1800, -3])
    expect(rows[0].description).toBe('CHIPOTLE, INC #12')
    expect(rows[0].category).toBe('Dining')
    expect(rows[2].category).toBe(UNCATEGORIZED)
    expect(rows[0].account).toBe('Checking')
  })
  it('omits account when blank', async () => {
    const f = await parseCsvText('bank.csv', csv)
    const tx = buildRow(f.rows[0], detectMapping(f), rules, '   ').tx!
    expect('account' in tx).toBe(false)
  })
})

describe('credit-card file where expenses are positive', () => {
  const csv = ['Posted Date,Payee,Amount', '03/01/2026,SHELL OIL 123,40.00', '03/02/2026,UBER   TRIP,18.50'].join('\n')
  it('flags expensesPositive and flips the sign', async () => {
    const f = await parseCsvText('cc.csv', csv)
    const m = detectMapping(f)
    expect(m.expensesPositive).toBe(true)
    const rows = f.rows.map((r) => buildRow(r, m, rules, '').tx!)
    expect(rows.map((r) => r.amount)).toEqual([-40, -18.5])
    expect(rows[1].description).toBe('UBER TRIP') // whitespace collapsed
    expect(rows[0].category).toBe('Gas')
  })
  it('a mix of signs is not treated as expenses-positive', async () => {
    const f = await parseCsvText('cc.csv', ['Date,Description,Amount', '03/01/2026,A,10', '03/02/2026,B,-5'].join('\n'))
    expect(detectMapping(f).expensesPositive).toBe(false)
  })
})

describe('mapping detection extras', () => {
  it('day-first is inferred when a first component exceeds 12', async () => {
    const f = await parseCsvText('eu.csv', ['Date,Description,Amount', '25/03/2026,A,-5', '01/04/2026,B,-6'].join('\n'))
    const m = detectMapping(f)
    expect(m.dayFirst).toBe(true)
    expect(buildRow(f.rows[1], m, [], '').tx?.date).toBe('2026-04-01')
  })
  it('headerless files are guessed by content', async () => {
    const f = await parseCsvText('raw.csv', ['03/01/2026,Coffee shop,-4.50', '03/02/2026,Book store,-12.00'].join('\n'))
    expect(f.headers).toEqual(['Column 1', 'Column 2', 'Column 3'])
    const m = detectMapping(f)
    expect(m).toMatchObject({ date: 0, amount: 2, description: 1 })
  })
  it('empty or whitespace-only files reject', async () => {
    await expect(parseCsvText('x.csv', '')).rejects.toThrow(/no rows/i)
    await expect(parseCsvText('x.csv', ',,\n , ,\n')).rejects.toThrow(/no rows/i)
  })
})

describe('buildRow errors', () => {
  const m: Mapping = { date: 0, description: 1, amount: 2, debit: -1, credit: -1, mode: 'amount', expensesPositive: false, dayFirst: false }
  it('unreadable date', () => {
    expect(buildRow(['soon', 'x', '5'], m, [], '').error).toBe('No readable date')
  })
  it('zero and missing amounts', () => {
    expect(buildRow(['2026-03-01', 'x', '0.00'], m, [], '').error).toBe('Zero amount')
    expect(buildRow(['2026-03-01', 'x', ''], m, [], '').error).toBe('No readable amount')
  })
  it('blank description is labelled', () => {
    expect(buildRow(['2026-03-01', '', '-5'], m, [], '').tx?.description).toBe('(no description)')
  })
})

describe('dedupeKey', () => {
  it('is case/space-insensitive on description and fixed to cents', () => {
    const a = dedupeKey({ date: '2026-03-01', amount: -5, description: '  Coffee ' })
    const b = dedupeKey({ date: '2026-03-01', amount: -5.0, description: 'COFFEE' })
    expect(a).toBe(b)
    expect(a).toBe('2026-03-01|-5.00|coffee')
  })
  it('differs by date, amount, or description', () => {
    const base = { date: '2026-03-01', amount: -5, description: 'a' }
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, date: '2026-03-02' }))
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, amount: -5.01 }))
    expect(dedupeKey(base)).not.toBe(dedupeKey({ ...base, description: 'b' }))
  })
})
