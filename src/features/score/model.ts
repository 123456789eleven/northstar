// Pure scoreboard logic: season standing against your own weeks, personal records, the ghost (best week and month), and
// "up next". Everything derives from rows the app already holds. Nothing is stored, nothing is a points currency.
import { addDays, daysBetween, formatDate, money, monthKey, startOfWeek } from '../../lib/dates'
import type { Badge } from '../badges/badges'
import { netWorthSeries } from '../badges/badges'
import type { NextTrophy } from '../you/trophies'

export interface ScoreSnapshot {
  /** Local YYYY-MM-DD. */
  today: string
  events: { kind: string; at: string; title: string; milestone: boolean }[]
  balances: { date: string; kind: 'asset' | 'liability'; balance: number }[]
  /** Positive = money in, negative = money out. */
  transactions: { date: string; amount: number; category: string }[]
  budgets: { category: string; monthlyLimit: number }[]
  tasksDone: string[]
  habitLogs: string[]
  weights: { date: string; weight: number }[]
  /** Target of the active weight goal, if any. */
  weightTarget?: number
  interactions: { personId: number; date: string }[]
  people: { id: number; name: string }[]
  journalDates: string[]
  study: { date: string; minutes: number }[]
}

export const EMPTY_SNAPSHOT = (today: string): ScoreSnapshot => ({
  today, events: [], balances: [], transactions: [], budgets: [], tasksDone: [], habitLogs: [], weights: [],
  interactions: [], people: [], journalDates: [], study: [],
})

