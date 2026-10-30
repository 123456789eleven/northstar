import { describe, expect, it } from 'vitest'
import { db } from '../db'
import { buildBackup, daysSinceBackup, eraseAll, importBackup, parseBackup, BACKUP_LAST_KEY } from './backup'

const T = '2026-03-01T10:00:00.000Z'

/** One realistic row in EVERY table (the guard test below fails if a new table is added without a row here). */
async function seedEverything() {
  await db.tasks.add({ title: 'Task', priority: 1, status: 'open', recurrence: 'monthly', recurDay: 31, due: '2026-03-31', createdAt: T })
  const goalId = await db.goals.add({ title: 'Goal', area: 'career', horizon: 'year', status: 'active', milestones: [{ id: 'm1', title: 'ms', done: true }], createdAt: T })
  await db.meals.add({ date: '2026-03-01', slot: 'lunch', name: 'Salad', calories: 400, protein: 30 })
  await db.favoriteMeals.add({ name: 'Salad', uses: 2, calories: 400 })
  await db.transactions.add({ date: '2026-03-01', amount: -12.34, description: 'CHIPOTLE', category: 'Dining', account: 'Checking', importBatch: 'imp-1' })
  await db.budgets.add({ category: 'Dining', monthlyLimit: 250 })
  await db.balances.add({ date: '2026-03-01', name: 'Checking', kind: 'asset', balance: 1000.5 })
  await db.learning.add({ title: 'SQL', kind: 'course', status: 'active', progress: 40, createdAt: T })
  await db.studySessions.add({ itemId: 1, date: '2026-03-01', minutes: 45, note: 'ch1' })
  const personId = await db.people.add({ name: 'Ann', relation: 'friend', cadenceDays: 14, lastContact: '2026-03-01', birthday: '09-20' })
  await db.interactions.add({ personId: personId!, date: '2026-03-01', kind: 'call', note: 'hi' })
  await db.events.add({ at: T, area: 'career', kind: 'goal.done', title: 'Done', refTable: 'goals', refId: goalId, refKey: 'k', milestone: true })
  await db.reviews.add({ weekOf: '2026-02-23', wins: 'w', struggles: 's', focusNext: 'f', ratings: { career: 4 }, createdAt: T })
  const habitId = (await db.habits.add({ name: 'Walk', area: 'health', perWeek: 5, createdAt: T })) as number
  await db.habitLogs.add({ habitId, date: '2026-03-02' })
  await db.journal.add({ date: '2026-03-02', mood: 4, text: 'ok day', tags: ['a'], createdAt: T })
  await db.settings.put({ key: 'food.targets', value: { protein: 120 } })
  await db.settings.put({ key: BACKUP_LAST_KEY, value: T })
}

const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()])))
const file = (content: unknown, name = 'northstar-backup-2026-03-01.json', type = 'application/json') =>
  new File([typeof content === 'string' ? content : JSON.stringify(content)], name, { type })

describe('backup round trip', () => {
  it('seeds a row in every table (guard)', async () => {
    await seedEverything()
    for (const t of db.tables) expect(await t.count(), t.name).toBeGreaterThan(0)
  })

  it('export -> erase -> import restores every table exactly', async () => {
    await seedEverything()
    const before = await snapshot()
    const backup = await buildBackup()

    expect(backup).toMatchObject({ app: 'northstar', version: db.verno })
    expect(Object.keys(backup.tables).sort()).toEqual(db.tables.map((t) => t.name).sort())

    await eraseAll()
    for (const t of db.tables) expect(await t.count(), t.name).toBe(0)

    // Through real JSON + the real parser, as the Settings page does.
    const parsed = await parseBackup(file(backup))
    expect(parsed.unknown).toEqual([])
    expect(parsed.counts.reduce((n, c) => n + c.rows, 0)).toBeGreaterThanOrEqual(db.tables.length)
    await importBackup(parsed.data)

    expect(await snapshot()).toEqual(before)
  })

  it('import replaces existing data rather than merging', async () => {
    await seedEverything()
    const backup = await buildBackup()
    await db.tasks.add({ title: 'Extra', priority: 2, status: 'open', recurrence: 'none', createdAt: T })
    await importBackup(backup)
    expect((await db.tasks.toArray()).map((t) => t.title)).toEqual(['Task'])
  })

  it('preserves ids so cross-table references still resolve', async () => {
    await seedEverything()
    const backup = await buildBackup()
    await eraseAll()
    await importBackup(backup)
    const ev = (await db.events.toArray())[0]
    expect((await db.goals.get(ev.refId!))!.title).toBe('Goal')
    expect((await db.people.get((await db.interactions.toArray())[0].personId))!.name).toBe('Ann')
  })

  it('an older backup missing newer tables empties those tables but imports the rest', async () => {
    await seedEverything()
    const backup = await buildBackup()
    delete backup.tables.reviews
    delete backup.tables.events
    await importBackup(backup)
    expect(await db.reviews.count()).toBe(0)
    expect(await db.events.count()).toBe(0)
    expect(await db.tasks.count()).toBe(1)
  })

  it('empty database round trips', async () => {
    const backup = await buildBackup()
    await importBackup(backup)
    for (const t of db.tables) expect(await t.count()).toBe(0)
  })

  it('a failing import rolls back and leaves existing data untouched', async () => {
    await seedEverything()
    const before = await snapshot()
    const backup = await buildBackup()
    // two settings rows with the same primary key -> bulkAdd fails mid-transaction
    backup.tables.settings = [{ key: 'dup', value: 1 }, { key: 'dup', value: 2 }]
    await expect(importBackup(backup)).rejects.toThrow()
    expect(await snapshot()).toEqual(before)
  })

  it('unknown tables in the file are reported and ignored', async () => {
    const backup = await buildBackup()
    backup.tables.futureTable = [{ a: 1 }]
    const parsed = await parseBackup(file(backup))
    expect(parsed.unknown).toEqual(['futureTable'])
    await importBackup(parsed.data)
    expect(db.tables.map((t) => t.name)).not.toContain('futureTable')
  })
})

