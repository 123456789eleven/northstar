// Insights engine. Pure and deterministic: no database, no clock, no network, no LLM.
// Everything runs on-device from a snapshot the caller passes in. `generateInsights` is the single
// seam: a future opt-in AI generator would implement the same `(snapshot) => Insight[]` signature,
// and would need the owner's explicit approval because it would send personal data off-device.
import type { Budget, Goal, ISODate, LifeEvent, Meal, Person, StudySession, Task, Transaction } from '../../db'
import { addDays, daysBetween, parseISODate } from '../../lib/dates'

export type Severity = 'note' | 'nudge' | 'win'

export interface Insight {
  id: string
  severity: Severity
  /** Plain-English sentence. */
  text: string
  /** Route to open for the relevant detail. */
  href: string
  /** Higher = more useful. Used for ranking only. */
  score: number
}

export interface Snapshot {
  /** Local date today, YYYY-MM-DD. */
  today: ISODate
  tasks: Task[]
  goals: Goal[]
  meals: Meal[]
  transactions: Transaction[]
  budgets: Budget[]
  studySessions: StudySession[]
  people: Person[]
  events: LifeEvent[]
  proteinTarget?: number
  /** ISO timestamp of the last export, or null if never. */
  lastBackupAt: string | null
}

export const MAX_INSIGHTS = 5

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`
const startTs = (d: ISODate) => parseISODate(d).toISOString()
const monthOf = (d: ISODate) => d.slice(0, 7)

function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
const daysInMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

const isTransfer = (c: string) => /transfer/i.test(c)
const isIncome = (t: Transaction) => t.category === 'Income' || (t.category === 'Uncategorized' && t.amount > 0)
const isSpending = (t: Transaction) => !isTransfer(t.category) && !isIncome(t) && t.amount < 0

/** Spending by category within a month, optionally only through a day of the month. */
function spendByCategory(txs: Transaction[], month: string, throughDay = 31): Map<string, number> {
  const out = new Map<string, number>()
  const last = `${month}-${String(throughDay).padStart(2, '0')}`
  for (const t of txs) {
    if (monthOf(t.date) !== month || t.date > last || !isSpending(t)) continue
    out.set(t.category, (out.get(t.category) ?? 0) - t.amount)
  }
  return out
}

function incomeSpend(txs: Transaction[], month: string) {
  let income = 0
  let spend = 0
  for (const t of txs) {
    if (monthOf(t.date) !== month) continue
    if (isIncome(t)) income += t.amount
    else if (isSpending(t)) spend -= t.amount
  }
  return { income, spend }
}

/** Consecutive days present in `dates`, ending today, or yesterday when today is still empty. */
function streakEnding(dates: Set<ISODate>, from: ISODate): number {
  let d = dates.has(from) ? from : addDays(from, -1)
  let n = 0
  while (dates.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

type Rule = (s: Snapshot) => Insight[]

const goalDrift: Rule = (s) => {
  const cutoff = startTs(addDays(s.today, -14))
  const stale: Goal[] = []
  for (const g of s.goals) {
    if (g.status !== 'active' || g.horizon !== 'quarter' || g.id == null) continue
    if (g.createdAt >= cutoff) continue // too new to call drift
    const taskActive = s.tasks.some((t) => t.goalId === g.id && t.status === 'done' && !!t.doneAt && t.doneAt >= cutoff)
    const eventActive = s.events.some((e) => e.refTable === 'goals' && e.refId === g.id && e.at >= cutoff)
    if (!taskActive && !eventActive) stale.push(g)
  }
  if (!stale.length) return []
  const text =
    stale.length === 1
      ? `No progress on "${stale[0].title}" in 14 days. Finish one linked task or milestone, or pause the goal.`
      : `${stale.length} quarter goals have had no progress in 14 days, starting with "${stale[0].title}".`
  return [{ id: 'goal-drift', severity: 'nudge', text, href: '/goals', score: 80 + Math.min(stale.length, 3) * 3 }]
}

const overdueTasks: Rule = (s) => {
  const over = s.tasks.filter((t) => t.status === 'open' && t.due && t.due < s.today)
  if (over.length < 3) return []
  const oldest = Math.max(...over.map((t) => daysBetween(t.due!, s.today)))
  return [
    {
      id: 'overdue-pile',
      severity: 'nudge',
      text: `${plural(over.length, 'task')} overdue, the oldest by ${plural(oldest, 'day')}. Reschedule or drop what no longer matters.`,
      href: '/tasks',
      score: 70 + Math.min(over.length, 10),
    },
  ]
}

const budgetPace: Rule = (s) => {
  const dom = Number(s.today.slice(8, 10))
  if (dom < 5 || !s.budgets.length) return []
  const month = monthOf(s.today)
  const dim = daysInMonth(month)
  const spent = spendByCategory(s.transactions, month)
  const flagged: { category: string; over: number; already: boolean }[] = []
  for (const b of s.budgets) {
    if (b.monthlyLimit <= 0) continue
    const sp = spent.get(b.category) ?? 0
    const projected = (sp / dom) * dim
    if (sp > b.monthlyLimit) flagged.push({ category: b.category, over: sp - b.monthlyLimit, already: true })
    else if (projected > b.monthlyLimit * 1.05) flagged.push({ category: b.category, over: projected - b.monthlyLimit, already: false })
  }
  if (!flagged.length) return []
  flagged.sort((a, b) => b.over - a.over)
  const top = flagged[0]
  const others = flagged.length - 1
  const more = others > 0 ? ` ${others === 1 ? '1 other category is' : `${others} other categories are`} also trending over.` : ''
  const text = top.already
    ? `${top.category} is already ${usd(top.over)} over its budget this month.${more}`
    : `At this pace ${top.category} ends the month about ${usd(top.over)} over budget.${more}`
  return [{ id: 'budget-pace', severity: 'nudge', text, href: '/finance', score: 75 + (top.already ? 5 : 0) }]
}

const categoryMover: Rule = (s) => {
  const dom = Number(s.today.slice(8, 10))
  if (dom < 7) return []
  const month = monthOf(s.today)
  const prev = shiftMonth(month, -1)
  const now = spendByCategory(s.transactions, month, dom)
  const before = spendByCategory(s.transactions, prev, dom)
  if (![...before.values()].some((v) => v > 0)) return []
  let best: { c: string; delta: number; a: number; b: number } | null = null
  for (const c of new Set([...now.keys(), ...before.keys()])) {
    const a = now.get(c) ?? 0
    const b = before.get(c) ?? 0
    const delta = a - b
    if (Math.abs(delta) < 50) continue
    if (b > 0 && Math.abs(delta) / b < 0.25) continue
    if (!best || Math.abs(delta) > Math.abs(best.delta)) best = { c, delta, a, b }
  }
  if (!best) return []
  const up = best.delta > 0
  return [
    {
      id: 'category-mover',
      severity: 'note',
      text: `${best.c} spending is ${usd(Math.abs(best.delta))} ${up ? 'higher' : 'lower'} than at this point last month (${usd(best.a)} vs ${usd(best.b)}).`,
      href: '/finance',
      score: 45 + Math.min(Math.abs(best.delta) / 50, 10),
    },
  ]
}

const savingsRate: Rule = (s) => {
  const last = shiftMonth(monthOf(s.today), -1)
  const prior = shiftMonth(last, -1)
  const a = incomeSpend(s.transactions, last)
  const b = incomeSpend(s.transactions, prior)
  if (a.income <= 0 || b.income <= 0) return []
  const ra = (a.income - a.spend) / a.income
  const rb = (b.income - b.spend) / b.income
  const pts = Math.round((ra - rb) * 100)
  if (Math.abs(pts) < 5) return []
  const up = pts > 0
  return [
    {
      id: 'savings-rate',
      severity: up ? 'win' : 'note',
      text: `Your savings rate ${up ? 'rose' : 'fell'} ${Math.abs(pts)} points last month, to ${Math.round(ra * 100)}%.`,
      href: '/finance',
      score: up ? 40 : 50,
    },
  ]
}

const food: Rule = (s) => {
  const out: Insight[] = []
  const days = new Set(s.meals.map((m) => m.date))
  const weekAgo = addDays(s.today, -6)
  const priorStart = addDays(s.today, -20)
  // Only a gap if the user was logging before; otherwise they simply don't use this module.
  const priorLogged = [...days].some((d) => d >= priorStart && d < weekAgo)
  let missed = 0
  for (let i = 0; i < 7; i++) if (!days.has(addDays(s.today, -i))) missed++
  if (priorLogged && missed >= 4) {
    out.push({
      id: 'food-gaps',
      severity: 'note',
      text: `You logged meals on only ${7 - missed} of the last 7 days. One quick entry a day keeps the trend useful.`,
      href: '/food',
      score: 42,
    })
  }
  const target = s.proteinTarget
  if (target) {
    const protein = new Map<ISODate, number>()
    for (const m of s.meals) protein.set(m.date, (protein.get(m.date) ?? 0) + (m.protein ?? 0))
    const hit = new Set([...protein].filter(([, p]) => p >= target).map(([d]) => d))
    const n = streakEnding(hit, s.today)
    if (n >= 3) {
      out.push({
        id: 'protein-streak',
        severity: 'win',
        text: `Protein target (${target} g) hit ${n} days in a row.`,
        href: '/food',
        score: 35 + Math.min(n, 10),
      })
    }
  }
  return out
}

const studyAtRisk: Rule = (s) => {
  const dates = new Set(s.studySessions.map((x) => x.date))
  if (dates.has(s.today)) return []
  const n = streakEnding(dates, s.today)
  if (n < 3) return []
  return [
    {
      id: 'study-streak',
      severity: 'nudge',
      text: `Your ${n}-day study streak ends today unless you log a session. Even 10 minutes keeps it.`,
      href: '/learning',
      score: 65,
    },
  ]
}

const peopleOverdue: Rule = (s) => {
  const due = s.people
    .filter((p) => p.cadenceDays > 0 && p.lastContact)
    .map((p) => ({ p, late: daysBetween(addDays(p.lastContact!, p.cadenceDays), s.today) }))
    .filter((x) => x.late >= 3)
    .sort((a, b) => b.late - a.late || a.p.name.localeCompare(b.p.name))
  if (!due.length) return []
  const [first, second] = due
  const extra = due.length > 2 ? `, plus ${due.length - 2} more` : ''
  const text = second
    ? `${first.p.name} (${plural(first.late, 'day')} past due) and ${second.p.name} are the most overdue for a check-in${extra}.`
    : `${first.p.name} is ${plural(first.late, 'day')} past due for a check-in.`
  return [{ id: 'people-overdue', severity: 'nudge', text, href: '/people', score: 55 + Math.min(first.late, 20) / 2 }]
}

const birthdays: Rule = (s) => {
  const found: { name: string; in: number }[] = []
  const y = Number(s.today.slice(0, 4))
  for (const p of s.people) {
    if (!p.birthday || !/^\d{2}-\d{2}$/.test(p.birthday)) continue
    let next = `${y}-${p.birthday}`
    if (next < s.today) next = `${y + 1}-${p.birthday}`
    const inDays = daysBetween(s.today, next)
    if (inDays <= 7) found.push({ name: p.name, in: inDays })
  }
  if (!found.length) return []
  found.sort((a, b) => a.in - b.in)
  const when = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)
  const text = found
    .slice(0, 3)
    .map((f) => `${f.name}'s birthday is ${when(f.in)}`)
    .join('; ')
  return [{ id: 'birthdays', severity: 'note', text: `${text}.`, href: '/people', score: 60 - found[0].in }]
}

