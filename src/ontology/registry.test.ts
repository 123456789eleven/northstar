import { describe, expect, it } from 'vitest'
import { db } from '../db'
import { REGISTRY, resolveLinks, timelineFor, TYPE_LIST } from './registry'

describe('ontology registry', () => {
  it('declares every type with a table that exists', () => {
    expect(TYPE_LIST.length).toBe(10)
    for (const t of TYPE_LIST) expect(db.tables.map((x) => x.name)).toContain(t.table)
  })

  it('resolves links in both directions', async () => {
    const goalId = (await db.goals.add({ title: 'G', area: 'career', horizon: 'quarter', status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00.000Z' })) as number
    const taskId = (await db.tasks.add({ title: 'T', priority: 2, status: 'open', recurrence: 'none', goalId, createdAt: '2026-01-01T00:00:00.000Z' })) as number

    const task = (await db.tasks.get(taskId))!
    const out = await resolveLinks('Task', task as never)
    expect(out.find((g) => g.direction === 'out' && g.type === 'Goal')?.objects.map((o) => o.id)).toEqual([goalId])

    const goal = (await db.goals.get(goalId))!
    const inc = await resolveLinks('Goal', goal as never)
    expect(inc.find((g) => g.direction === 'in' && g.type === 'Task')?.objects.map((o) => o.id)).toEqual([taskId])
  })

  it('links transactions to budgets by category and events to any object', async () => {
    const bid = (await db.budgets.add({ category: 'Dining', monthlyLimit: 100 })) as number
    const tid = (await db.transactions.add({ date: '2026-10-01', amount: -5, description: 'cafe', category: 'Dining' })) as number
    const tx = (await db.transactions.get(tid))!
    expect((await resolveLinks('Transaction', tx as never)).find((g) => g.type === 'Budget')?.objects[0].id).toBe(bid)
    const budget = (await db.budgets.get(bid))!
    expect((await resolveLinks('Budget', budget as never)).find((g) => g.direction === 'in' && g.type === 'Transaction')?.objects).toHaveLength(1)

    await db.events.add({ at: '2026-10-02T00:00:00.000Z', area: 'finance', kind: 'x', title: 'about tx', refTable: 'transactions', refId: tid, milestone: false })
    const ev = (await db.events.toArray())[0]
    expect((await resolveLinks('LifeEvent', ev as never)).find((g) => g.direction === 'out')?.type).toBe('Transaction')
    expect((await resolveLinks('Transaction', tx as never)).find((g) => g.type === 'LifeEvent' && g.direction === 'in')?.objects).toHaveLength(1)
    expect((await timelineFor({ table: 'transactions', id: tid })).map((e) => e.title)).toEqual(['about tx'])
  })

  it('functions compute derived values via existing logic', async () => {
    const id = (await db.goals.add({ title: 'G', area: 'career', horizon: 'quarter', status: 'active', milestones: [{ id: 'a', title: 'a', done: true }, { id: 'b', title: 'b', done: false }], createdAt: '2026-01-01T00:00:00.000Z' })) as number
    const g = (await db.goals.get(id))!
    expect(await REGISTRY.Goal.functions[0].run(g as never)).toContain('50%')
  })
})