const day = (s: string) => s.slice(0, 10)
const r1 = (n: number) => Math.round(n * 10) / 10
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)
const FULL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
const monthOf = (d: string) => d.slice(0, 7)
const monthLabel = (m: string) => formatDate(`${m}-01`, { month: 'short', year: 'numeric' })
const lastDayOfMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${m}-${String(new Date(y, mo, 0).getDate()).padStart(2, '0')}` }

function bump(m: Map<string, number>, k: string, n = 1) { m.set(k, (m.get(k) ?? 0) + n) }
function uniqSorted(xs: string[]) { return [...new Set(xs)].sort() }

// ---- weekly rows -------------------------------------------------------------------------------------------------

export interface WeekRow {
  weekOf: string
  tasks: number
  habits: number
  journal: number
  study: number
  people: number
  workouts: number
  weighIns: number
  wins: number
  /** Net money in minus out; undefined when no transaction landed that week. */
  saved?: number
  /** Count of things done, any area. */
  actions: number
}

export function buildWeeks(s: ScoreSnapshot): WeekRow[] {
  const wk = (d: string) => startOfWeek(day(d))
  const tasks = new Map<string, number>(), habits = new Map<string, number>(), journal = new Map<string, number>()
  const study = new Map<string, number>(), studyN = new Map<string, number>(), workouts = new Map<string, number>()
  const weigh = new Map<string, number>(), wins = new Map<string, number>(), saved = new Map<string, number>()
  const peopleSets = new Map<string, Set<number>>()
  s.tasksDone.forEach((d) => bump(tasks, wk(d)))
  s.habitLogs.forEach((d) => bump(habits, wk(d)))
  uniqSorted(s.journalDates.map(day)).forEach((d) => bump(journal, wk(d)))
  s.study.forEach((x) => { bump(study, wk(x.date), x.minutes); bump(studyN, wk(x.date)) })
  s.weights.forEach((w) => bump(weigh, wk(w.date)))
  s.events.forEach((e) => {
    if (e.kind === 'workout.logged') bump(workouts, wk(e.at))
    if (e.kind === 'career.win' || e.kind === 'win') bump(wins, wk(e.at))
  })
  s.transactions.forEach((t) => bump(saved, wk(t.date), t.amount))
  s.interactions.forEach((i) => {
    const k = wk(i.date)
    if (!peopleSets.has(k)) peopleSets.set(k, new Set())
    peopleSets.get(k)!.add(i.personId)
  })
  const keys = new Set<string>([...tasks.keys(), ...habits.keys(), ...journal.keys(), ...study.keys(), ...workouts.keys(), ...weigh.keys(), ...wins.keys(), ...saved.keys(), ...peopleSets.keys()])
  if (!keys.size) return []
  const first = [...keys].sort()[0]
  const last = startOfWeek(s.today)
  const rows: WeekRow[] = []
  for (let w = first; w <= last; w = addDays(w, 7)) {
    const r: WeekRow = {
      weekOf: w, tasks: tasks.get(w) ?? 0, habits: habits.get(w) ?? 0, journal: journal.get(w) ?? 0, study: study.get(w) ?? 0,
      people: peopleSets.get(w)?.size ?? 0, workouts: workouts.get(w) ?? 0, weighIns: weigh.get(w) ?? 0, wins: wins.get(w) ?? 0,
      saved: saved.has(w) ? saved.get(w) : undefined, actions: 0,
    }
    r.actions = r.tasks + r.habits + r.journal + (studyN.get(w) ?? 0) + r.people + r.workouts + r.weighIns + r.wins
    rows.push(r)
  }
  return rows
}

// ---- standing ----------------------------------------------------------------------------------------------------

export type FormMark = 'full' | 'half' | 'empty'

export interface StandingInput {
  id: 'money' | 'body' | 'habits' | 'people' | 'career' | 'learning'
  label: string
  /** What the quarter looked like, in plain numbers. */
  value: string
  /** 0..1 average of the quarter's weeks against the year's weeks; null when this area has no data. */
  pct: number | null
  href: string
}

export interface Standing {
  status: 'empty' | 'building' | 'ready'
  weeksOfData: number
  quarter: string
  /** "Top 15%" as a number; null until there is enough history. */
  topPct: number | null
  headline: string
  sub: string
  inputs: StandingInput[]
  form: FormMark[]
  formWeeks: string[]
}

type Dom = StandingInput['id']
const DOMS: { id: Dom; label: string; href: string; get: (w: WeekRow) => number | undefined }[] = [
  { id: 'money', label: 'Money', href: '/finance', get: (w) => w.saved },
  { id: 'body', label: 'Body', href: '/body', get: (w) => w.weighIns + w.workouts },
  { id: 'habits', label: 'Habits', href: '/habits', get: (w) => w.habits + w.journal },
  { id: 'people', label: 'People', href: '/people', get: (w) => w.people },
  { id: 'career', label: 'Career and tasks', href: '/tasks', get: (w) => w.tasks + w.wins },
  { id: 'learning', label: 'Learning', href: '/learning', get: (w) => w.study },
]

/** Share of `pool` this value beats; ties count half; zero never beats anything. */
function rank(v: number, pool: number[]): number {
  if (!pool.length) return 0
  if (v <= 0) return 0
  const less = pool.filter((x) => x < v).length
  const eq = pool.filter((x) => x === v).length
  return (less + 0.5 * Math.max(0, eq - 1)) / pool.length
}

export function quarterStart(today: string): string {
  const [y, m] = today.split('-').map(Number)
  return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
}
const quarterName = (today: string) => `Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1} ${today.slice(0, 4)}`

export function computeStanding(s: ScoreSnapshot): Standing {
  const all = buildWeeks(s)
  const thisWeek = startOfWeek(s.today)
  const year = all.filter((w) => w.weekOf > addDays(thisWeek, -7 * 52))
  const done = year.filter((w) => w.weekOf < thisWeek)
  const quarter = quarterName(s.today)
  const base = { quarter, topPct: null as number | null, inputs: [] as StandingInput[], form: [] as FormMark[], formWeeks: [] as string[] }
  const dataWeeks = done.filter((w) => w.actions > 0 || w.saved !== undefined).length
  if (dataWeeks < 1) {
    return { ...base, status: 'empty', weeksOfData: 0, headline: 'No standing yet.', sub: 'Finish a week of tasks, habits, weigh-ins or money and your first standing lands here.' }
  }
  // Per-domain pools, only for areas that have ever had data.
  const live = DOMS.filter((d) => done.some((w) => (d.get(w) ?? 0) !== 0))
  const pools = new Map<Dom, number[]>()
  live.forEach((d) => pools.set(d.id, done.map((w) => d.get(w)).filter((v): v is number => v !== undefined)))
  const composite = (w: WeekRow) => {
    const parts = live.map((d) => { const v = d.get(w); return v === undefined ? null : rank(v, pools.get(d.id)!) }).filter((x): x is number => x !== null)
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0
  }
  const qStart = quarterStart(s.today)
  let qWeeks = done.filter((w) => addDays(w.weekOf, 6) >= qStart)
  let scope = quarter
  if (qWeeks.length < 3) { qWeeks = done.slice(-8); scope = 'the last 8 weeks' }
  const last8 = done.slice(-8)
  const form = last8.map((w): FormMark => {
    const c = w.actions > 0 || w.saved !== undefined ? composite(w) : 0
    return c >= 0.6 ? 'full' : c >= 0.3 ? 'half' : 'empty'
  })
  const formWeeks = last8.map((w) => w.weekOf)
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
  const qAvg = avg(qWeeks.map(composite))
  const inputs: StandingInput[] = DOMS.map((d) => {
    const isLive = live.some((l) => l.id === d.id)
    const vals = qWeeks.map((w) => d.get(w)).filter((v): v is number => v !== undefined)
    const sum = vals.reduce((a, b) => a + b, 0)
    const pct = isLive && vals.length ? avg(vals.map((v) => rank(v, pools.get(d.id)!))) : null
    const wk = qWeeks.length
    const value = !isLive ? 'No data yet'
      : d.id === 'money' ? `${money(sum)} net over ${wk} ${plural(wk, 'week')}`
      : d.id === 'body' ? `${sum} weigh-ins and workouts`
      : d.id === 'habits' ? `${sum} habit ticks and journal days`
      : d.id === 'people' ? `${sum} ${plural(sum, 'person', 'people')} reached, counted by week`
      : d.id === 'career' ? `${sum} tasks and wins`
      : `${sum} study minutes`
    return { id: d.id, label: d.label, value, pct, href: d.href }
  })
  if (dataWeeks < 4) {
    return { ...base, status: 'building', weeksOfData: dataWeeks, inputs, form, formWeeks, headline: `Week ${dataWeeks} on the board.`, sub: `Standing starts at 4 finished weeks, so it has a real history to measure against. ${4 - dataWeeks} to go.` }
  }
  const topPct = Math.min(99, Math.max(1, Math.round((1 - qAvg) * 100)))
  return {
    ...base, status: 'ready', weeksOfData: dataWeeks, topPct, inputs, form, formWeeks,
    headline: `Top ${topPct}% of your weeks`,
    sub: `${scope} measured against your last ${done.length} finished ${plural(done.length, 'week')}. Only you in the table.`,
  }
}

// ---- records -----------------------------------------------------------------------------------------------------

export type RecordDomain = 'Money' | 'Body' | 'People' | 'Consistency' | 'Learning' | 'Career and tasks'

export interface ScoreRecord {
  id: string
  label: string
  domain: RecordDomain
  value: number
  display: string
  /** Day the record was set (end of the period). */
  date: string
  dateLabel: string
  current: number
  /** One line toward the next record. */
  hint: string
  /** current / value, 0..1. */
  progress: number
  /** The last few periods ending at the record, for a small visual. */
  series: number[]
  href: string
  /** True when the current period holds the record right now. */
  holding: boolean
}

interface Best { key: string; value: number }
function best(m: Map<string, number>): Best | null {
  let b: Best | null = null
  for (const [key, value] of m) if (value > 0 && (!b || value > b.value || (value === b.value && key > b.key))) b = { key, value }
  return b
}
function tail(m: Map<string, number>, upTo: string, n = 8): number[] {
  return [...m.entries()].filter(([k]) => k <= upTo).sort((a, b) => a[0].localeCompare(b[0])).slice(-n).map(([, v]) => v)
}

export function runInfo(dates: string[], today: string): { best: number; bestEnd?: string; current: number; series: number[] } {
  const s = uniqSorted(dates.map(day))
  let run = 0, bestLen = 0, bestEnd: string | undefined
  const runs: number[] = []
  for (let i = 0; i < s.length; i++) {
    run = i > 0 && daysBetween(s[i - 1], s[i]) === 1 ? run + 1 : 1
    if (i === s.length - 1 || daysBetween(s[i], s[i + 1]) !== 1) runs.push(run)
    if (run >= bestLen) { bestLen = run; bestEnd = s[i] }
  }
  const lastD = s[s.length - 1]
  const alive = lastD !== undefined && daysBetween(lastD, today) <= 1
  return { best: bestLen, bestEnd, current: alive ? run : 0, series: runs.slice(-8) }
}

const nextMonth = (m: string) => monthKey(addDays(lastDayOfMonth(m), 1))

function budgetMonths(s: ScoreSnapshot): { month: string; under: boolean }[] {
  if (!s.budgets.length) return []
  const spend = new Map<string, Map<string, number>>()
  s.transactions.forEach((t) => {
    if (t.amount >= 0) return
    const m = monthOf(t.date)
    if (!spend.has(m)) spend.set(m, new Map())
    bump(spend.get(m)!, t.category, -t.amount)
  })
  const thisMonth = monthOf(s.today)
  return [...spend.keys()].filter((m) => m < thisMonth).sort().map((m) => ({
    month: m, under: s.budgets.every((b) => (spend.get(m)!.get(b.category) ?? 0) <= b.monthlyLimit + 1e-9),
  }))
}

export function computeRecords(s: ScoreSnapshot): ScoreRecord[] {
  const out: ScoreRecord[] = []
  const thisWeek = startOfWeek(s.today)
  const thisMonth = monthOf(s.today)
  const weeks = buildWeeks(s)
  const wmap = (f: (w: WeekRow) => number) => new Map(weeks.map((w) => [w.weekOf, f(w)]))
  const weekEnd = (w: string) => addDays(w, 6)
  const push = (r: Omit<ScoreRecord, 'dateLabel' | 'progress' | 'holding'> & { progress?: number }) =>
    out.push({ ...r, dateLabel: formatDate(r.date, FULL), progress: r.progress ?? (r.value > 0 ? Math.min(1, r.current / r.value) : 0), holding: r.current >= r.value && r.value > 0 })
  const togo = (cur: number, rec: number, fmt: (n: number) => string, unit: string) =>
    cur >= rec ? 'You are level with this one right now.' : `${fmt(rec - cur)} ${unit} to match it.`

  // Money: best saving month.
  const byMonth = new Map<string, number>()
  s.transactions.forEach((t) => bump(byMonth, monthOf(t.date), t.amount))
  const bm = best(byMonth)
  if (bm) {
    const cur = Math.max(0, byMonth.get(thisMonth) ?? 0)
    push({
      id: 'saving-month', label: 'Best saving month', domain: 'Money', value: bm.value, display: money(bm.value), date: lastDayOfMonth(bm.key), current: cur,
      series: tail(byMonth, bm.key), href: '/finance',
      hint: bm.key === thisMonth ? 'This month is setting it.' : `${money(cur)} so far this month. ${togo(cur, bm.value, money, 'more')}`,
    })
  }

  // Money: longest under-budget run (completed months).
  const bms = budgetMonths(s)
  if (bms.length) {
    let run = 0, bestRun = 0, bestEnd = ''
    const runs: number[] = []
    bms.forEach((x, i) => {
      run = x.under ? (i > 0 && bms[i - 1].under && nextMonth(bms[i - 1].month) === x.month ? run + 1 : 1) : 0
      runs.push(run)
      if (run >= bestRun && run > 0) { bestRun = run; bestEnd = x.month }
    })
    const lastM = bms[bms.length - 1]
    const cur = lastM.under && nextMonth(lastM.month) === thisMonth ? run : 0
    if (bestRun > 0) {
      push({
        id: 'under-budget', label: 'Longest under-budget run', domain: 'Money', value: bestRun, display: `${bestRun} ${plural(bestRun, 'month')}`,
        date: lastDayOfMonth(bestEnd), current: cur, series: runs.slice(-8), href: '/finance?tab=budgets',
        hint: cur >= bestRun ? 'You are level with this one right now.' : `Current run ${cur}. ${bestRun - cur} more ${plural(bestRun - cur, 'month')} to match it.`,
      })
    }
  }

  // Money: net worth high.
  const nw = netWorthSeries(s.balances)
  if (nw.length) {
    let top = nw[0]
    nw.forEach((p) => { if (p.total >= top.total) top = p })
    const cur = nw[nw.length - 1].total
    if (top.total > 0) {
      push({
        id: 'net-worth', label: 'Net worth high', domain: 'Money', value: top.total, display: money(top.total), date: top.date, current: Math.max(0, cur),
        series: nw.filter((p) => p.date <= top.date).slice(-8).map((p) => p.total), href: '/finance?tab=networth',
        hint: cur >= top.total ? 'The latest snapshot is the high.' : `${money(top.total - cur)} below it on the latest snapshot.`,
      })
    }
  }

  // Tasks: most in a week.
  const tw = wmap((w) => w.tasks)
  const bt = best(tw)
  if (bt) {
    const cur = tw.get(thisWeek) ?? 0
    push({
      id: 'tasks-week', label: 'Most tasks in a week', domain: 'Career and tasks', value: bt.value, display: `${bt.value} ${plural(bt.value, 'task')}`,
      date: weekEnd(bt.key), current: cur, series: tail(tw, bt.key), href: '/tasks',
      hint: bt.key === thisWeek ? 'This week is setting it.' : `${cur} so far this week. ${togo(cur, bt.value, String, 'more')}`,
    })
  }

  // Consistency: longest run of days with anything logged.
  const active = [...s.tasksDone, ...s.habitLogs, ...s.journalDates, ...s.study.map((x) => x.date), ...s.interactions.map((i) => i.date), ...s.weights.map((w) => w.date), ...s.events.map((e) => e.at)]
  const ri = runInfo(active, s.today)
  if (ri.best >= 2 && ri.bestEnd) {
    push({
      id: 'consistency-run', label: 'Longest consistency run', domain: 'Consistency', value: ri.best, display: `${ri.best} days`, date: ri.bestEnd, current: ri.current,
      series: ri.series, href: '/habits',
      hint: ri.current >= ri.best ? 'You are level with this one right now.' : `Current run ${ri.current} ${plural(ri.current, 'day')}. ${ri.best - ri.current} more to match it.`,
    })
  }

  // Body: furthest toward target, else lowest weigh-in.
  const ws = [...s.weights].sort((a, b) => a.date.localeCompare(b.date))
  if (ws.length >= 2) {
    const first = ws[0].weight, latest = ws[ws.length - 1].weight
    const dir = s.weightTarget !== undefined ? (s.weightTarget >= first ? 1 : -1) : -1
    const gain = (w: number) => (w - first) * dir
    let top = ws[0]
    ws.forEach((w) => { if (gain(w.weight) >= gain(top.weight)) top = w })
    const g = gain(top.weight)
    if (g > 0) {
      const cur = Math.max(0, gain(latest))
      push({
        id: 'weight', label: s.weightTarget !== undefined ? 'Furthest toward your target' : 'Lowest weigh-in', domain: 'Body', value: r1(g),
        display: s.weightTarget !== undefined ? `${r1(g)} lb from the start` : `${r1(top.weight)} lb`, date: top.date, current: r1(cur),
        series: ws.filter((w) => w.date <= top.date).slice(-8).map((w) => w.weight), href: '/body',
        hint: cur >= g - 1e-9 ? 'The latest weigh-in is the best.' : `${r1(g - cur)} lb from matching it.`, progress: Math.min(1, cur / g),
      })
    }
  }

  // People: most people reached in a month.
  const ppl = new Map<string, Set<number>>()
  s.interactions.forEach((i) => {
    const m = monthOf(i.date)
    if (!ppl.has(m)) ppl.set(m, new Set())
    ppl.get(m)!.add(i.personId)
  })
  const pm = new Map([...ppl].map(([k, v]) => [k, v.size]))
  const bp = best(pm)
  if (bp) {
    const cur = pm.get(thisMonth) ?? 0
    push({
      id: 'people-month', label: 'Most people reached in a month', domain: 'People', value: bp.value, display: `${bp.value} ${plural(bp.value, 'person', 'people')}`,
      date: lastDayOfMonth(bp.key), current: cur, series: tail(pm, bp.key), href: '/people',
      hint: bp.key === thisMonth ? 'This month is setting it.' : `${cur} so far this month. ${togo(cur, bp.value, String, 'more')}`,
    })
  }

  // Journal run.
  const jr = runInfo(s.journalDates, s.today)
  if (jr.best >= 2 && jr.bestEnd) {
    push({
      id: 'journal-run', label: 'Longest journal run', domain: 'Consistency', value: jr.best, display: `${jr.best} days`, date: jr.bestEnd, current: jr.current,
      series: jr.series, href: '/journal',
      hint: jr.current >= jr.best ? 'You are level with this one right now.' : `Current run ${jr.current} ${plural(jr.current, 'day')}. ${jr.best - jr.current} more to match it.`,
    })
  }

  // Learning: most minutes in a week.
  const sw = wmap((w) => w.study)
  const bs = best(sw)
  if (bs) {
    const cur = sw.get(thisWeek) ?? 0
    push({
      id: 'study-week', label: 'Most study minutes in a week', domain: 'Learning', value: bs.value, display: `${bs.value} min`, date: weekEnd(bs.key), current: cur,
      series: tail(sw, bs.key), href: '/learning',
      hint: bs.key === thisWeek ? 'This week is setting it.' : `${cur} min so far this week. ${togo(cur, bs.value, String, 'more')}`,
    })
  }

  return out
}

// ---- ghost -------------------------------------------------------------------------------------------------------

export interface GhostLine {
  period: 'Week' | 'Month'
  now: number
  last: number
  best: number
  bestLabel: string
  /** One calm sentence. */
  note: string
}

export function computeGhost(s: ScoreSnapshot): { week: GhostLine; month: GhostLine; hasData: boolean } {
  const weeks = buildWeeks(s)
  const thisWeek = startOfWeek(s.today)
  const lastWeek = addDays(thisWeek, -7)
  const wNow = weeks.find((w) => w.weekOf === thisWeek)?.actions ?? 0
  const wLast = weeks.find((w) => w.weekOf === lastWeek)?.actions ?? 0
  let wb: WeekRow | undefined
  weeks.forEach((w) => { if (!wb || w.actions >= wb.actions) wb = w })
  const months = new Map<string, number>()
  // A week belongs to the month its Monday falls in; close enough for a comparison of totals.
  weeks.forEach((w) => bump(months, monthOf(w.weekOf), w.actions))
  const tm = monthOf(s.today)
  const lm = monthOf(addDays(`${tm}-01`, -1))
  const mNow = months.get(tm) ?? 0, mLast = months.get(lm) ?? 0
  const mb = best(months)
  const line = (period: 'Week' | 'Month', now: number, last: number, bestV: number, bestLabel: string): GhostLine => {
    const p = period.toLowerCase()
    const note = bestV === 0 ? `Nothing to compare yet. Finish a ${p} and your ghost appears.`
      : now >= bestV ? `Level with or ahead of your best ${p}.`
      : `${bestV - now} more to match your best ${p}.`
    return { period, now, last, best: bestV, bestLabel, note }
  }
  const wbLabel = wb && wb.actions > 0 ? `week of ${formatDate(wb.weekOf)}` : 'none yet'
  return {
    hasData: weeks.length > 0,
    week: line('Week', wNow, wLast, wb?.actions ?? 0, wbLabel),
    month: line('Month', mNow, mLast, mb?.value ?? 0, mb ? monthLabel(mb.key) : 'none yet'),
  }
}

// ---- up next -----------------------------------------------------------------------------------------------------

export interface UpNext { id: string; title: string; hint: string; progress: number; href: string; source: 'record' | 'badge' | 'milestone' }

/** The things closest to a record, a badge or a milestone. */
export function deriveUpNext(records: ScoreRecord[], badges: Badge[], trophies: NextTrophy[], max = 3): UpNext[] {
  const c: UpNext[] = []
  records.forEach((r) => {
    if (!r.holding && r.value > 0 && r.current > 0) c.push({ id: `rec-${r.id}`, title: `Beat your ${r.label.toLowerCase()}`, hint: r.hint, progress: r.progress, href: r.href, source: 'record' })
  })
  badges.forEach((b) => {
    if (!b.earned && b.need > 0 && b.have > 0) c.push({ id: `badge-${b.id}`, title: b.title, hint: `${b.have} of ${b.need}. ${b.hint}`, progress: b.have / b.need, href: '/history', source: 'badge' })
  })
  trophies.forEach((t) => { if (t.progress < 1) c.push({ id: `ms-${t.id}`, title: t.title, hint: t.hint, progress: t.progress, href: t.href, source: 'milestone' }) })
  const seen = new Set<string>()
  return c.filter((x) => x.progress < 1).sort((a, b) => b.progress - a.progress)
    .filter((x) => { if (seen.has(x.title)) return false; seen.add(x.title); return true }).slice(0, max)
}
