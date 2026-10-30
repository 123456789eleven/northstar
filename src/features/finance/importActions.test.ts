import { describe, expect, it } from 'vitest'
import { db, getSetting, logEvent } from '../../db'
import { commitImport, undoImport } from './importActions'
import { IMPORTS_KEY, type ImportRecord } from './model'

const row = (description: string, amount = -5) => ({ date: '2026-03-01', amount, description, category: 'Dining' })

describe('commitImport', () => {
  it('adds tagged transactions, a batch record, and a finance.import event', async () => {
    const { batch, added } = await commitImport('a.csv', [row('A'), row('B')], 1, 0)
    expect(added).toBe(2)
    const txs = await db.transactions.toArray()
    expect(txs.every((t) => t.importBatch === batch)).toBe(true)
    const recs = await getSetting<ImportRecord[]>(IMPORTS_KEY, [])
    expect(recs[0]).toMatchObject({ id: batch, file: 'a.csv', added: 2, skipped: 1, errors: 0 })
    const evs = await db.events.where('area').equals('finance').toArray()
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ kind: 'finance.import', refKey: batch })
    expect(evs[0].title).toBe('Imported 2 transactions from a.csv')
  })
  it('singular wording for one row', async () => {
    await commitImport('b.csv', [row('A')], 0, 0)
    expect((await db.events.toArray())[0].title).toBe('Imported 1 transaction from b.csv')
  })
})

describe('undoImport', () => {
  it('removes the batch rows, the record AND its History event; leaves other imports alone', async () => {
    const first = await commitImport('first.csv', [row('A')], 0, 0)
    // make batch ids distinct even when created in the same millisecond
    await new Promise((r) => setTimeout(r, 5))
    const second = await commitImport('second.csv', [row('B'), row('C')], 0, 0)
    await logEvent({ area: 'finance', kind: 'finance.budget', title: 'Set first budget' })

    const removed = await undoImport(second.batch)
    expect(removed).toBe(2)

    const txs = await db.transactions.toArray()
    expect(txs.map((t) => t.description)).toEqual(['A'])
    const recs = await getSetting<ImportRecord[]>(IMPORTS_KEY, [])
    expect(recs.map((r) => r.id)).toEqual([first.batch])
    const evs = await db.events.toArray()
    expect(evs.map((e) => e.title).sort()).toEqual(['Imported 1 transaction from first.csv', 'Set first budget'].sort())
  })

  it('leaves manually-added transactions alone', async () => {
    const { batch } = await commitImport('x.csv', [row('A')], 0, 0)
    await db.transactions.add({ ...row('manual'), importBatch: undefined })
    await undoImport(batch)
    expect((await db.transactions.toArray()).map((t) => t.description)).toEqual(['manual'])
  })

  it('removes the History event of imports made before events carried a batch key', async () => {
    const batch = 'imp-legacy'
    const at = new Date().toISOString()
    await db.transactions.add({ ...row('A'), importBatch: batch })
    await db.settings.put({ key: IMPORTS_KEY, value: [{ id: batch, at, file: 'old.csv', added: 1, skipped: 0, errors: 0 }] })
    await logEvent({ area: 'finance', kind: 'finance.import', title: 'Imported 1 transaction from old.csv', at })
    await logEvent({ area: 'finance', kind: 'finance.import', title: 'Imported 1 transaction from other.csv', at })

    await undoImport(batch)
    const titles = (await db.events.toArray()).map((e) => e.title)
    expect(titles).toEqual(['Imported 1 transaction from other.csv'])
  })

  it('is a no-op for an unknown batch', async () => {
    await commitImport('a.csv', [row('A')], 0, 0)
    expect(await undoImport('nope')).toBe(0)
    expect(await db.transactions.count()).toBe(1)
    expect(await db.events.count()).toBe(1)
  })
})
