import { describe, expect, it } from 'vitest'
import {
  detectHeader, emptyExisting, okItems, parseAmount, parseBirthday, parseBulk, parseCadence, parseLooseDate, removeLine, splitCells,
  type BulkContext,
} from './parse'
import { templateCsv } from './templates'

const NOW = new Date('2026-10-30T12:00:00') // Friday, noon local
const TODAY = '2026-10-30'
const ctx: BulkContext = { now: NOW }
const one = (kind: Parameters<typeof parseBulk>[0], line: string, c: BulkContext = ctx) => parseBulk(kind, line, c).rows[0]

describe('value parsers', () => {
  it('parseLooseDate', () => {
    expect(parseLooseDate('2026-12-31', TODAY)).toBe('2026-12-31')
    expect(parseLooseDate('by Dec 31', TODAY)).toBe('2026-12-31')
    expect(parseLooseDate('Jan 5', TODAY)).toBe('2027-01-05') // already past this year -> next
    expect(parseLooseDate('December 2027', TODAY)).toBe('2027-12-31')
    expect(parseLooseDate('3/14/27', TODAY)).toBe('2027-03-14')
    expect(parseLooseDate('tomorrow', TODAY)).toBe('2026-10-31')
    expect(parseLooseDate('Feb 30 2027', TODAY)).toBeUndefined()
    expect(parseLooseDate('whenever', TODAY)).toBeUndefined()
  })
  it('parseBirthday', () => {
    expect(parseBirthday('03-14')).toBe('03-14')
    expect(parseBirthday('3/4')).toBe('03-04')
    expect(parseBirthday('1990-03-14')).toBe('03-14')
    expect(parseBirthday('bday: Mar 14')).toBe('03-14')
    expect(parseBirthday('02-30')).toBeUndefined()
    expect(parseBirthday('13/1')).toBeUndefined()
    expect(parseBirthday('Friend')).toBeUndefined()
  })
  it('parseCadence', () => {
    expect(parseCadence('every 30 days')).toBe(30)
    expect(parseCadence('every 2 weeks')).toBe(14)
    expect(parseCadence('monthly')).toBe(30)
    expect(parseCadence('none')).toBe(0)
    expect(parseCadence('30')).toBeUndefined()
    expect(parseCadence('30', true)).toBe(30)
    expect(parseCadence('sometimes')).toBeUndefined()
  })
  it('parseAmount', () => {
    expect(parseAmount('$1,234.50')).toBe(1234.5)
    expect(parseAmount('-42.5')).toBe(-42.5)
    expect(parseAmount('(12.00)')).toBe(-12)
    expect(parseAmount('+500')).toBe(500)
    expect(parseAmount('abc')).toBeUndefined()
  })
  it('splitCells honours quotes', () => {
    expect(splitCells('a,"b, c",d', ',')).toEqual(['a', 'b, c', 'd'])
    expect(splitCells('a\tb\t', '\t')).toEqual(['a', 'b', ''])
  })
})

describe('tasks', () => {
  it('uses the capture-bar parser per line, ignoring bullets and blanks', () => {
    const res = parseBulk('tasks', '- call mom tomorrow !1\n\n2) Pay rent every month\nbuy milk, eggs', ctx)
    expect(res.rows.map((r) => r.status)).toEqual(['ok', 'ok', 'ok'])
    expect(res.rows[0].item).toMatchObject({ title: 'call mom', due: '2026-10-31', priority: 1 })
    expect(res.rows[1].item).toMatchObject({ title: 'Pay rent', recurrence: 'monthly' })
    expect(res.rows[2].item).toMatchObject({ title: 'buy milk, eggs' })
  })
  it('resolves #tags to goals', () => {
    const r = one('tasks', 'draft plan #career', { now: NOW, goals: [{ id: 7, title: 'Lead a team', area: 'career' }] })
    expect(r.item).toMatchObject({ title: 'draft plan', goalId: 7 })
  })
  it('flags a line with only tokens as an error', () => {
    const r = one('tasks', '!1 tomorrow')
    expect(r.status).toBe('error')
    expect(r.reason).toMatch(/title/i)
  })
  it('marks repeats and existing open tasks as duplicates', () => {
    const existing = emptyExisting()
    existing.tasks.add('call mom|2026-10-31')
    const res = parseBulk('tasks', 'call mom tomorrow\nwash car\nwash car', { now: NOW, existing })
    expect(res.rows.map((r) => [r.status, r.reason])).toEqual([
      ['duplicate', 'Already an open task'],
      ['ok', undefined],
      ['duplicate', 'Repeated above'],
    ])
    expect(okItems(res)).toHaveLength(1)
  })
  it('maps spreadsheet columns when the first row is a header', () => {
    const res = parseBulk('tasks', 'Task\tDue\tPriority\tRepeat\nRenew passport\t2026-11-15\thigh\t\nWater plants\t\tlow\tweekly', ctx)
    expect(res.mode).toBe('sheet')
    expect(res.headerLine).toBe(0)
    expect(res.rows[0].item).toMatchObject({ title: 'Renew passport', due: '2026-11-15', priority: 1, recurrence: 'none' })
    expect(res.rows[1].item).toMatchObject({ title: 'Water plants', priority: 3, recurrence: 'weekly' })
  })
  it('reports a bad cell in a spreadsheet row', () => {
    const r = parseBulk('tasks', 'Task\tDue\nA\tsoonish', ctx).rows[0]
    expect(r.status).toBe('error')
    expect(r.reason).toMatch(/soonish/)
  })
  it('without a header, tab cells are read as one line', () => {
    const res = parseBulk('tasks', 'call dentist\ttomorrow\nemail Sam\tfri', ctx)
    expect(res.headerLine).toBeUndefined()
    expect(res.rows[0].item).toMatchObject({ title: 'call dentist', due: '2026-10-31' })
  })
})

