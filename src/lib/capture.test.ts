import { describe, expect, it } from 'vitest'
import { describeCapture, matchGoal, parseCapture, parseTask, slotForTime, type CaptureGoal } from './capture'

// Wednesday 2026-05-06, 9:00 local.
const NOW = new Date(2026, 4, 6, 9, 0)
const ctx = { now: NOW }
const task = (s: string, c: Parameters<typeof parseTask>[1] = ctx) => parseTask(s, c)

describe('parseCapture: empty & routing', () => {
  it('blank input is empty', () => {
    expect(parseCapture('')).toEqual({ kind: 'empty' })
    expect(parseCapture('   \t ')).toEqual({ kind: 'empty' })
  })
  it('plain text becomes a task with defaults', () => {
    expect(parseCapture('buy milk', ctx)).toEqual({
      kind: 'task', title: 'buy milk', due: undefined, priority: 2, recurrence: 'none', goalId: undefined, goalTitle: undefined,
    })
  })
})

describe('transactions', () => {
  it('dollar amount plus description is an expense dated today', () => {
    expect(parseCapture('$12.50 chipotle', ctx)).toEqual({ kind: 'transaction', amount: -12.5, description: 'chipotle', date: '2026-05-06' })
  })
  it('explicit minus is an expense, plus is income', () => {
    expect(parseCapture('-$8 coffee', ctx)).toMatchObject({ amount: -8, description: 'coffee' })
    expect(parseCapture('+$500 paycheck', ctx)).toMatchObject({ amount: 500, description: 'paycheck' })
  })
  it('amounts with thousands separators', () => {
    expect(parseCapture('+$1,234.56 bonus', ctx)).toMatchObject({ amount: 1234.56 })
    expect(parseCapture('$12,000 car', ctx)).toMatchObject({ amount: -12000, description: 'car' })
    expect(parseCapture('$1,000,000 lottery', ctx)).toMatchObject({ amount: -1_000_000 })
  })
  it('no description gets a default label', () => {
    expect(parseCapture('$5', ctx)).toMatchObject({ amount: -5, description: 'Expense' })
    expect(parseCapture('+$5', ctx)).toMatchObject({ amount: 5, description: 'Income' })
  })
  it('single-digit decimals and whole numbers', () => {
    expect(parseCapture('$3.5 gum', ctx)).toMatchObject({ amount: -3.5 })
    expect(parseCapture('$100 rent', ctx)).toMatchObject({ amount: -100 })
  })
  it('a dollar sign mid-sentence is not a transaction', () => {
    expect(parseCapture('pay $20 to bob', ctx).kind).toBe('task')
  })
})

describe('wins', () => {
  it('win: defaults to personal', () => {
    expect(parseCapture('win: shipped the report', ctx)).toEqual({ kind: 'win', title: 'shipped the report', area: 'personal' })
  })
  it('#area tag sets the area and is removed from the title', () => {
    expect(parseCapture('Win: shipped the report #career', ctx)).toEqual({ kind: 'win', title: 'shipped the report', area: 'career' })
  })
  it('empty win gets a fallback title', () => {
    expect(parseCapture('win:', ctx)).toEqual({ kind: 'win', title: 'Win', area: 'personal' })
  })
  it('unknown #tags stay in the title', () => {
    expect(parseCapture('win: did a thing #zzz', ctx)).toMatchObject({ title: 'did a thing #zzz', area: 'personal' })
  })
})

