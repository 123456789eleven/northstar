// Loading, deciding, applying and undoing proposals. Execution goes through the existing feature actions.
import { db, getSetting, logEvent, setSetting, type LifeEvent } from '../../db'
import { addDays, today } from '../../lib/dates'
import { RULES_KEY, type Rule } from '../finance/categories'
import { loadSnapshot } from '../insights/snapshot'
import { addTask, togglePin } from '../tasks/taskActions'
import { generateProposals, isAutoEnabled, RULE_META, type Decisions, type OpsSnapshot, type Proposal } from './proposals'

export const DECISIONS_KEY = 'ops.decisions'
export const AUTO_KEY = 'ops.auto'
export const AUTOLOG_KEY = 'ops.autolog'
export const UNDO_WINDOW_MS = 24 * 3_600_000

export type Undo =
  | { t: 'due'; taskId: number; due?: string }
  | { t: 'delete-task'; taskId: number }
  | { t: 'categories'; rows: { id: number; category: string }[] }
  | { t: 'unpin'; taskId: number }
  | { t: 'none' }

export interface AppliedEntry {
  proposalId: string
  rule: Proposal['rule']
  title: string
  at: string
  auto: boolean
  undo: Undo
  eventId?: number
  undone?: boolean
}

export interface Overrides {
  title?: string
  due?: string
}

export async function loadOpsSnapshot(now = new Date()): Promise<OpsSnapshot> {
  const base = await loadSnapshot()
  // The base snapshot only carries recent transactions; uncategorized ones can be older.
  const uncategorized = await db.transactions.where('category').equals('Uncategorized').toArray()
  const known = new Set(base.transactions.map((t) => t.id))
  const transactions = [...base.transactions, ...uncategorized.filter((t) => !known.has(t.id))]
  const [learning, userRules, decisions] = await Promise.all([
    db.learning.toArray(),
    getSetting<Rule[]>(RULES_KEY, []),
    getSetting<Decisions>(DECISIONS_KEY, {}),
  ])
  return { ...base, transactions, learning, userRules, decisions, now: now.toISOString() }
}

export const getAuto = () => getSetting<Record<string, boolean>>(AUTO_KEY, {})
export const getAutoLog = () => getSetting<AppliedEntry[]>(AUTOLOG_KEY, [])

export async function setAuto(rule: string, on: boolean) {
  await setSetting(AUTO_KEY, { ...(await getAuto()), [rule]: on })
}

export async function decide(id: string, status: 'dismissed' | 'snoozed' | 'accepted', opts: { days?: number; auto?: boolean } = {}) {
  const decisions = await getSetting<Decisions>(DECISIONS_KEY, {})
  const now = new Date()
  const until = status === 'snoozed' ? new Date(now.getTime() + (opts.days ?? 1) * 86_400_000).toISOString() : undefined
  await setSetting(DECISIONS_KEY, { ...decisions, [id]: { status, at: now.toISOString(), ...(until ? { until } : {}), ...(opts.auto ? { auto: true } : {}) } })
}

const AREA_FOR_TABLE: Record<string, LifeEvent['area']> = {
  tasks: 'tasks',
  goals: 'personal',
  people: 'relationships',
  transactions: 'finance',
  budgets: 'finance',
  learning: 'learning',
}

