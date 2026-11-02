// "Week in numbers": auto-filled from real data. Pure builder + a DB loader. No invented numbers: every item can be empty.
import { db, getSetting, type Goal, type Interaction, type ISODate, type JournalEntry } from '../../db'
import { addDays, today as todayISO } from '../../lib/dates'
import { isSpend } from '../finance/categories'
import { budgetMonth, computeMetric, daysMeetingTarget, goalMetric, studyMinutes, weightAverage, workoutDays, type MetricData } from '../progress/metrics'
import { loadMetricData } from '../progress/metricsData'

export interface NumberItem {
  key: string
  label: string
  value: string
  /** Plain-language one-liner. */
  note: string
  /** App route for the page behind the number. */
  href: string
  linkLabel: string
  /** True for the "no data" state. */
  empty: boolean
  /** Extra lines (goal movement). */
  lines?: string[]
}

/** Stored on the review row when the owner locks it (optional field, no schema change). */
export interface WeekSnapshot { savedAt: string; items: NumberItem[] }

export interface WeekInput {
  data: MetricData
  goals: Goal[]
  journal: JournalEntry[]
  interactions: Interaction[]
  trainDays: number
}

const round1 = (n: number) => Math.round(n * 10) / 10
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(round1(n))}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const money0 = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)

function item(key: string, label: string, href: string, linkLabel: string, value: string | null, note: string, empty = value == null): NumberItem {
  return { key, label, href, linkLabel, value: value ?? 'No data', note, empty }
}