describe('meals', () => {
  it('ate X 350cal', () => {
    expect(parseCapture('ate oatmeal 350cal', ctx)).toEqual({ kind: 'meal', name: 'oatmeal', calories: 350, slot: 'breakfast', date: '2026-05-06' })
  })
  it('calorie spellings', () => {
    expect(parseCapture('ate toast 120 kcal', ctx)).toMatchObject({ name: 'toast', calories: 120 })
    expect(parseCapture('ate toast 120 calories', ctx)).toMatchObject({ name: 'toast', calories: 120 })
    expect(parseCapture('ate toast 120 cals', ctx)).toMatchObject({ name: 'toast', calories: 120 })
  })
  it('"for lunch" sets the slot and is stripped from the name', () => {
    expect(parseCapture('had chicken salad for lunch 520 kcal', ctx)).toMatchObject({ name: 'chicken salad', calories: 520, slot: 'lunch' })
    expect(parseCapture('ate pasta for dinner', ctx)).toMatchObject({ name: 'pasta', slot: 'dinner', calories: undefined })
  })
  it('slot defaults from time of day', () => {
    const at = (h: number, m = 0) => parseCapture('ate x', { now: new Date(2026, 4, 6, h, m) })
    expect(at(8)).toMatchObject({ slot: 'breakfast' })
    expect(at(12)).toMatchObject({ slot: 'lunch' })
    expect(at(19)).toMatchObject({ slot: 'dinner' })
    expect(at(23)).toMatchObject({ slot: 'snack' })
    expect(at(2)).toMatchObject({ slot: 'snack' })
  })
  it('"had to ..." is a task, not a meal', () => {
    const c = parseCapture('had to call mom', ctx)
    expect(c.kind).toBe('task')
    expect(c).toMatchObject({ title: 'had to call mom' })
  })
  it('"had" alone falls through to a task', () => {
    expect(parseCapture('had', ctx).kind).toBe('task')
  })
  it('a calorie-only meal with no name falls through to a task', () => {
    expect(parseCapture('ate 300cal', ctx).kind).toBe('task')
  })
})

describe('slotForTime boundaries', () => {
  it.each([
    [3, 59, 'snack'], [4, 0, 'breakfast'], [10, 29, 'breakfast'], [10, 30, 'lunch'],
    [14, 59, 'lunch'], [15, 0, 'snack'], [16, 59, 'snack'], [17, 0, 'dinner'], [21, 59, 'dinner'], [22, 0, 'snack'],
  ])('%i:%i -> %s', (h, m, slot) => {
    expect(slotForTime(new Date(2026, 4, 6, h, m))).toBe(slot)
  })
})

