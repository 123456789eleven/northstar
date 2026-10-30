import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { db } from '../../db'
import { applyProposal, canUndo, decide, getAutoLog, loadOpsSnapshot, runAutoApply, setAuto, undoApplied } from './opsActions'
import { generateProposals, isAutoEnabled, needsApproval, type OpsSnapshot } from './proposals'

const NOW = '2026-10-29T15:00:00.000Z'
const base: OpsSnapshot = {
  today: '2026-10-29',
  tasks: [], goals: [], meals: [], transactions: [], budgets: [], studySessions: [], people: [], events: [], learning: [], userRules: [], decisions: {},
  lastBackupAt: null,
  now: NOW,
}
const snap = (p: Partial<OpsSnapshot>): OpsSnapshot => ({ ...base, ...p })
const task = (o: object) => ({ id: 1, title: 'File report', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-01-01T00:00:00.000Z', ...o }) as never
const rules = (s: OpsSnapshot) => generateProposals(s).map((p) => p.rule)

describe('proposal rules', () => {
  it('says nothing for an empty snapshot', () => {
    expect(generateProposals(base)).toEqual([])
  })

  it('overdue task -> reschedule to tomorrow', () => {
    const [p] = generateProposals(snap({ tasks: [task({ due: '2026-10-20' })] }))
    expect(p.rule).toBe('overdue-task')
    expect(p.action.kind).toBe('task.reschedule')
    expect(p.action.params).toMatchObject({ taskId: 1, due: '2026-10-30' })
    expect(p.evidence.length).toBeGreaterThan(0)
    expect(p.logic).toContain('task.due < today')
    expect(rules(snap({ tasks: [task({ due: '2026-10-29' })] }))).toEqual([])
    expect(rules(snap({ tasks: [task({ due: '2026-10-20', status: 'done' })] }))).toEqual([])
  })

  it('goal drift -> next-step task linked to the goal; not for fresh goals or goals with an open task', () => {
    const goal = { id: 5, title: 'Ship it', area: 'career', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-08-01T00:00:00.000Z' } as never
    const [p] = generateProposals(snap({ goals: [goal] }))
    expect(p.action).toMatchObject({ kind: 'task.create', params: { goalId: 5 } })
    expect(rules(snap({ goals: [{ ...(goal as object), createdAt: '2026-10-25T00:00:00.000Z' } as never] }))).toEqual([])
    expect(rules(snap({ goals: [goal], tasks: [task({ id: 2, goalId: 5 })] }))).toEqual([])
  })

  it('person overdue -> check-in task due tomorrow, not duplicated when one is open', () => {
    const person = { id: 3, name: 'Sam', relation: 'friend', cadenceDays: 14, lastContact: '2026-10-01' } as never
    const [p] = generateProposals(snap({ people: [person] }))
    expect(p.action).toMatchObject({ kind: 'task.create', params: { title: 'Check in with Sam', due: '2026-10-30' } })
    expect(rules(snap({ people: [person], tasks: [task({ title: 'Check in with Sam' })] }))).toEqual([])
  })

  it('uncategorized transactions with a merchant rule -> apply category; user rules are low risk, built-ins medium', () => {
    const tx = (id: number, description: string) => ({ id, date: '2026-10-10', amount: -12, description, category: 'Uncategorized' }) as never
    const [p] = generateProposals(snap({ transactions: [tx(1, 'POS KROGER #12'), tx(2, 'KROGER #99')] }))
    expect(p.action.params).toMatchObject({ txIds: [1, 2], category: 'Groceries' })
    expect(p.risk).toBe('medium')
    const [u] = generateProposals(snap({ transactions: [tx(3, 'ACME WIDGETS 22')], userRules: [{ pattern: 'ACME', category: 'Shopping' }] }))
    expect(u.risk).toBe('low')
    expect(rules(snap({ transactions: [tx(4, 'MYSTERY CORP')] }))).toEqual([])
  })

  it('budget projected over -> review flag with no side-effect action', () => {
    const s = snap({
      today: '2026-10-15',
      budgets: [{ id: 9, category: 'Dining', monthlyLimit: 100 }],
      transactions: [{ id: 1, date: '2026-10-10', amount: -90, description: 'x', category: 'Dining' }] as never,
    })
    const [p] = generateProposals(s)
    expect(p.rule).toBe('budget-over')
    expect(p.action.kind).toBe('review.flag')
    expect(p.risk).toBe('medium')
  })

  it('study streak at risk -> pin a study task', () => {
    const sessions = ['2026-10-28', '2026-10-27', '2026-10-26'].map((date) => ({ itemId: 1, date, minutes: 20 })) as never
    const [p] = generateProposals(snap({ studySessions: sessions, tasks: [task({ id: 7, title: 'Study chapter 4' })] }))
    expect(p.action).toMatchObject({ kind: 'task.pin', params: { taskId: 7 } })
    expect(rules(snap({ studySessions: [...(sessions as unknown[]), { itemId: 1, date: '2026-10-29', minutes: 5 }] as never, tasks: [task({ title: 'Study chapter 4' })] }))).toEqual([])
  })
})

describe('ids and decisions', () => {
  const s = snap({ tasks: [task({ due: '2026-10-20' })] })

  it('ids are stable across runs and differ per object', () => {
    expect(generateProposals(s)[0].id).toBe(generateProposals(s)[0].id)
    const two = generateProposals(snap({ tasks: [task({ due: '2026-10-20' }), task({ id: 2, due: '2026-10-20' })] }))
    expect(new Set(two.map((p) => p.id)).size).toBe(2)
  })

  it('accepted and dismissed proposals do not reappear; snoozed ones return after expiry', () => {
    const id = generateProposals(s)[0].id
    expect(generateProposals(snap({ ...s, decisions: { [id]: { status: 'dismissed', at: NOW } } }))).toEqual([])
    expect(generateProposals(snap({ ...s, decisions: { [id]: { status: 'accepted', at: NOW } } }))).toEqual([])
    const snoozed = { [id]: { status: 'snoozed' as const, at: NOW, until: '2026-10-30T15:00:00.000Z' } }
    expect(generateProposals(snap({ ...s, decisions: snoozed }))).toEqual([])
    expect(generateProposals(snap({ ...s, decisions: snoozed, now: '2026-10-31T00:00:00.000Z' }))).toHaveLength(1)
  })

  it('auto-apply is off by default and never applies to review-only rules', () => {
    expect(isAutoEnabled(undefined, 'overdue-task')).toBe(false)
    expect(isAutoEnabled({}, 'overdue-task')).toBe(false)
    expect(isAutoEnabled({ 'budget-over': true }, 'budget-over')).toBe(false)
    const p = generateProposals(s)[0]
    expect(needsApproval(p, {})).toBe(true)
    expect(needsApproval(p, { 'overdue-task': true })).toBe(false)
  })
})

describe('applying, auto-apply and undo (db)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T15:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  const seedOverdue = () => db.tasks.add({ title: 'File report', priority: 2, status: 'open', recurrence: 'none', due: '2026-10-20', createdAt: '2026-01-01T00:00:00.000Z' })

  it('applyProposal reschedules via the DB, logs proposal.accepted, and the proposal disappears', async () => {
    const id = await seedOverdue()
    const [p] = generateProposals(await loadOpsSnapshot())
    await applyProposal(p)
    expect((await db.tasks.get(id))?.due).toBe('2026-10-30')
    const ev = await db.events.toArray()
    expect(ev.find((e) => e.kind === 'proposal.accepted')).toMatchObject({ refTable: 'tasks', refId: id })
    expect(generateProposals(await loadOpsSnapshot())).toEqual([])
  })

  it('modify overrides the due date before applying', async () => {
    const id = await seedOverdue()
    const [p] = generateProposals(await loadOpsSnapshot())
    await applyProposal(p, { due: '2026-11-05' })
    expect((await db.tasks.get(id))?.due).toBe('2026-11-05')
  })

  it('a dismissed proposal stays gone after reload', async () => {
    await seedOverdue()
    const [p] = generateProposals(await loadOpsSnapshot())
    await decide(p.id, 'dismissed')
    expect(generateProposals(await loadOpsSnapshot())).toEqual([])
  })

  it('does not auto-apply anything by default', async () => {
    const id = await seedOverdue()
    expect(await runAutoApply()).toEqual([])
    expect((await db.tasks.get(id))?.due).toBe('2026-10-20')
  })

  it('auto-applies opted-in low-risk rules, logs them, and undo restores state within 24h', async () => {
    const id = await seedOverdue()
    await setAuto('overdue-task', true)
    const applied = await runAutoApply()
    expect(applied).toHaveLength(1)
    expect((await db.tasks.get(id))?.due).toBe('2026-10-30')
    const [entry] = await getAutoLog()
    expect(entry.auto).toBe(true)
    expect(canUndo(entry)).toBe(true)

    expect(await undoApplied(entry.proposalId)).toBe(true)
    expect((await db.tasks.get(id))?.due).toBe('2026-10-20')
    expect((await db.events.toArray()).some((e) => e.kind === 'proposal.accepted')).toBe(false)
    // undone proposals do not bounce back into the queue or get re-applied
    expect(generateProposals(await loadOpsSnapshot())).toEqual([])
    expect((await getAutoLog())[0].undone).toBe(true)
  })

  it('refuses to undo after 24h', async () => {
    await seedOverdue()
    await setAuto('overdue-task', true)
    await runAutoApply()
    const [entry] = await getAutoLog()
    expect(await undoApplied(entry.proposalId, Date.now() + 25 * 3_600_000)).toBe(false)
  })

  it('undo of an auto-created task deletes it', async () => {
    const person = { name: 'Sam', relation: 'friend', cadenceDays: 14, lastContact: '2026-10-01' }
    await db.people.add(person)
    await setAuto('person-overdue', true)
    await runAutoApply()
    expect(await db.tasks.where('status').equals('open').count()).toBe(1)
    const [entry] = await getAutoLog()
    await undoApplied(entry.proposalId)
    expect(await db.tasks.count()).toBe(0)
  })
})

describe('seeded overdue tasks reach the Command queue', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-29T15:00:00.000Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('every overdue open task gets a proposal, and a snapshot taken after a later insert includes it', async () => {
    const mk = (title: string, due: string) => db.tasks.add({ title, priority: 2, status: 'open', recurrence: 'none', due, createdAt: '2026-01-01T00:00:00.000Z' })
    await mk('A', '2026-10-01')
    await mk('B', '2026-10-15')
    expect(generateProposals(await loadOpsSnapshot()).map((p) => p.rule)).toEqual(['overdue-task', 'overdue-task'])
    await mk('C', '2026-10-28')
    expect(generateProposals(await loadOpsSnapshot())).toHaveLength(3)
  })
})

describe('friendlyDate', () => {
  it('uses words for near days and a weekday for the rest, never ISO', async () => {
    const { friendlyDate } = await import('./proposals')
    expect(friendlyDate('2026-10-31', '2026-10-30')).toBe('tomorrow')
    expect(friendlyDate('2026-10-30', '2026-10-30')).toBe('today')
    expect(friendlyDate('2026-11-06', '2026-10-30')).toBe('Fri, Nov 6')
  })
})