const backupAge: Rule = (s) => {
  const hasData = s.tasks.length + s.goals.length + s.meals.length + s.transactions.length + s.people.length > 0
  if (!hasData) return []
  if (!s.lastBackupAt) {
    return [{ id: 'backup', severity: 'nudge', text: 'You have never exported a backup. Your data lives only in this browser.', href: '/settings', score: 68 }]
  }
  const age = Math.floor((new Date(`${s.today}T12:00:00`).getTime() - new Date(s.lastBackupAt).getTime()) / 86_400_000)
  if (age <= 14) return []
  return [{ id: 'backup', severity: 'nudge', text: `Your last backup was ${plural(age, 'day')} ago. Export a fresh copy from Settings.`, href: '/settings', score: 66 }]
}

const wins: Rule = (s) => {
  const from = startTs(addDays(s.today, -6))
  const ms = s.events.filter((e) => e.milestone && e.at >= from).sort((a, b) => b.at.localeCompare(a.at))
  if (!ms.length) return []
  const text = ms.length === 1 ? `Milestone this week: ${ms[0].title}.` : `${ms.length} milestones this week, most recently: ${ms[0].title}.`
  return [{ id: 'wins', severity: 'win', text, href: '/history', score: 50 + Math.min(ms.length, 5) }]
}

const RULES: Rule[] = [goalDrift, overdueTasks, budgetPace, categoryMover, savingsRate, food, studyAtRisk, peopleOverdue, birthdays, backupAge, wins]

/** Ranked by usefulness and capped. Returns [] when nothing is worth saying. */
export function generateInsights(snapshot: Snapshot): Insight[] {
  return RULES.flatMap((r) => r(snapshot))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, MAX_INSIGHTS)
}

export interface NextAction {
  text: string
  href: string
  cta: string
}

/** For brand-new users: the single most useful next step, or null once there is enough data. */
export function nextBestAction(s: Snapshot): NextAction | null {
  if (s.tasks.length === 0) return { text: 'Insights appear once you have a little data. Start by adding a task.', href: '/tasks', cta: 'Add a task' }
  if (s.goals.length === 0) return { text: 'Set one goal for this quarter and link a task to it. Insights will track whether it is moving.', href: '/goals', cta: 'Set a goal' }
  if (s.tasks.length + s.meals.length + s.transactions.length + s.studySessions.length + s.people.length < 5)
    return { text: 'A few more days of logging and this page will start noticing patterns.', href: '/', cta: 'Open Today' }
  return null
}