describe('task due dates', () => {
  it('today / tonight / tomorrow aliases', () => {
    expect(task('x today').due).toBe('2026-05-06')
    expect(task('x tonight').due).toBe('2026-05-06')
    expect(task('x tomorrow').due).toBe('2026-05-07')
    expect(task('x tmrw').due).toBe('2026-05-07')
    expect(task('x tmr').due).toBe('2026-05-07')
  })
  it('yesterday gives the previous day and is removed from the title', () => {
    expect(task('submit timesheet yesterday')).toMatchObject({ title: 'submit timesheet', due: '2026-05-05' })
    expect(task('yesterday call vendor').due).toBe('2026-05-05')
  })
  it('yesterday crosses month boundaries', () => {
    expect(task('x yesterday', { now: new Date(2026, 2, 1) }).due).toBe('2026-02-28')
  })
  it('weekday names resolve to the next such day, strictly after today', () => {
    expect(task('x fri').due).toBe('2026-05-08')
    expect(task('x friday').due).toBe('2026-05-08')
    expect(task('x wed').due).toBe('2026-05-13') // today is Wednesday -> next week
    expect(task('x mon').due).toBe('2026-05-11')
    expect(task('x sun').due).toBe('2026-05-10')
  })
  it('fri on a Friday means next Friday', () => {
    const friday = { now: new Date(2026, 4, 8, 9) }
    expect(task('report fri', friday)).toMatchObject({ title: 'report', due: '2026-05-15' })
  })
  it('ambiguous sat is read as Saturday (documented behavior)', () => {
    expect(task('sat').due).toBe('2026-05-09')
    expect(task('sat').title).toBe('')
    expect(task('book table sat').due).toBe('2026-05-09')
  })
  it('weekday words with trailing punctuation', () => {
    expect(task('x friday.').due).toBe('2026-05-08')
    expect(task('x tomorrow!').due).toBe('2026-05-07')
  })
  it('next week -> next Monday; next weekday; next month -> first of next month', () => {
    expect(task('x next week')).toMatchObject({ title: 'x', due: '2026-05-11' })
    expect(task('x next tue').due).toBe('2026-05-12')
    expect(task('x next month').due).toBe('2026-06-01')
  })
  it('next month from Dec rolls the year; from Jan 31 does not skip February', () => {
    expect(task('x next month', { now: new Date(2026, 11, 15) }).due).toBe('2027-01-01')
    expect(task('x next month', { now: new Date(2026, 0, 31) }).due).toBe('2026-02-01')
  })
  it('in N units, short and long forms', () => {
    expect(task('x in 3d').due).toBe('2026-05-09')
    expect(task('x in 2w').due).toBe('2026-05-20')
    expect(task('x in 1m').due).toBe('2026-06-06')
    expect(task('x in 3 days')).toMatchObject({ title: 'x', due: '2026-05-09' })
    expect(task('x in 1 day').due).toBe('2026-05-07')
    expect(task('x in 2 weeks').due).toBe('2026-05-20')
    expect(task('x in 2 months').due).toBe('2026-07-06')
  })
  it('in 1 month at month-end clamps', () => {
    expect(task('x in 1m', { now: new Date(2026, 0, 31) }).due).toBe('2026-02-28')
  })
  it('"in" without a number stays in the title', () => {
    expect(task('check in with team')).toMatchObject({ title: 'check in with team', due: undefined })
    expect(task('x in 3 apples')).toMatchObject({ due: undefined })
  })
  it('ISO dates', () => {
    expect(task('x 2026-12-25').due).toBe('2026-12-25')
    expect(task('x 2026-1-5').due).toBe('2026-01-05')
  })
  it('m/d dates: future stays this year, past rolls to next year', () => {
    expect(task('x 12/25').due).toBe('2026-12-25')
    expect(task('x 3/1').due).toBe('2027-03-01')
    expect(task('x 5/6').due).toBe('2026-05-06') // today is not past
  })
  it('m/d/y dates, two- and four-digit years', () => {
    expect(task('x 3/1/26').due).toBe('2026-03-01')
    expect(task('x 3/1/2030').due).toBe('2030-03-01')
  })
  it('invalid m/d is left in the title', () => {
    expect(task('x 13/40')).toMatchObject({ title: 'x 13/40', due: undefined })
  })
  it('drops dangling on/by/due before the date', () => {
    expect(task('send invoice by friday')).toMatchObject({ title: 'send invoice', due: '2026-05-08' })
    expect(task('pay rent due 6/1')).toMatchObject({ title: 'pay rent', due: '2026-06-01' })
    expect(task('call on tomorrow').title).toBe('call')
  })
  it('only the first date wins; later date words stay in the title', () => {
    expect(task('move from today to friday')).toMatchObject({ due: '2026-05-06', title: 'move from to friday' })
  })
  it('month-end context', () => {
    const jan31 = { now: new Date(2026, 0, 31, 9) } // Saturday
    expect(task('x tomorrow', jan31).due).toBe('2026-02-01')
    expect(task('x mon', jan31).due).toBe('2026-02-02')
    expect(task('x in 1d', { now: new Date(2028, 1, 28) }).due).toBe('2028-02-29')
  })
})