export function buildWeekNumbers(input: WeekInput, weekOf: ISODate, now: ISODate = todayISO()): NumberItem[] {
  const { data, goals, journal, interactions } = input
  const weekEnd = addDays(weekOf, 6)
  const end = now < weekEnd ? now : weekEnd
  const span = Math.max(1, Math.round((Date.parse(end) - Date.parse(weekOf)) / 86_400_000) + 1)
  const out: NumberItem[] = []

  // Weight: 7-day average at the end of the week vs the 7 days before.
  const avgNow = weightAverage(data.weights, end)
  const avgPrev = weightAverage(data.weights, addDays(end, -7))
  if (avgNow == null) out.push(item('weight', 'Weight', '/body', 'Open Body', null, 'No weigh-ins in this week. Capture "weight 138.2" to log one.'))
  else if (avgPrev == null) out.push(item('weight', 'Weight', '/body', 'Open Body', `${round1(avgNow)} lb`, 'First week with weigh-ins, so no change to compare yet.'))
  else {
    const d = avgNow - avgPrev
    out.push(item('weight', 'Weight', '/body', 'Open Body', `${signed(d)} lb`, `7-day average ${round1(avgNow)} lb, a rate of ${signed(d)} lb per week.`))
  }

  // Protein / calorie days.
  for (const [key, label, field] of [['protein', 'Protein days', 'protein'], ['calories', 'Calorie days', 'calories']] as const) {
    const t = data.targets[field]
    if (!t || t <= 0) out.push(item(key, label, '/food', 'Open Food', null, `Set a ${field} target in Food to count these.`))
    else if (!data.meals.some((m) => m.date >= weekOf && m.date <= end)) out.push(item(key, label, '/food', 'Open Food', null, 'No meals logged this week.'))
    else {
      const n = daysMeetingTarget(data.meals, field, t, weekOf, end)
      out.push(item(key, label, '/food', 'Open Food', `${n} of ${span}`, `You reached at least 95% of your ${field} target on ${plural(n, 'day')}.`))
    }
  }

  // Workouts vs target.
  const hasWorkoutSource = data.habits.some((h) => !h.archived && /lift|workout|gym|train/i.test(h.name)) || data.events.some((e) => /workout|gym|lift/i.test(e.kind))
  if (!hasWorkoutSource) out.push(item('workouts', 'Workouts', '/habits', 'Open Habits', null, 'Add a lift or workout habit and check it in to count these.'))
  else {
    const n = workoutDays(data, weekOf, end)
    out.push(item('workouts', 'Workouts', '/habits', 'Open Habits', `${n} of ${input.trainDays}`, n >= input.trainDays ? 'You hit your weekly workout target.' : `${plural(input.trainDays - n, 'workout')} short of your weekly target.`, false))
  }

  // Study.
  const weekStudy = data.studySessions.filter((s) => s.date >= weekOf && s.date <= end)
  if (!weekStudy.length) out.push(item('study', 'Study', '/learning', 'Open Learning', null, 'No study sessions logged this week.'))
  else {
    const m = studyMinutes(weekStudy, weekOf, end)
    out.push(item('study', 'Study', '/learning', 'Open Learning', `${m} min`, `Across ${plural(weekStudy.length, 'session')}.`))
  }

  // Spending vs budget (this week's spend; month to date vs the monthly budget).
  const weekTx = data.transactions.filter((t) => t.date >= weekOf && t.date <= end)
  if (!weekTx.length) out.push(item('spend', 'Spending', '/finance', 'Open Finance', null, 'No transactions this week.'))
  else {
    const spent = weekTx.reduce((s, t) => (isSpend(t) ? s - t.amount : s), 0)
    const b = budgetMonth(data, end, end)
    const note = b.categories ? `Month so far: ${money0(b.spent)} of ${money0(b.limit)} budgeted${b.spent > b.limit ? ' (over)' : ''}.` : 'No budgets set, so nothing to compare against.'
    out.push(item('spend', 'Spending', '/finance', 'Open Finance', money0(spent), note))
  }

  // Journal.
  const entries = journal.filter((j) => j.date >= weekOf && j.date <= end)
  if (!entries.length) out.push(item('journal', 'Journal', '/journal', 'Open Journal', null, 'No entries this week.'))
  else {
    const w = entries.reduce((s, j) => s + words(j.text), 0)
    out.push(item('journal', 'Journal', '/journal', 'Open Journal', `${new Set(entries.map((j) => j.date)).size} of ${span} days`, `${w.toLocaleString('en-US')} words written.`))
  }

  // Contacts reached.
  const reached = new Set(interactions.filter((i) => i.date >= weekOf && i.date <= end).map((i) => i.personId))
  if (!reached.size) out.push(item('contacts', 'People reached', '/people', 'Open People', null, 'No contacts logged this week.'))
  else out.push(item('contacts', 'People reached', '/people', 'Open People', String(reached.size), `${plural(reached.size, 'different person', 'different people')} contacted.`))

  // Goal movement: cumulative metrics before vs after, plus milestones checked.
  const before = addDays(weekOf, -1)
  const lines: string[] = []
  for (const g of goals) {
    if (!g.metric || g.metric.source === 'manual') continue
    const win = g.metric.window
    const cumulative = g.metric.source === 'weight' || g.metric.source === 'net-worth' || win === 'goal'
    if (cumulative) {
      const a = computeMetric(g.metric, { ...data, today: before }, g.createdAt.slice(0, 10))
      const b = computeMetric(g.metric, { ...data, today: end }, g.createdAt.slice(0, 10))
      if (!b?.hasData) continue
      const delta = Math.round(b.pct - (a?.hasData ? a.pct : 0))
      if (delta !== 0) lines.push(`${g.title}: ${delta > 0 ? '+' : ''}${delta} points, now ${Math.round(b.pct)}%`)
    } else {
      const r = goalMetric(g, { ...data, today: end })
      if (r?.hasData) lines.push(`${g.title}: ${r.label.replace(/ this (week|month)$/, '')} (${Math.round(r.pct)}%)`)
    }
  }
  const startTs = `${weekOf}T00:00:00`
  const endTs = `${addDays(weekOf, 7)}T00:00:00`
  const ms = data.events.filter((e) => e.refTable === 'goals' && e.kind === 'goal.milestone' && e.at >= startTs && e.at < endTs).length
  if (ms) lines.push(`${plural(ms, 'milestone')} checked off`)
  if (!lines.length) out.push({ ...item('goals', 'Goal progress', '/goals', 'Open Goals', null, 'No goal moved this week. Link a goal to a metric on Goals to track it here.'), lines: [] })
  else out.push({ ...item('goals', 'Goal progress', '/goals', 'Open Goals', `${plural(lines.length, 'goal')} moved`, 'What changed since last week.', false), lines })
  return out
}

export async function loadWeekNumbers(weekOf: ISODate, now: ISODate = todayISO()): Promise<NumberItem[]> {
  const [data, goals, journal, interactions, trainDays] = await Promise.all([
    loadMetricData(now),
    db.goals.toArray(),
    db.journal.toArray(),
    db.interactions.toArray(),
    getSetting<number>('body.trainDays', 4),
  ])
  return buildWeekNumbers({ data, goals, journal, interactions, trainDays }, weekOf, now)
}
