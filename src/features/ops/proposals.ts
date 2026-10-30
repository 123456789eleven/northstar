// Proposals engine. Pure and deterministic: no database, no clock, no network, no LLM.
// Everything is derived from the snapshot the caller injects (including `now`), so it is fully testable.
// Applying a proposal lives in opsActions.ts and goes through the existing feature actions.
import type { Goal, ISODate, LearningItem, Task, Transaction } from '../../db'
import { addDays, daysBetween, parseISODate } from '../../lib/dates'
import { allRules, categorize, isSpending, merchantKey, merchantLabel, UNCATEGORIZED, type Rule } from '../finance/categories'
import type { Snapshot } from '../insights/engine'
import { sessionStreak } from '../learning/learningData'
import { MAX_FOCUS } from '../tasks/taskActions'

export type RuleId = 'overdue-task' | 'goal-drift' | 'person-overdue' | 'merchant-category' | 'budget-over' | 'study-streak'
export type Risk = 'low' | 'medium'
export type ActionKind = 'task.reschedule' | 'task.create' | 'tx.categorize' | 'task.pin' | 'review.flag'

export interface ObjectRef {
  table: string
  id: number
}

export interface ProposalAction {
  label: string
  kind: ActionKind
  params: Record<string, unknown>
}

export interface Proposal {
  /** Stable hash of rule + object (+ a state key so a recurring situation can be proposed again later). */
  id: string
  rule: RuleId
  objectRef: ObjectRef
  title: string
  rationale: string
  /** The data used to reach the proposal. */
  evidence: string[]
  /** Human-readable predicate. */
  logic: string
  risk: Risk
  action: ProposalAction
}

export type DecisionStatus = 'accepted' | 'dismissed' | 'snoozed'
export interface Decision {
  status: DecisionStatus
  /** ISO timestamp of the decision. */
  at: string
  /** Snoozed proposals reappear after this ISO timestamp. */
  until?: string
  auto?: boolean
}
export type Decisions = Record<string, Decision>

export interface OpsSnapshot extends Snapshot {
  learning: LearningItem[]
  /** User merchant rules (finance.rules). */
  userRules: Rule[]
  decisions: Decisions
  /** ISO timestamp used for snooze expiry. */
  now: string
}

export interface RuleMeta {
  id: RuleId
  label: string
  description: string
  /** Object type key (see ontology registry) the rule is attached to. */
  type: string
  risk: Risk
  /** May be opted into auto-apply. Review-only rules never are. */
  autoEligible: boolean
}

export const RULE_META: Record<RuleId, RuleMeta> = {
  'overdue-task': { id: 'overdue-task', label: 'Overdue task', description: 'Open task past its due date: move it to tomorrow.', type: 'Task', risk: 'low', autoEligible: true },
  'goal-drift': { id: 'goal-drift', label: 'Goal drift', description: 'Quarter goal with no progress in 14 days: add a next-step task.', type: 'Goal', risk: 'low', autoEligible: true },
  'person-overdue': { id: 'person-overdue', label: 'Person overdue', description: 'Contact 3+ days past cadence: add a check-in task.', type: 'Person', risk: 'low', autoEligible: true },
  'merchant-category': { id: 'merchant-category', label: 'Merchant category', description: 'Uncategorized transactions that match a merchant rule: apply the category.', type: 'Transaction', risk: 'low', autoEligible: true },
  'budget-over': { id: 'budget-over', label: 'Budget over', description: 'Category projected over its monthly limit: flag for review (no automatic action).', type: 'Budget', risk: 'medium', autoEligible: false },
  'study-streak': { id: 'study-streak', label: 'Study streak', description: 'Study streak of 3+ days with nothing logged today: pin a study task.', type: 'LearningItem', risk: 'low', autoEligible: true },
}
export const RULE_IDS = Object.keys(RULE_META) as RuleId[]