describe('people', () => {
  it('parses name, relationship, cadence and birthday in any order', () => {
    const r = one('people', 'Alex Rivera, Friend, every 14 days, 03-14')
    expect(r.item).toEqual({ kind: 'people', name: 'Alex Rivera', relation: 'Friend', cadenceDays: 14, birthday: '03-14', notes: undefined })
    expect(one('people', 'Sam, bday: Mar 4, monthly, coworker').item).toMatchObject({ name: 'Sam', birthday: '03-04', cadenceDays: 30, relation: 'coworker' })
  })
  it('defaults to a 30-day cadence and extra parts go to notes', () => {
    expect(one('people', 'Mom').item).toMatchObject({ name: 'Mom', relation: '', cadenceDays: 30 })
    expect(one('people', 'Jo, Friend, lives in Austin').item).toMatchObject({ relation: 'Friend', notes: 'lives in Austin' })
  })
  it('errors on a malformed cadence or birthday', () => {
    expect(one('people', 'Jo, every banana').status).toBe('error')
    const b = one('people', 'Jo, bday 13/45')
    expect(b.status).toBe('error')
    expect(b.reason).toMatch(/birthday/i)
  })
  it('detects duplicates by name, case-insensitive', () => {
    const existing = emptyExisting()
    existing.people.add('mom')
    const res = parseBulk('people', 'MOM\nDad\ndad', { now: NOW, existing })
    expect(res.rows.map((r) => r.status)).toEqual(['duplicate', 'ok', 'duplicate'])
  })
  it('reads a pasted sheet with headers', () => {
    const res = parseBulk('people', 'Name\tRelationship\tCadence\tBirthday\nAlex\tFriend\tevery 30 days\t03-14\nBo\tFamily\t7\t', ctx)
    expect(res.rows[0].item).toMatchObject({ name: 'Alex', cadenceDays: 30, birthday: '03-14' })
    expect(res.rows[1].item).toMatchObject({ name: 'Bo', cadenceDays: 7, birthday: undefined })
  })
  it('errors on a bad sheet birthday', () => {
    expect(parseBulk('people', 'Name\tBirthday\nAl\t99-99', ctx).rows[0].status).toBe('error')
  })
})

describe('goals', () => {
  it('parses title, area, by date', () => {
    const r = one('goals', 'Run a half marathon, health, by Dec 31')
    expect(r.item).toMatchObject({ title: 'Run a half marathon', area: 'health', targetDate: '2026-12-31', horizon: 'year' })
  })
  it('defaults area to personal, keeps unknown text as the why, errors on a bad date', () => {
    expect(one('goals', 'Read more').item).toMatchObject({ area: 'personal', targetDate: undefined })
    expect(one('goals', 'Save, finance, because security').item).toMatchObject({ area: 'finance', why: 'because security' })
    expect(one('goals', 'Ship it, career, by someday').status).toBe('error')
  })
  it('accepts a bare date and a horizon', () => {
    expect(one('goals', 'Learn SQL, learning, quarter, 2026-12-15').item).toMatchObject({ horizon: 'quarter', targetDate: '2026-12-15' })
  })
  it('flags duplicate titles', () => {
    expect(parseBulk('goals', 'A\na', ctx).rows.map((r) => r.status)).toEqual(['ok', 'duplicate'])
  })
})

describe('habits', () => {
  it('parses name, area, frequency', () => {
    expect(one('habits', 'Meditate').item).toMatchObject({ name: 'Meditate', area: 'health', perWeek: 7 })
    expect(one('habits', 'Run, health, 3x week').item).toMatchObject({ name: 'Run', perWeek: 3 })
    expect(one('habits', 'Read 5x').item).toMatchObject({ name: 'Read', perWeek: 5 })
    expect(one('habits', 'Journal daily, personal').item).toMatchObject({ name: 'Journal', area: 'personal', perWeek: 7 })
  })
  it('errors on out-of-range or unknown parts', () => {
    expect(one('habits', 'Run, 9x week').status).toBe('error')
    expect(one('habits', 'Run, loudly').status).toBe('error')
  })
  it('skips a lone "Habit" header row and flags duplicates', () => {
    const res = parseBulk('habits', 'Habit\nStretch\nstretch', ctx)
    expect(res.headerLine).toBe(0)
    expect(res.rows.map((r) => r.status)).toEqual(['ok', 'duplicate'])
  })
})