/** Execute the proposal's action via existing functions, log it, persist the decision. */
export async function applyProposal(p: Proposal, overrides: Overrides = {}, opts: { auto?: boolean } = {}): Promise<AppliedEntry> {
  const params = p.action.params
  let undo: Undo = { t: 'none' }
  switch (p.action.kind) {
    case 'task.reschedule': {
      const taskId = params.taskId as number
      const task = await db.tasks.get(taskId)
      if (!task) throw new Error('Task no longer exists')
      await db.tasks.update(taskId, { due: overrides.due || (params.due as string) })
      undo = { t: 'due', taskId, due: task.due }
      break
    }
    case 'task.create': {
      const id = await addTask({
        title: overrides.title?.trim() || (params.title as string),
        due: overrides.due || (params.due as string),
        priority: 2,
        recurrence: 'none',
        goalId: params.goalId as number | undefined,
      })
      undo = { t: 'delete-task', taskId: id as number }
      break
    }
    case 'tx.categorize': {
      const ids = params.txIds as number[]
      const rows = (await db.transactions.bulkGet(ids)).filter((t) => !!t).map((t) => ({ id: t!.id!, category: t!.category }))
      await db.transactions.bulkUpdate(ids.map((id) => ({ key: id, changes: { category: params.category as string } })))
      undo = { t: 'categories', rows }
      break
    }
    case 'task.pin': {
      const taskId = params.taskId as number
      const task = await db.tasks.get(taskId)
      if (!task) throw new Error('Task no longer exists')
      if (task.focusDate !== today() && !(await togglePin(task))) throw new Error('Today’s focus is full')
      undo = { t: 'unpin', taskId }
      break
    }
    case 'review.flag':
      break
  }
  const eventId = (await logEvent({
    area: AREA_FOR_TABLE[p.objectRef.table] ?? 'personal',
    kind: 'proposal.accepted',
    title: `${opts.auto ? 'Auto-applied' : 'Accepted'}: ${overrides.title?.trim() || p.title}`,
    refTable: p.objectRef.table,
    refId: p.objectRef.id,
  })) as number
  await decide(p.id, 'accepted', { auto: opts.auto })
  const entry: AppliedEntry = { proposalId: p.id, rule: p.rule, title: p.title, at: new Date().toISOString(), auto: !!opts.auto, undo, eventId }
  await setSetting(AUTOLOG_KEY, [...(await getAutoLog()), entry].slice(-200))
  return entry
}

export function canUndo(e: AppliedEntry, now = Date.now()): boolean {
  return !e.undone && e.undo.t !== 'none' && now - new Date(e.at).getTime() <= UNDO_WINDOW_MS
}

/** Reverse an applied proposal within 24h. The proposal is then treated as dismissed so it does not bounce back. */
export async function undoApplied(proposalId: string, now = Date.now()): Promise<boolean> {
  const log = await getAutoLog()
  const idx = log.findIndex((e) => e.proposalId === proposalId && !e.undone)
  if (idx < 0 || !canUndo(log[idx], now)) return false
  const { undo, eventId } = log[idx]
  switch (undo.t) {
    case 'due':
      await db.tasks.update(undo.taskId, { due: undo.due })
      break
    case 'delete-task':
      await db.tasks.delete(undo.taskId)
      break
    case 'categories':
      await db.transactions.bulkUpdate(undo.rows.map((r) => ({ key: r.id, changes: { category: r.category } })))
      break
    case 'unpin':
      await db.tasks.update(undo.taskId, { focusDate: undefined })
      break
  }
  if (eventId != null) await db.events.delete(eventId)
  await decide(proposalId, 'dismissed')
  log[idx] = { ...log[idx], undone: true }
  await setSetting(AUTOLOG_KEY, log)
  return true
}

let autoRun: Promise<Proposal[]> | null = null

/** Applies open low-risk proposals for rules the user opted in. Does nothing by default. */
export function runAutoApply(): Promise<Proposal[]> {
  if (autoRun) return autoRun
  autoRun = (async () => {
    const auto = await getAuto()
    if (!Object.keys(auto).some((r) => auto[r])) return []
    const snap = await loadOpsSnapshot()
    const applied: Proposal[] = []
    for (const p of generateProposals(snap)) {
      if (p.risk !== 'low' || !isAutoEnabled(auto, p.rule)) continue
      try {
        await applyProposal(p, {}, { auto: true })
        applied.push(p)
      } catch {
        /* leave it in the queue for manual review */
      }
    }
    return applied
  })().finally(() => {
    autoRun = null
  })
  return autoRun
}

export const tomorrow = () => addDays(today(), 1)
export const ruleLabel = (r: string) => RULE_META[r as keyof typeof RULE_META]?.label ?? r