describe('parseBackup rejects bad files', () => {
  const ok = { app: 'northstar', version: 1, exportedAt: T, tables: { tasks: [] } }

  it('accepts a minimal valid file and an old version', async () => {
    const p = await parseBackup(file(ok))
    expect(p.counts).toEqual([{ table: 'tasks', rows: 0 }])
  })
  it('not JSON', async () => {
    await expect(parseBackup(file('{nope'))).rejects.toThrow('not valid JSON')
  })
  it.each([['null'], ['42'], ['"str"'], ['[]']])('non-object JSON %s', async (raw) => {
    await expect(parseBackup(file(raw))).rejects.toThrow('not a Northstar backup')
  })
  it('wrong app marker', async () => {
    await expect(parseBackup(file({ ...ok, app: 'other' }))).rejects.toThrow('not a Northstar backup')
  })
  it('missing or non-numeric version', async () => {
    await expect(parseBackup(file({ ...ok, version: undefined }))).rejects.toThrow('missing its version')
    await expect(parseBackup(file({ ...ok, version: '2' }))).rejects.toThrow('missing its version')
  })
  it('newer version than this app understands', async () => {
    await expect(parseBackup(file({ ...ok, version: db.verno + 1 }))).rejects.toThrow(/newer version/)
  })
  it('missing tables object', async () => {
    await expect(parseBackup(file({ ...ok, tables: undefined }))).rejects.toThrow('no tables')
    await expect(parseBackup(file({ ...ok, tables: null }))).rejects.toThrow('no tables')
  })
  it('a table that is not an array', async () => {
    await expect(parseBackup(file({ ...ok, tables: { tasks: { a: 1 } } }))).rejects.toThrow('"tasks" is malformed')
  })
  it('rows that are not objects', async () => {
    await expect(parseBackup(file({ ...ok, tables: { tasks: [1, 2] } }))).rejects.toThrow('invalid rows')
    await expect(parseBackup(file({ ...ok, tables: { tasks: [null] } }))).rejects.toThrow('invalid rows')
  })
  it('wrong file type', async () => {
    await expect(parseBackup(file(ok, 'photo.png', 'image/png'))).rejects.toThrow(/does not look like a backup/)
  })
  it('oversized files are refused before parsing', async () => {
    const big = new File(['x'], 'big.json', { type: 'application/json' })
    Object.defineProperty(big, 'size', { value: 60 * 1024 * 1024 })
    await expect(parseBackup(big)).rejects.toThrow(/too large/)
  })
})

describe('daysSinceBackup', () => {
  it('null when never exported', async () => {
    expect(await daysSinceBackup()).toBeNull()
  })
  it('whole days since the recorded export', async () => {
    await db.settings.put({ key: BACKUP_LAST_KEY, value: new Date(Date.now() - 3.5 * 86_400_000).toISOString() })
    expect(await daysSinceBackup()).toBe(3)
    await db.settings.put({ key: BACKUP_LAST_KEY, value: new Date().toISOString() })
    expect(await daysSinceBackup()).toBe(0)
  })
})
