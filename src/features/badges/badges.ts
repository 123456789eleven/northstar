// Pure badge derivation. A badge is a plain, dated fact computed from data the app already holds; nothing is stored
// and nothing is awarded. Reuses the ladders from the You hub so counts agree with Milestones.
import { addDays, daysBetween, startOfWeek } from '../../lib/dates'
import { LADDERS } from '../you/trophies'

export type BadgeMark =
  | 'scale' | 'dumbbell' | 'coin' | 'ring' | 'peak' | 'bars' | 'arrow' | 'gauge' | 'laurel' | 'book' | 'cap'
  | 'calendar' | 'weeks' | 'plate' | 'chain' | 'page' | 'check' | 'loop' | 'flag' | 'stack'

export type BadgeGroup = 'Body' | 'Money' | 'Career and learning' | 'Consistency'

export interface BadgeSnapshot {
  /** Local YYYY-MM-DD. */
  today: string
  weightDates: string[]
  mealDates: string[]
  journalDates: string[]
  habitLogDates: string[]
  /** Event timestamps (ISO) by kind, from the single timeline. */
  events: { kind: string; at: string }[]
  tasksDone: number
  budgetCount: number
  holdingCount: number
  contributions: { date: string; amount: number; kind: 'contribution' | 'withdrawal' }[]
  retirementLimit: number
  balances: { date: string; kind: 'asset' | 'liability'; balance: number }[]
  learningDone: { completedAt?: string }[]
  goalsDone: number
  reviews: number
}

export interface Badge {
  id: string
  title: string
  group: BadgeGroup
  mark: BadgeMark
  /** One plain line for an unearned badge. */
  hint: string
  /** What it means, shown in the sheet. */
  meaning: string
  earned: boolean
  /** YYYY-MM-DD when known. */
  earnedAt?: string
  have: number
  need: number
}

const day = (iso: string) => iso.slice(0, 10)
const uniqSorted = (xs: string[]) => [...new Set(xs)].sort()

/** Date on which the n-th item (1-based, sorted) happened, if it did. */
export function nthDate(dates: string[], n: number): string | undefined {
  const s = [...dates].map(day).sort()
  return s.length >= n ? s[n - 1] : undefined
}

/** End date of the first run of `len` consecutive days drawn from `dates`, if any. */
export function firstRun(dates: string[], len: number): string | undefined {
  const s = uniqSorted(dates.map(day))
  let run = 0
  for (let i = 0; i < s.length; i++) {
    run = i > 0 && daysBetween(s[i - 1], s[i]) === 1 ? run + 1 : 1
    if (run >= len) return s[i]
  }
  return undefined
}

/** Longest run of consecutive days, for progress. */
export function longestRun(dates: string[]): number {
  const s = uniqSorted(dates.map(day))
  let best = 0
  let run = 0
  for (let i = 0; i < s.length; i++) {
    run = i > 0 && daysBetween(s[i - 1], s[i]) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  }
  return best
}

/** End of the first stretch of `len` consecutive weeks that each have entries on at least `perWeek` different days. */
export function firstActiveWeeks(dates: string[], len: number, perWeek: number): { at?: string; best: number } {
  const days = uniqSorted(dates.map(day))
  const byWeek = new Map<string, number>()
  for (const d of days) byWeek.set(startOfWeek(d), (byWeek.get(startOfWeek(d)) ?? 0) + 1)
  const weeks = [...byWeek.entries()].filter(([, n]) => n >= perWeek).map(([w]) => w).sort()
  let run = 0
  let best = 0
  let at: string | undefined
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && daysBetween(weeks[i - 1], weeks[i]) === 7 ? run + 1 : 1
    best = Math.max(best, run)
    if (run >= len && !at) at = addDays(weeks[i], 6)
  }
  return { at, best }
}

/** Net worth per snapshot date (assets minus liabilities), oldest first. */
export function netWorthSeries(balances: BadgeSnapshot['balances']): { date: string; total: number }[] {
  const m = new Map<string, number>()
  for (const b of balances) m.set(b.date, (m.get(b.date) ?? 0) + (b.kind === 'liability' ? -b.balance : b.balance))
  return [...m.entries()].map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date))
}