/** FNV-1a, 32-bit, hex. Stable across runs and platforms. */
export function hashId(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
export const proposalId = (rule: RuleId, ref: ObjectRef, key = '') => hashId(`${rule}|${ref.table}|${ref.id}|${key}`)

export function isSuppressed(d: Decision | undefined, now: string): boolean {
  if (!d) return false
  if (d.status === 'snoozed') return !!d.until && d.until > now
  return true
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

type RuleFn = (s: OpsSnapshot) => Proposal[]

const overdueTask: RuleFn = (s) => {
  const tomorrow = addDays(s.today, 1)
  return s.tasks
    .filter((t): t is Task & { id: number; due: ISODate } => t.status === 'open' && t.id != null && !!t.due && t.due < s.today)
    .map((t) => {
      const ref = { table: 'tasks', id: t.id }
      const late = daysBetween(t.due, s.today)
      return {
        id: proposalId('overdue-task', ref, t.due),
        rule: 'overdue-task' as const,
        objectRef: ref,
        title: `Reschedule "${t.title}" to tomorrow`,
        rationale: `This task is ${plural(late, 'day')} overdue. Moving it to ${tomorrow} keeps your list honest without dropping it.`,
        evidence: [`task #${t.id} "${t.title}"`, `due ${t.due}`, `today ${s.today}`, `${plural(late, 'day')} overdue`],
        logic: `task.status == "open" AND task.due < today (${s.today}) -> set task.due = today + 1 day (${tomorrow})`,
        risk: 'low' as const,
        action: { label: 'Reschedule', kind: 'task.reschedule' as const, params: { taskId: t.id, due: tomorrow, from: t.due } },
      }
    })
}

const goalDrift: RuleFn = (s) => {
  const cutoff = parseISODate(addDays(s.today, -14)).toISOString()
  const due = addDays(s.today, 2)
  const out: Proposal[] = []
  for (const g of s.goals as (Goal & { id: number })[]) {
    if (g.status !== 'active' || g.horizon !== 'quarter' || g.id == null) continue
    if (g.createdAt >= cutoff) continue
    const taskActive = s.tasks.some((t) => t.goalId === g.id && t.status === 'done' && !!t.doneAt && t.doneAt >= cutoff)
    const eventActive = s.events.some((e) => e.refTable === 'goals' && e.refId === g.id && e.at >= cutoff)
    if (taskActive || eventActive) continue
    if (s.tasks.some((t) => t.goalId === g.id && t.status === 'open')) continue // a next step already exists
    const ref = { table: 'goals', id: g.id }
    out.push({
      id: proposalId('goal-drift', ref, weekKey(s.today)),
      rule: 'goal-drift',
      objectRef: ref,
      title: `Add a next step for "${g.title}"`,
      rationale: `No task or milestone on this quarter goal in 14 days, and nothing open is linked to it. One concrete next step restarts it.`,
      evidence: [`goal #${g.id} "${g.title}" (quarter, active)`, `created ${g.createdAt.slice(0, 10)}`, 'no linked task done in 14 days', 'no goal events in 14 days', 'no open linked tasks'],
      logic: `goal.status == "active" AND goal.horizon == "quarter" AND age > 14d AND no linked task done or goal event since ${cutoff.slice(0, 10)} AND no open linked task -> create task linked to goal, due ${due}`,
      risk: 'low',
      action: { label: 'Create task', kind: 'task.create', params: { title: `Next step: ${g.title}`, goalId: g.id, due } },
    })
  }
  return out
}

/** Monday-based week key so a drifting goal can be proposed again next week. */
function weekKey(d: ISODate): string {
  const dt = parseISODate(d)
  const dow = (dt.getDay() + 6) % 7
  dt.setDate(dt.getDate() - dow)
  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`
}

const personOverdue: RuleFn = (s) => {
  const tomorrow = addDays(s.today, 1)
  const out: Proposal[] = []
  for (const p of s.people) {
    if (p.id == null || p.cadenceDays <= 0 || !p.lastContact) continue
    const dueOn = addDays(p.lastContact, p.cadenceDays)
    const late = daysBetween(dueOn, s.today)
    if (late < 3) continue
    const title = `Check in with ${p.name}`
    if (s.tasks.some((t) => t.status === 'open' && t.title === title)) continue
    const ref = { table: 'people', id: p.id }
    out.push({
      id: proposalId('person-overdue', ref, p.lastContact),
      rule: 'person-overdue',
      objectRef: ref,
      title: `Add task "${title}" for tomorrow`,
      rationale: `${p.name} is ${plural(late, 'day')} past your ${p.cadenceDays}-day cadence. A task makes it concrete.`,
      evidence: [`person #${p.id} ${p.name} (${p.relation})`, `last contact ${p.lastContact}`, `cadence ${p.cadenceDays} days`, `was due ${dueOn}`, `${plural(late, 'day')} late`],
      logic: `person.cadenceDays > 0 AND today (${s.today}) - (lastContact + cadenceDays) >= 3 days AND no open task titled "${title}" -> create task due ${tomorrow}`,
      risk: 'low',
      action: { label: 'Create task', kind: 'task.create', params: { title, due: tomorrow } },
    })
  }
  return out
}