describe('priority and recurrence', () => {
  it('!1 !2 !3', () => {
    expect(task('x !1').priority).toBe(1)
    expect(task('x !3').priority).toBe(3)
    expect(task('x !2').priority).toBe(2)
    expect(task('!1 call boss')).toMatchObject({ priority: 1, title: 'call boss' })
  })
  it('!4 is not a priority', () => {
    expect(task('x !4')).toMatchObject({ priority: 2, title: 'x !4' })
  })
  it('every day/week/month', () => {
    expect(task('stretch every day').recurrence).toBe('daily')
    expect(task('review every week').recurrence).toBe('weekly')
    expect(task('pay rent every month')).toMatchObject({ recurrence: 'monthly', title: 'pay rent' })
  })
  it('every weekday is weekly and sets the first due date (today counts)', () => {
    expect(task('trash every wed')).toMatchObject({ recurrence: 'weekly', due: '2026-05-06', title: 'trash' })
    expect(task('trash every friday')).toMatchObject({ recurrence: 'weekly', due: '2026-05-08' })
  })
  it('an explicit earlier date is kept for every weekday', () => {
    expect(task('trash tomorrow every friday').due).toBe('2026-05-07')
  })
  it('"every" followed by something else is plain text', () => {
    expect(task('every now and then')).toMatchObject({ recurrence: 'none', title: 'every now and then' })
  })
  it('combined', () => {
    expect(task('pay rent every month !1 on 6/1')).toMatchObject({ title: 'pay rent', recurrence: 'monthly', priority: 1, due: '2026-06-01' })
  })
})

describe('goal tags', () => {
  const goals: CaptureGoal[] = [
    { id: 1, title: 'Run a half marathon', area: 'health', horizon: 'year' },
    { id: 2, title: 'Get promoted', area: 'career', horizon: 'life' },
    { id: 3, title: 'Q3 pipeline', area: 'career', horizon: 'quarter' },
  ]
  const g = { now: NOW, goals }
  it('matches by title fragment', () => {
    expect(task('long run #marathon', g)).toMatchObject({ goalId: 1, goalTitle: 'Run a half marathon', title: 'long run' })
  })
  it('hyphens in tags match spaces', () => {
    expect(task('x #half-marathon', g).goalId).toBe(1)
  })
  it('falls back to area, preferring the shortest horizon', () => {
    expect(task('x #career', g).goalId).toBe(3)
  })
  it('unknown tag stays in the title', () => {
    expect(task('x #nothing', g)).toMatchObject({ goalId: undefined, title: 'x #nothing' })
  })
  it('only the first resolvable tag links', () => {
    const t = task('x #marathon #career', g)
    expect(t.goalId).toBe(1)
    expect(t.title).toBe('x #career')
  })
  it('matchGoal edge cases', () => {
    expect(matchGoal('', goals)).toBeUndefined()
    expect(matchGoal('!!!', goals)).toBeUndefined()
    expect(matchGoal('finance', goals)).toBeUndefined() // area with no goals
  })
})

describe('describeCapture', () => {
  it('summarises each kind', () => {
    expect(describeCapture(parseCapture('', ctx), ctx)).toEqual([])
    expect(describeCapture(parseCapture('x tomorrow !1 every week', ctx), ctx)).toEqual(['Task', 'Tomorrow', 'High', 'Weekly'])
    expect(describeCapture(parseCapture('x today', ctx), ctx)).toEqual(['Task', 'Today'])
    expect(describeCapture(parseCapture('x fri !3', ctx), ctx)).toEqual(['Task', expect.any(String), 'Low'])
    expect(describeCapture(parseCapture('-$5 gum', ctx), ctx)).toEqual(['Expense', '$5.00'])
    expect(describeCapture(parseCapture('+$5 gift', ctx), ctx)).toEqual(['Income', '$5.00'])
    expect(describeCapture(parseCapture('ate toast 100cal', ctx), ctx)).toEqual(['Meal', 'Breakfast', '100 cal'])
    expect(describeCapture(parseCapture('win: x #health', ctx), ctx)).toEqual(['Win', 'Health'])
  })
})

describe('meals logged for yesterday', () => {
  it('uses the previous day as the date', () => {
    expect(parseCapture('ate pizza 600cal yesterday', ctx)).toMatchObject({ kind: 'meal', name: 'pizza', calories: 600, date: '2026-05-05' })
  })
})

describe('parseTask: names that look like date words', () => {
  it('"Call Tom" is a name, not tomorrow', () => {
    const t = task('Call Tom')
    expect(t.due).toBeUndefined()
    expect(t.title).toBe('Call Tom')
  })
})