/** Day the running contribution total within one calendar year first reached the limit, and the best year total. */
export function limitReachedOn(contribs: BadgeSnapshot['contributions'], limit: number): { at?: string; best: number } {
  const byYear = new Map<string, { date: string; amount: number }[]>()
  for (const c of contribs) {
    const sign = c.kind === 'withdrawal' ? -1 : 1
    const y = c.date.slice(0, 4)
    byYear.set(y, [...(byYear.get(y) ?? []), { date: c.date, amount: sign * c.amount }])
  }
  let at: string | undefined
  let best = 0
  for (const rows of byYear.values()) {
    rows.sort((a, b) => a.date.localeCompare(b.date))
    let sum = 0
    for (const r of rows) {
      sum += r.amount
      best = Math.max(best, sum)
      if (limit > 0 && sum >= limit && (!at || r.date < at)) at = r.date
    }
  }
  return { at, best }
}

function def(
  id: string, title: string, group: BadgeGroup, mark: BadgeMark, hint: string, meaning: string,
  have: number, need: number, earnedAt?: string,
): Badge {
  const earned = need > 0 && have >= need
  return { id, title, group, mark, hint, meaning, earned, earnedAt: earned ? earnedAt : undefined, have: Math.min(have, need), need }
}

export function deriveBadges(s: BadgeSnapshot): Badge[] {
  const ev = (kind: string | string[]) => {
    const kinds = Array.isArray(kind) ? kind : [kind]
    return s.events.filter((e) => kinds.includes(e.kind)).map((e) => e.at)
  }
  const workouts = ev('workout.logged')
  const wins = ev(['career.win', 'win'])
  const reviews = ev('review.done')
  const allDays = uniqSorted([
    ...s.events.map((e) => e.at), ...s.weightDates, ...s.mealDates, ...s.journalDates, ...s.habitLogDates,
  ].map(day))
  const contribs = s.contributions.filter((c) => c.kind === 'contribution').map((c) => c.date)
  const lim = limitReachedOn(s.contributions, s.retirementLimit)
  const nw = netWorthSeries(s.balances)
  let nwHigh: string | undefined
  let nwMax = -Infinity
  nw.forEach((p, i) => {
    if (i >= 2 && p.total > nwMax) nwHigh = p.date
    nwMax = Math.max(nwMax, p.total)
  })
  const nwPositive = nw.find((p) => p.total > 0)?.date
  const courses = s.learningDone.map((l) => l.completedAt).filter((x): x is string => !!x)
  const weeks = firstActiveWeeks(allDays, 4, 3)
  const weighDays = uniqSorted(s.weightDates.map(day))
  const limit = Math.round(s.retirementLimit)
  const L = LADDERS

  return [
    def('weigh-first', 'First weigh-in', 'Body', 'scale', 'Log one weigh-in.', 'You logged a weigh-in. The trend on the Body page starts from this number.', weighDays.length, 1, nthDate(weighDays, 1)),
    def('weigh-10', 'Ten weigh-ins', 'Body', 'scale', 'Log ten weigh-ins.', 'Ten dated weigh-ins give the trend line enough to show a real direction.', weighDays.length, 10, nthDate(weighDays, 10)),
    def('workout-first', 'First workout', 'Body', 'dumbbell', 'Log one workout.', 'A workout was logged.', workouts.length, L.workouts[0], nthDate(workouts, L.workouts[0])),
    def('workout-10', 'Ten workouts', 'Body', 'dumbbell', 'Log ten workouts.', 'Ten workouts logged in total, across any weeks.', workouts.length, L.workouts[1], nthDate(workouts, L.workouts[1])),
    def('workout-50', 'Fifty workouts', 'Body', 'dumbbell', 'Log fifty workouts.', 'Fifty workouts logged in total.', workouts.length, L.workouts[3], nthDate(workouts, L.workouts[3])),
    def('meals-week', 'A week of meals', 'Body', 'plate', 'Log meals on seven days in a row.', 'Meals were logged every day for seven days running.', longestRun(s.mealDates), 7, firstRun(s.mealDates, 7)),
    def('budget-first', 'First budget', 'Money', 'gauge', 'Set one monthly budget.', 'A monthly limit now exists for a spending category.', s.budgetCount, 1, nthDate(ev('finance.budget'), 1)),
    def('budget-5', 'Five budgets', 'Money', 'bars', 'Set budgets for five categories.', 'Five categories each have a monthly limit.', s.budgetCount, 5, nthDate(ev('finance.budget'), 5)),
    def('holding-first', 'First holding', 'Money', 'stack', 'Add one holding.', 'A holding is tracked, so investments count toward net worth.', s.holdingCount, 1),
    def('retire-first', 'First retirement contribution', 'Money', 'arrow', 'Log one contribution.', 'The first contribution to a retirement account was logged.', contribs.length, 1, nthDate(contribs, 1)),
    def('retire-limit', 'Annual limit reached', 'Money', 'ring', `Contribute ${limit.toLocaleString('en-US')} in one calendar year.`,
      'Contributions in a single calendar year reached the annual limit.', Math.round(lim.best), limit, lim.at),
    def('nw-positive', 'Net worth above zero', 'Money', 'flag', 'Record balances that total more than zero.', 'Your recorded assets exceeded your liabilities.', nwPositive ? 1 : 0, 1, nwPositive),
    def('nw-high', 'Net worth high', 'Money', 'peak', 'Pass every earlier net worth snapshot, with three or more recorded.', 'Net worth passed every earlier snapshot.', nwHigh ? 1 : 0, 1, nwHigh),
    def('win-first', 'First career win', 'Career and learning', 'laurel', 'Log one career win.', 'A career win was recorded with its date.', wins.length, L.wins[0], nthDate(wins, L.wins[0])),
    def('win-5', 'Five career wins', 'Career and learning', 'laurel', 'Log five career wins.', 'Five wins are on file, enough to write a review from.', wins.length, L.wins[1], nthDate(wins, L.wins[1])),
    def('win-10', 'Ten career wins', 'Career and learning', 'laurel', 'Log ten career wins.', 'Ten career wins are on file.', wins.length, L.wins[2], nthDate(wins, L.wins[2])),
    def('course-first', 'First course finished', 'Career and learning', 'cap', 'Finish one course or book.', 'A learning item was marked done.', s.learningDone.length, 1, nthDate(courses, 1)),
    def('course-3', 'Three finished', 'Career and learning', 'book', 'Finish three courses or books.', 'Three learning items were marked done.', s.learningDone.length, 3, nthDate(courses, 3)),
    def('goal-first', 'First goal done', 'Career and learning', 'coin', 'Complete one goal.', 'A goal reached done.', s.goalsDone, 1, nthDate(ev('goal.done'), 1)),
    def('days-30', 'Thirty days with entries', 'Consistency', 'calendar', 'Have entries on thirty different days.', 'Thirty different days have something logged, in any area.', allDays.length, 30, nthDate(allDays, 30)),
    def('weeks-4', 'Four steady weeks', 'Consistency', 'weeks', 'Log on three or more days a week, four weeks running.', 'Four weeks in a row each had entries on at least three days.', weeks.best, 4, weeks.at),
    def('habit-7', 'Seven days of habits', 'Consistency', 'chain', 'Tick a habit on seven days in a row.', 'A habit was ticked every day for a week.', longestRun(s.habitLogDates), 7, firstRun(s.habitLogDates, 7)),
    def('journal-10', 'Ten journal entries', 'Consistency', 'page', 'Write ten journal entries.', 'Ten days have a journal entry.', uniqSorted(s.journalDates.map(day)).length, 10, nthDate(uniqSorted(s.journalDates.map(day)), 10)),
    def('tasks-100', 'One hundred tasks done', 'Consistency', 'check', 'Finish one hundred tasks.', 'One hundred tasks were completed in total.', s.tasksDone, L.tasks[2], nthDate(ev('task.done'), L.tasks[2])),
    def('review-first', 'First weekly recap', 'Consistency', 'loop', 'Finish a weekly review.', 'You closed out a week with a review.', Math.max(reviews.length, s.reviews), 1, nthDate(reviews, 1)),
  ]
}

export const earnedIds = (b: Badge[]) => b.filter((x) => x.earned).map((x) => x.id)