const merchantCategory: RuleFn = (s) => {
  const rules = allRules(s.userRules)
  const groups = new Map<string, { key: string; category: string; user: boolean; txs: (Transaction & { id: number })[] }>()
  for (const t of s.transactions) {
    if (t.id == null || t.category !== UNCATEGORIZED) continue
    const userCat = categorize(t.description, t.amount, s.userRules)
    const cat = userCat !== UNCATEGORIZED ? userCat : categorize(t.description, t.amount, rules)
    if (cat === UNCATEGORIZED) continue
    const key = merchantKey(t.description)
    const gk = `${key}|${cat}`
    const g = groups.get(gk) ?? { key, category: cat, user: userCat !== UNCATEGORIZED, txs: [] }
    g.txs.push(t as Transaction & { id: number })
    groups.set(gk, g)
  }
  return [...groups.values()].map((g) => {
    const first = g.txs.reduce((a, b) => (a.id < b.id ? a : b))
    const ref = { table: 'transactions', id: first.id }
    return {
      id: proposalId('merchant-category', ref, `${g.key}|${g.category}`),
      rule: 'merchant-category' as const,
      objectRef: ref,
      title: `Categorize ${plural(g.txs.length, 'transaction')} from ${merchantLabel(g.key)} as ${g.category}`,
      rationale: `${merchantLabel(g.key)} matches a ${g.user ? 'merchant rule you saved' : 'built-in merchant rule'} for ${g.category}.`,
      evidence: g.txs.slice(0, 5).map((t) => `#${t.id} ${t.date} ${t.description} (${t.amount.toFixed(2)})`).concat(g.txs.length > 5 ? [`+${g.txs.length - 5} more`] : []),
      logic: `transaction.category == "${UNCATEGORIZED}" AND merchant "${g.key}" matches ${g.user ? 'a user' : 'a built-in'} rule -> category = "${g.category}"`,
      risk: g.user ? ('low' as const) : ('medium' as const),
      action: { label: 'Apply category', kind: 'tx.categorize' as const, params: { txIds: g.txs.map((t) => t.id).sort((a, b) => a - b), category: g.category } },
    }
  })
}