describe('meals', () => {
  it('uses the capture-bar meal parser', () => {
    expect(one('meals', 'oatmeal 350cal for breakfast').item).toMatchObject({ name: 'oatmeal', calories: 350, slot: 'breakfast', date: TODAY })
    expect(one('meals', 'ate pizza yesterday for dinner').item).toMatchObject({ name: 'pizza', date: '2026-10-29' })
  })
  it('reads comma and spreadsheet forms', () => {
    expect(one('meals', 'Chicken salad, 520, lunch').item).toMatchObject({ name: 'Chicken salad', calories: 520, slot: 'lunch' })
    const res = parseBulk('meals', 'Meal\tCalories\tSlot\tDate\nEggs\t200\tbreakfast\t2026-10-28', ctx)
    expect(res.rows[0].item).toMatchObject({ name: 'Eggs', calories: 200, slot: 'breakfast', date: '2026-10-28' })
  })
  it('errors on a bad slot and flags duplicates', () => {
    expect(parseBulk('meals', 'Meal\tSlot\nEggs\tbrunch', ctx).rows[0].status).toBe('error')
    expect(parseBulk('meals', 'eggs for lunch\neggs for lunch', ctx).rows.map((r) => r.status)).toEqual(['ok', 'duplicate'])
  })
})

describe('transactions', () => {
  it('reads capture-bar money, quick-add and leading amounts (unsigned = money out)', () => {
    expect(one('transactions', '$12.50 chipotle').item).toMatchObject({ amount: -12.5, description: 'chipotle', date: TODAY, category: 'Dining' })
    expect(one('transactions', 'Kroger 42.50').item).toMatchObject({ amount: -42.5, description: 'Kroger', category: 'Groceries' })
    expect(one('transactions', 'Paycheck +1200').item).toMatchObject({ amount: 1200, category: 'Income' })
    expect(one('transactions', '45 gas station').item).toMatchObject({ amount: -45, description: 'gas station' })
  })
  it('reads date, description, amount in any order from comma parts', () => {
    expect(one('transactions', '2026-10-01, Kroger, 42.50').item).toMatchObject({ date: '2026-10-01', amount: -42.5, description: 'Kroger' })
    expect(one('transactions', 'Refund, +20, Oct 3').item).toMatchObject({ date: '2026-10-03', amount: 20 })
  })
  it('spreadsheet headers use signed amounts, debit/credit, and a known category', () => {
    const res = parseBulk('transactions', 'Date\tDescription\tAmount\tCategory\n2026-10-01\tKroger\t-42.50\tgroceries\n2026-10-02\tPaycheck\t2500\t', ctx)
    expect(res.rows[0].item).toMatchObject({ amount: -42.5, category: 'Groceries' })
    expect(res.rows[1].item).toMatchObject({ amount: 2500 })
    const dc = parseBulk('transactions', 'Date\tDescription\tDebit\tCredit\n2026-10-01\tShop\t10\t\n2026-10-02\tPay\t\t99', ctx)
    expect(dc.rows.map((r) => (r.item as { amount: number }).amount)).toEqual([-10, 99])
  })
  it('errors with a reason', () => {
    expect(one('transactions', 'just words').reason).toMatch(/amount/i)
    expect(one('transactions', 'Kroger 0').status).toBe('error')
    expect(parseBulk('transactions', 'Date\tAmount\nxx\t5', ctx).rows[0].status).toBe('error')
  })
  it('flags duplicates against existing and within the paste', () => {
    const existing = emptyExisting()
    existing.transactions.add(`${TODAY}|-42.50|kroger`)
    const res = parseBulk('transactions', 'Kroger 42.50\nTarget 10\nTarget 10', { now: NOW, existing })
    expect(res.rows.map((r) => r.status)).toEqual(['duplicate', 'ok', 'duplicate'])
  })
})

describe('headers and templates', () => {
  it('detectHeader needs known names', () => {
    expect(detectHeader('people', ['Name', 'Relationship'])).toEqual(['name', 'relation'])
    expect(detectHeader('people', ['Alex', 'Friend'])).toBeNull()
    expect(detectHeader('habits', ['Name'])).toEqual(['name'])
  })
  it('downloaded templates parse back with no errors', () => {
    for (const kind of ['transactions', 'people', 'tasks'] as const) {
      const csv = templateCsv(kind, TODAY)!
      expect(csv.split('\r\n').filter(Boolean)).toHaveLength(3)
      const res = parseBulk(kind, csv, ctx)
      expect(res.headerLine).toBe(0)
      expect(res.rows.map((r) => r.status)).toEqual(['ok', 'ok'])
    }
  })
  it('only transactions, people and tasks have templates', () => {
    expect(templateCsv('goals')).toBeNull()
  })
  it('removeLine drops one line', () => {
    expect(removeLine('a\nb\nc', 1)).toBe('a\nc')
  })
})
