import { describe, expect, it } from 'vitest'
import { db } from '../db'
import { applyAdditiveImport, planAdditiveImport, undoAdditiveImport } from './additiveImport'
import type { BackupFile } from './backup'

const file = (tables: Record<string, unknown[]>): BackupFile => ({ app: 'northstar', version: 4, exportedAt: '2026-10-30T00:00:00.000Z', tables })
const tx = (d: string, a: number, desc: string, extra: object = {}) => ({ id: 99, date: '2026-03-01'.replace('2026-03-01', d), amount: a, description: desc, category: 'Dining', account: 'Checking', ...extra })

const full = () =>
  file({
    transactions: [tx('2026-03-01', -12.34, 'Chipotle'), tx('2026-03-02', -5, 'Coffee')],
    balances: [{ date: '2026-03-01', name: 'Checking', kind: 'asset', balance: 100 }],
    budgets: [{ category: 'Dining', monthlyLimit: 250 }],
  })

describe('additive import', () => {
  it('adds new rows, strips ids, links a batch and logs one event', async () => {
    const res = await applyAdditiveImport(await planAdditiveImport(full()))
    expect(res.added).toEqual({ transactions: 2, balances: 1, budgets: 1 })
    const txs = await db.transactions.toArray()
    expect(txs).toHaveLength(2)
    expect(txs.every((t) => t.importBatch === res.undo.batch && t.id !== 99)).toBe(true)
    expect(await db.balances.count()).toBe(1)
    expect(await db.budgets.count()).toBe(1)
    expect((await db.events.toArray()).filter((e) => e.refKey === res.undo.batch).length).toBe(1)
  })

  it('is idempotent', async () => {
    await applyAdditiveImport(await planAdditiveImport(full()))
    const plan = await planAdditiveImport(full())
    expect(plan.transactions.add).toHaveLength(0)
    expect(plan.transactions.present).toBe(2)
    const res = await applyAdditiveImport(plan)
    expect(res.added).toEqual({ transactions: 0, balances: 0, budgets: 0 })
    expect(await db.transactions.count()).toBe(2)
    expect(await db.events.count()).toBe(1)
  })

  it('handles partial overlap and duplicate occurrences', async () => {
    await db.transactions.add({ date: '2026-03-01', amount: -12.34, description: 'CHIPOTLE', category: 'Dining', account: 'checking' })
    const data = file({ transactions: [tx('2026-03-01', -12.34, 'Chipotle'), tx('2026-03-01', -12.34, 'Chipotle'), tx('2026-03-02', -5, 'Coffee')] })
    const plan = await planAdditiveImport(data)
    expect(plan.transactions.present).toBe(1)
    expect(plan.transactions.add).toHaveLength(2)
    await applyAdditiveImport(plan)
    expect(await db.transactions.count()).toBe(3)
  })

  it('ignores settings, events and other tables', async () => {
    await db.settings.put({ key: 'x', value: 1 })
    const before = await db.settings.toArray()
    const plan = await planAdditiveImport(file({ settings: [{ key: 'x', value: 2 }, { key: 'gcal.token', value: 't' }], events: [{ at: 'a' }], goals: [{}], transactions: [tx('2026-03-02', -5, 'Coffee')] }))
    expect(plan.skipped.sort()).toEqual(['events', 'goals', 'settings'])
    await applyAdditiveImport(plan)
    const after = (await db.settings.toArray()).filter((s) => !s.key.startsWith('finance.imports'))
    expect(after).toEqual(before)
    expect(await db.goals.count()).toBe(0)
  })

  it('rejects invalid rows with a reason', async () => {
    const plan = await planAdditiveImport(file({
      transactions: [tx('2026-13-40', -1, 'a'), tx('2026-03-01', Number.NaN, 'a'), tx('2026-03-01', -1, '  '), 'nope', tx('2026-03-01', -1, 'ok')],
      balances: [{ date: '2026-03-01', name: 'A', kind: 'other', balance: 1 }, { date: '03/01/2026', name: 'A', kind: 'asset', balance: 1 }],
      budgets: [{ category: 'X', monthlyLimit: 0 }, { category: '', monthlyLimit: 5 }],
    }))
    expect(plan.transactions.invalid).toHaveLength(4)
    expect(plan.transactions.add).toHaveLength(1)
    expect(plan.balances.invalid).toHaveLength(2)
    expect(plan.budgets.invalid).toHaveLength(2)
    expect(plan.transactions.invalid[0].reason).toMatch(/date/)
  })

  it('keeps an existing budget limit', async () => {
    await db.budgets.add({ category: 'dining', monthlyLimit: 100 })
    const plan = await planAdditiveImport(full())
    expect(plan.budgets.add).toHaveLength(0)
    expect(plan.budgets.kept).toEqual([{ category: 'Dining', existing: 100, incoming: 250 }])
    await applyAdditiveImport(plan)
    expect((await db.budgets.toArray())).toEqual([expect.objectContaining({ monthlyLimit: 100 })])
  })

  it('undo removes exactly the added rows, record and event', async () => {
    await db.transactions.add({ date: '2026-01-01', amount: -1, description: 'mine', category: 'Dining' })
    await db.budgets.add({ category: 'Rent', monthlyLimit: 900 })
    const res = await applyAdditiveImport(await planAdditiveImport(full()))
    await undoAdditiveImport(res.undo)
    expect((await db.transactions.toArray()).map((t) => t.description)).toEqual(['mine'])
    expect((await db.budgets.toArray()).map((b) => b.category)).toEqual(['Rent'])
    expect(await db.balances.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
    expect((await db.settings.get('finance.imports'))?.value).toEqual([])
  })
})