const budgetOver: RuleFn = (s) => {
  const dom = Number(s.today.slice(8, 10))
  if (dom < 5 || !s.budgets.length) return []
  const month = s.today.slice(0, 7)
  const dim = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()
  const spent = new Map<string, number>()
  for (const t of s.transactions) {
    if (t.date.slice(0, 7) !== month || t.date > s.today || t.amount >= 0 || !isSpending(t)) continue
    spent.set(t.category, (spent.get(t.category) ?? 0) - t.amount)
  }
  const out: Proposal[] = []
  for (const b of s.budgets) {
    if (b.id == null || b.monthlyLimit <= 0) continue
    const sp = spent.get(b.category) ?? 0
    const projected = (sp / dom) * dim
    if (!(sp > b.monthlyLimit || projected > b.monthlyLimit * 1.05)) continue
    const ref = { table: 'budgets', id: b.id }
    out.push({
      id: proposalId('budget-over', ref, month),
      rule: 'budget-over',
      objectRef: ref,
      title: `Review ${b.category} budget: projected $${Math.round(projected)} of $${b.monthlyLimit}`,
      rationale: `${b.category} is on pace to finish ${month} over its limit. There is no automatic fix; look at the transactions or adjust the limit.`,
      evidence: [`budget ${b.category}: $${b.monthlyLimit}/mo`, `spent $${sp.toFixed(2)} through day ${dom} of ${dim}`, `projected $${projected.toFixed(2)}`],
      logic: `spent > limit OR (spent / day-of-month) * days-in-month > limit * 1.05, from day 5 (${month}, day ${dom}) -> flag for review`,
      risk: 'medium',
      action: { label: 'Mark reviewed', kind: 'review.flag', params: { category: b.category, month } },
    })
  }
  return out
}

const studyStreak: RuleFn = (s) => {
  const dates = new Set(s.studySessions.map((x) => x.date))
  if (dates.has(s.today)) return []
  const n = sessionStreak(dates, s.today)
  if (n < 3) return []
  const pinnedToday = s.tasks.filter((t) => t.status === 'open' && t.focusDate === s.today).length
  if (pinnedToday >= MAX_FOCUS) return []
  const goalIds = new Set(s.learning.filter((l) => l.status === 'active' && l.goalId != null).map((l) => l.goalId))
  const open = s.tasks.filter((t): t is Task & { id: number } => t.status === 'open' && t.id != null && t.focusDate !== s.today)
  const byGoal = open.filter((t) => t.goalId != null && goalIds.has(t.goalId))
  const byTitle = open.filter((t) => /\b(study|learn|course|read|practice|lesson|exam)/i.test(t.title))
  const pool = byGoal.length ? byGoal : byTitle
  if (!pool.length) return []
  const task = [...pool].sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.id - b.id)[0]
  const ref = { table: 'tasks', id: task.id }
  return [
    {
      id: proposalId('study-streak', ref, s.today),
      rule: 'study-streak',
      objectRef: ref,
      title: `Pin "${task.title}" to today's focus`,
      rationale: `Your ${n}-day study streak ends today unless you log a session. Pinning a study task puts it in your top 3.`,
      evidence: [`study sessions on ${n} consecutive days, none today`, `task #${task.id} "${task.title}"${byGoal.length ? ' (linked to an active learning goal)' : ' (title looks like study work)'}`, `${pinnedToday} of ${MAX_FOCUS} focus slots used`],
      logic: `study streak >= 3 days AND no session today (${s.today}) AND a free focus slot AND an open study task exists -> pin task for today`,
      risk: 'low',
      action: { label: 'Pin task', kind: 'task.pin', params: { taskId: task.id } },
    },
  ]
}

const RULES: RuleFn[] = [overdueTask, goalDrift, personOverdue, merchantCategory, budgetOver, studyStreak]

/** Open proposals: everything the rules find minus accepted, dismissed and still-snoozed ones. */
export function generateProposals(snapshot: OpsSnapshot): Proposal[] {
  const seen = new Set<string>()
  const out: Proposal[] = []
  for (const p of RULES.flatMap((r) => r(snapshot))) {
    if (seen.has(p.id) || isSuppressed(snapshot.decisions[p.id], snapshot.now)) continue
    seen.add(p.id)
    out.push(p)
  }
  return out
}

/** Whether a rule's proposals are applied without asking. Default off. */
export function isAutoEnabled(auto: Record<string, boolean> | undefined, rule: RuleId): boolean {
  return !!auto?.[rule] && RULE_META[rule].autoEligible
}

export function needsApproval(p: Proposal, auto: Record<string, boolean> | undefined): boolean {
  return !(p.risk === 'low' && isAutoEnabled(auto, p.rule))
}
