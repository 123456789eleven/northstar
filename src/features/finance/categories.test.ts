import { describe, expect, it } from 'vitest'
import { db, getSetting, type Transaction } from '../../db'
import {
  addMerchantRule, allRules, categorize, DEFAULT_RULES, escapeRegex, INCOME, isIncome, isSpending, merchantKey, merchantLabel,
  RULES_KEY, safeRegex, TRANSFER, UNCATEGORIZED, type Rule,
} from './categories'

const tx = (over: Partial<Transaction>): Transaction => ({ date: '2026-03-01', amount: -10, description: 'x', category: 'Dining', ...over })

describe('categorize', () => {
  const cat = (d: string, a = -10, rules: Rule[] = DEFAULT_RULES) => categorize(d, a, rules)
  it('built-in rules, case-insensitive', () => {
    expect(cat('kroger #1234')).toBe('Groceries')
    expect(cat('SHELL OIL 5551')).toBe('Gas')
    expect(cat('Spotify USA')).toBe('Subscriptions')
    expect(cat('DIRECT DEP ACME CORP', 2000)).toBe(INCOME)
    expect(cat('ONLINE TRANSFER TO SAVINGS')).toBe(TRANSFER)
  })
  it('earlier rules win: payroll before everything else', () => {
    expect(cat('PAYROLL KROGER', 100)).toBe(INCOME)
  })
  it('user rules outrank built-ins', () => {
    const rules = allRules([{ pattern: 'KROGER', category: 'Gifts' }])
    expect(cat('KROGER #5', -10, rules)).toBe('Gifts')
  })
  it('whitespace is collapsed before matching', () => {
    expect(cat('CHICK-FIL-A     0042')).toBe('Dining')
  })
  it('bare DEPOSIT with positive amount is income; negative is uncategorized', () => {
    expect(cat('MOBILE DEPOSIT', 40)).toBe(INCOME)
    expect(cat('MOBILE DEPOSIT', -40)).toBe(UNCATEGORIZED)
  })
  it('falls back to Uncategorized', () => {
    expect(cat('ZQXJ 9981')).toBe(UNCATEGORIZED)
  })
  it('an invalid user regex is skipped, not thrown', () => {
    const rules: Rule[] = [{ pattern: '([unclosed', category: 'Gifts' }, ...DEFAULT_RULES]
    expect(cat('KROGER', -1, rules)).toBe('Groceries')
  })
  it('built-in patterns all compile', () => {
    for (const r of DEFAULT_RULES) expect(safeRegex(r.pattern), r.pattern).not.toBeNull()
  })
})

describe('merchantKey / merchantLabel', () => {
  it.each([
    ['POS KROGER #1234 COLUMBUS OH', 'KROGER'],
    ['CHECKCARD 0301 TRADER JOES 123', 'TRADER JOES'],
    ['SQ *BLUE BOTTLE COFFEE', 'BLUE BOTTLE COFFEE'],
    ['AMAZON.COM*2K4 AMZN.COM/BILL', 'AMAZON.COM'],
    ['Starbucks Store 12345', 'STARBUCKS STORE'],
    ['  shell   oil  ', 'SHELL OIL'],
  ])('%s -> %s', (desc, want) => {
    expect(merchantKey(desc)).toBe(want)
  })
  it('falls back to the raw description when nothing usable remains', () => {
    expect(merchantKey('12345 67890')).toBe('12345 67890')
    expect(merchantKey('#### ####')).toBe('#### ####')
  })
  it('keeps at most three words', () => {
    expect(merchantKey('ONE TWO THREE FOUR FIVE')).toBe('ONE TWO THREE')
  })
  it('is stable across store numbers (so rules group them)', () => {
    expect(merchantKey('KROGER #1234')).toBe(merchantKey('KROGER #9876 CINCINNATI'))
  })
  it('label title-cases', () => {
    expect(merchantLabel('BLUE BOTTLE COFFEE')).toBe('Blue Bottle Coffee')
  })
})

describe('regex helpers', () => {
  it('escapeRegex neutralizes metacharacters', () => {
    const re = new RegExp(escapeRegex('A.B*C(1)+[x]'), 'i')
    expect(re.test('a.b*c(1)+[x]')).toBe(true)
    expect(re.test('aXb*c(1)+[x]')).toBe(false)
  })
  it('safeRegex returns null for invalid patterns', () => {
    expect(safeRegex('(')).toBeNull()
    expect(safeRegex('ok')).toBeInstanceOf(RegExp)
  })
})

describe('isIncome / isSpending', () => {
  it('classifies', () => {
    expect(isIncome(tx({ category: INCOME, amount: 100 }))).toBe(true)
    expect(isIncome(tx({ category: UNCATEGORIZED, amount: 5 }))).toBe(true)
    expect(isIncome(tx({ category: UNCATEGORIZED, amount: -5 }))).toBe(false)
    expect(isSpending(tx({ category: TRANSFER }))).toBe(false)
    expect(isSpending(tx({ category: INCOME }))).toBe(false)
    expect(isSpending(tx({ category: 'Dining' }))).toBe(true)
    expect(isSpending(tx({ category: UNCATEGORIZED, amount: -5 }))).toBe(true)
  })
})

describe('addMerchantRule (db)', () => {
  it('stores the rule and recategorizes matching rows only', async () => {
    await db.transactions.bulkAdd([
      tx({ description: 'JOES GARAGE 12', category: UNCATEGORIZED }),
      tx({ description: 'JOES GARAGE 99', category: UNCATEGORIZED }),
      tx({ description: 'JOES GARAGE 7', category: 'Transport' }), // already right: not counted
      tx({ description: 'OTHER PLACE', category: UNCATEGORIZED }),
    ])
    const n = await addMerchantRule('JOES GARAGE', 'Transport')
    expect(n).toBe(2)
    const rows = await db.transactions.toArray()
    expect(rows.filter((r) => r.category === 'Transport')).toHaveLength(3)
    expect(rows.find((r) => r.description === 'OTHER PLACE')?.category).toBe(UNCATEGORIZED)
    expect(await getSetting<Rule[]>(RULES_KEY, [])).toEqual([{ pattern: 'JOES GARAGE', category: 'Transport' }])
  })
  it('replaces an existing rule for the same merchant instead of duplicating', async () => {
    await addMerchantRule('A.B', 'Gifts')
    await addMerchantRule('A.B', 'Travel')
    const rules = await getSetting<Rule[]>(RULES_KEY, [])
    expect(rules).toEqual([{ pattern: 'A\\.B', category: 'Travel' }])
  })
  it('treats the merchant literally (dot does not match any character)', async () => {
    await db.transactions.bulkAdd([tx({ description: 'A.B', category: UNCATEGORIZED }), tx({ description: 'AXB', category: UNCATEGORIZED })])
    expect(await addMerchantRule('A.B', 'Gifts')).toBe(1)
  })
})

describe('Mobil gas-station rule', () => {
  it('matches the brand but not words that merely start with it', () => {
    expect(categorize('MOBIL 1234', -30, DEFAULT_RULES)).toBe('Gas')
    expect(categorize('EXXONMOBIL 5', -30, DEFAULT_RULES)).toBe('Gas')
    expect(categorize('MOBILE DEPOSIT', 40, DEFAULT_RULES)).toBe(INCOME)
    expect(categorize('MOBILE PHONE CASE', -9, DEFAULT_RULES)).toBe(UNCATEGORIZED)
  })
})

describe('transfers are never spending', () => {
  const cat = (d: string, a = -10) => categorize(d, a, DEFAULT_RULES)
  it('recognises own-account moves and card payoffs', () => {
    for (const d of ['Transfer to savings', 'XFER FROM SAVINGS', 'ACH TRANSFER 4411', 'CREDIT CARD PAYMENT THANK YOU', 'CHASE CARD AUTOPAY']) expect(cat(d)).toBe(TRANSFER)
    expect(cat('STUDENT LOAN PAYMENT')).toBe('Debt payment')
  })
  it('isSpend excludes Savings, Savings/Transfer, income and inflows', async () => {
    const { isSpend } = await import('./categories')
    expect(isSpend(tx({ category: 'Savings' }))).toBe(false)
    expect(isSpend(tx({ category: TRANSFER }))).toBe(false)
    expect(isSpend(tx({ category: INCOME, amount: -5 }))).toBe(false)
    expect(isSpend(tx({ amount: 5 }))).toBe(false)
    expect(isSpend(tx({}))).toBe(true)
  })
})
