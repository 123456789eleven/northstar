import type Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db'
import { importBackup, buildBackup } from '../lib/backup'
import { createVault, unlockWithPassphrase, type VaultKeys } from './crypto'
import { SyncEngine } from './engine'
import { cloneDevice, FakeVault } from './fakeBackend'
import { outboxController, withSyncSuppressed } from './outbox'

const PASS = 'a long enough passphrase'
const T = '2026-03-01T10:00:00.000Z'
let n = 0
let devices: Dexie[] = []
let vault: FakeVault
let keys: VaultKeys

function device() {
  const d = cloneDevice(db, `device-${++n}-${Math.random()}`)
  devices.push(d)
  return d
}
const engine = (d: Dexie, k = keys) => new SyncEngine(d, vault, k)
const tick = () => new Promise((r) => setTimeout(r, 2))

beforeEach(async () => {
  vault = new FakeVault()
  keys = (await createVault(PASS, { unsafeTestIterations: 1000 })).keys
})

afterEach(async () => {
  for (const d of devices) await d.delete()
  devices = []
})

describe('outbox tracking', () => {
  it('queues adds, updates, deletes and clears in the same transaction, and skips device-local settings', async () => {
    const a = device()
    const id = (await a.table('tasks').add({ title: 'x', priority: 1, status: 'open', recurrence: 'none', createdAt: T })) as number
    await a.table('tasks').update(id, { title: 'y' })
    await a.table('settings').put({ key: 'sync.cursor', value: 5 })
    await a.table('settings').put({ key: 'backup.lastAt', value: T })
    await a.table('settings').put({ key: 'profile.name', value: 'Sam' })
    const ob = await a.table('outbox').toArray()
    expect(ob.map((r) => `${r.table}:${r.key}`).sort()).toEqual(['settings:profile.name', `tasks:${id}`])
    await a.table('people').bulkAdd([{ name: 'A', relation: 'f', cadenceDays: 0 }, { name: 'B', relation: 'f', cadenceDays: 0 }])
    await a.table('people').clear()
    expect((await a.table('outbox').toArray()).filter((r) => r.table === 'people')).toHaveLength(2)
  })

  it('does not track anything until sync is set up (default off)', async () => {
    expect(outboxController(db).tracking).toBe(false)
    await db.tasks.add({ title: 'x', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    expect(await db.table('outbox').count()).toBe(0)
  })

  it('backup import is suppressed: restoring a file does not queue its rows', async () => {
    const a = device()
    const backup = await buildBackup()
    backup.tables.tasks = [{ id: 7, title: 'restored', priority: 1, status: 'open', recurrence: 'none', createdAt: T }]
    // Same bulk-replace pattern as importBackup, on device a.
    await withSyncSuppressed(a, async () => {
      await a.transaction('rw', a.tables, async () => {
        for (const t of a.tables) await t.clear()
        await a.table('tasks').bulkAdd(backup.tables.tasks as never[])
      })
    })
    expect(await a.table('outbox').count()).toBe(0)
    expect(await a.table('tasks').count()).toBe(1)
    // And the real importBackup on the app db (tracking turned on) also stays out of the outbox when suppressed.
    outboxController(db).tracking = true
    try {
      await withSyncSuppressed(db, () => importBackup(backup))
      expect(await db.tasks.count()).toBe(1)
      expect(await db.table('outbox').count()).toBe(0)
    } finally {
      outboxController(db).tracking = false
    }
  })
})

describe('two devices', () => {
  it('converge, with foreign keys remapped to each device\'s own local ids', async () => {
    const a = device()
    const b = device()
    // Device B already has unrelated rows so its auto-increment ids differ from A's.
    await b.table('goals').bulkAdd([{ title: 'B1', area: 'career', horizon: 'year', status: 'active', milestones: [], createdAt: T }, { title: 'B2', area: 'career', horizon: 'year', status: 'active', milestones: [], createdAt: T }])
    await b.table('people').add({ name: 'Zed', relation: 'friend', cadenceDays: 0 })

    const goalId = await a.table('goals').add({ title: 'Run a marathon', area: 'health', horizon: 'year', status: 'active', milestones: [], createdAt: T })
    const childId = await a.table('goals').add({ title: 'Run 10k', area: 'health', horizon: 'quarter', parentId: goalId, status: 'active', milestones: [], createdAt: T })
    await a.table('tasks').add({ title: 'Buy shoes', priority: 1, status: 'open', recurrence: 'none', goalId: childId, createdAt: T })
    const personId = await a.table('people').add({ name: 'Ann', relation: 'friend', cadenceDays: 14 })
    await a.table('interactions').add({ personId, date: '2026-03-01', kind: 'call', note: 'talked about her new job' })
    const habitId = await a.table('habits').add({ name: 'Walk', area: 'health', perWeek: 5, goalId, createdAt: T })
    await a.table('habitLogs').add({ habitId, date: '2026-03-02' })
    const itemId = await a.table('learning').add({ title: 'SQL', kind: 'course', status: 'active', progress: 10, goalId, createdAt: T })
    await a.table('studySessions').add({ itemId, date: '2026-03-02', minutes: 30 })
    await a.table('events').add({ at: T, area: 'health', kind: 'goal.done', title: 'Marathon', refTable: 'goals', refId: goalId, milestone: true })

    await engine(a).sync()
    await engine(b).enqueueAll('merge')
    await engine(b).sync()
    await engine(a).sync()

    const bGoal = (await b.table('goals').toArray()).find((g) => g.title === 'Run a marathon')
    const bChild = (await b.table('goals').toArray()).find((g) => g.title === 'Run 10k')
    expect(bGoal.id).not.toBe(goalId)
    expect(bChild.parentId).toBe(bGoal.id)
    const bTask = (await b.table('tasks').toArray())[0]
    expect(bTask.goalId).toBe(bChild.id)
    const bAnn = (await b.table('people').toArray()).find((p) => p.name === 'Ann')
    expect((await b.table('interactions').toArray())[0].personId).toBe(bAnn.id)
    const bHabit = (await b.table('habits').toArray())[0]
    expect(bHabit.goalId).toBe(bGoal.id)
    expect((await b.table('habitLogs').toArray())[0].habitId).toBe(bHabit.id)
    const bItem = (await b.table('learning').toArray())[0]
    expect((await b.table('studySessions').toArray())[0].itemId).toBe(bItem.id)
    expect((await b.table('events').toArray())[0].refId).toBe(bGoal.id)

    // B's pre-existing rows reached A with A's own ids.
    expect((await a.table('goals').toArray()).map((g) => g.title).sort()).toEqual(['B1', 'B2', 'Run 10k', 'Run a marathon'])
    expect((await a.table('people').toArray()).map((p) => p.name).sort()).toEqual(['Ann', 'Zed'])

    // A new link made on B (task -> B1) arrives on A pointing at A's copy of B1.
    const b1 = (await b.table('goals').toArray()).find((g) => g.title === 'B1')
    await b.table('tasks').add({ title: 'Linked on B', priority: 2, status: 'open', recurrence: 'none', goalId: b1.id, createdAt: T })
    await engine(b).sync()
    await engine(a).sync()
    const aB1 = (await a.table('goals').toArray()).find((g) => g.title === 'B1')
    expect((await a.table('tasks').toArray()).find((t) => t.title === 'Linked on B').goalId).toBe(aB1.id)

    expect(await a.table('outbox').count()).toBe(0)
    expect(await b.table('outbox').count()).toBe(0)
  })

  it('resolves a foreign key whose target arrives in a later page', async () => {
    const a = device()
    const b = device()
    const goalId = await a.table('goals').add({ title: 'G', area: 'career', horizon: 'year', status: 'active', milestones: [], createdAt: T })
    await a.table('tasks').add({ title: 't', priority: 1, status: 'open', recurrence: 'none', goalId, createdAt: T })
    await engine(a).sync()
    // Simulate the task arriving before the goal: hide the goal row from the first pull.
    const goalRow = [...vault.rows.entries()].find(([k]) => k.startsWith('goals/'))!
    vault.rows.delete(goalRow[0])
    await engine(b).sync()
    expect((await b.table('tasks').toArray())[0].goalId).toBeUndefined()
    vault.rows.set(goalRow[0], { ...goalRow[1], seq: ++vault.seq })
    const sentBefore = vault.sent.length
    await engine(b).sync()
    expect(vault.sent.length).toBe(sentBefore) // fixing up the link locally is not a new change to push
    const bGoal = (await b.table('goals').toArray())[0]
    expect((await b.table('tasks').toArray())[0].goalId).toBe(bGoal.id)
  })

  it('propagates deletes as tombstones', async () => {
    const a = device()
    const b = device()
    const id = await a.table('journal').add({ date: '2026-03-01', text: 'gone soon', createdAt: T })
    await engine(a).sync()
    await engine(b).sync()
    expect(await b.table('journal').count()).toBe(1)
    await a.table('journal').delete(id)
    await engine(a).sync()
    await engine(b).sync()
    expect(await b.table('journal').count()).toBe(0)
    expect([...vault.rows.values()].every((r) => r.deleted)).toBe(true)
  })

  it('conflicting edits: the later edit wins on both devices', async () => {
    const a = device()
    const b = device()
    await a.table('people').add({ name: 'Ann', relation: 'friend', cadenceDays: 14 })
    await engine(a).sync()
    await engine(b).sync()
    const bAnn = (await b.table('people').toArray())[0]
    const aAnn = (await a.table('people').toArray())[0]
    await a.table('people').update(aAnn.id, { notes: 'from A (earlier)' })
    await tick()
    await b.table('people').update(bAnn.id, { notes: 'from B (later)' })
    // B pushes first, A pushes its older edit afterwards: the server keeps B's.
    await engine(b).sync()
    await engine(a).sync()
    await engine(b).sync()
    expect((await a.table('people').toArray())[0].notes).toBe('from B (later)')
    expect((await b.table('people').toArray())[0].notes).toBe('from B (later)')
  })

  it('same unique value created on both devices merges into one row (budgets, settings, reviews)', async () => {
    const a = device()
    const b = device()
    await a.table('budgets').add({ category: 'Dining', monthlyLimit: 200 })
    await a.table('settings').put({ key: 'food.targets', value: { protein: 100 } })
    await engine(a).sync()
    await b.table('budgets').add({ category: 'Dining', monthlyLimit: 300 })
    await b.table('reviews').add({ weekOf: '2026-02-23', wins: 'w', struggles: '', focusNext: '', ratings: {}, createdAt: T })
    await engine(b).enqueueAll('merge')
    await engine(b).sync()
    await engine(a).sync()
    expect(await b.table('budgets').count()).toBe(1)
    expect(await a.table('budgets').count()).toBe(1)
    // B's row was created after A's, so its edit time is later and it wins everywhere.
    expect((await a.table('budgets').toArray())[0].monthlyLimit).toBe((await b.table('budgets').toArray())[0].monthlyLimit)
    expect((await b.table('settings').get('food.targets'))?.value).toEqual({ protein: 100 })
    expect(await a.table('reviews').count()).toBe(1)
  })

  it('offline: changes queue up and replay when back online; the queue survives a failed push', async () => {
    const a = device()
    const b = device()
    vault.offline = true
    await a.table('meals').add({ date: '2026-03-01', slot: 'lunch', name: 'Salad' })
    await a.table('meals').add({ date: '2026-03-01', slot: 'dinner', name: 'Soup' })
    await expect(engine(a).sync()).rejects.toThrow(/Offline/)
    expect(await a.table('outbox').count()).toBe(2)
    vault.offline = false
    await engine(a).sync()
    expect(await a.table('outbox').count()).toBe(0)
    await engine(b).sync()
    expect((await b.table('meals').toArray()).map((m) => m.name).sort()).toEqual(['Salad', 'Soup'])
    // Re-running is idempotent.
    await engine(a).sync()
    await engine(b).sync()
    expect(await b.table('meals').count()).toBe(2)
  })

  it('applying pulled data does not queue it back', async () => {
    const a = device()
    const b = device()
    await a.table('tasks').add({ title: 'x', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    await engine(a).sync()
    const sentBefore = vault.sent.length
    const r = await engine(b).sync()
    expect(await b.table('tasks').count()).toBe(1)
    expect(r.pushed).toBe(0)
    expect(vault.sent.length).toBe(sentBefore)
    expect(await b.table('outbox').count()).toBe(0)
  })

  it('a device unlocked with the passphrase from cloud meta reads everything', async () => {
    const created = await createVault(PASS)
    await vault.createMeta(created.meta)
    const a = device()
    await a.table('journal').add({ date: '2026-03-01', text: 'hello', createdAt: T })
    await engine(a, created.keys).sync()
    const bKeys = await unlockWithPassphrase(vault.meta!, PASS)
    const b = device()
    await engine(b, bKeys).sync()
    expect((await b.table('journal').toArray())[0].text).toBe('hello')
  }, 30_000)
})

describe('fail closed', () => {
  it('tampered or swapped cloud rows abort the pull without changing local data or the cursor', async () => {
    const a = device()
    const b = device()
    await a.table('tasks').bulkAdd([
      { title: 'one', priority: 1, status: 'open', recurrence: 'none', createdAt: T },
      { title: 'two', priority: 1, status: 'open', recurrence: 'none', createdAt: T },
    ])
    await engine(a).sync()
    await b.table('tasks').add({ title: 'local only', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    const [r1, r2] = [...vault.rows.values()]
    // Swap ciphertexts between two rows (the AAD binds each to its own record id).
    vault.rows.set(`${r1.table_name}/${r1.record_id}`, { ...r1, ciphertext: r2.ciphertext, nonce: r2.nonce })
    await expect(engine(b).sync()).rejects.toThrow(/decrypt/)
    expect((await b.table('tasks').toArray()).map((t) => t.title)).toEqual(['local only'])
    expect(await b.table('settings').get('sync.cursor')).toBeUndefined()
  })

  it('a different key cannot read the vault', async () => {
    const a = device()
    const b = device()
    await a.table('tasks').add({ title: 'one', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    await engine(a).sync()
    const otherKeys = (await createVault(PASS, { unsafeTestIterations: 1000 })).keys
    await expect(engine(b, otherKeys).sync()).rejects.toThrow(/decrypt/)
    expect(await b.table('tasks').count()).toBe(0)
  })
})

describe('privacy of what is sent', () => {
  it('no plaintext field value appears in anything sent to the backend', async () => {
    const a = device()
    const secrets = ['CHIPOTLE MEXICAN GRILL', 'my therapist said', 'Annabelle Secretname', 'Run a sub-3 marathon', 'Dining', 'profile.name', 'Sam Owner', '-1234.56', '2026-03-02']
    await a.table('transactions').add({ date: '2026-03-02', amount: -1234.56, description: 'CHIPOTLE MEXICAN GRILL', category: 'Dining' })
    await a.table('journal').add({ date: '2026-03-02', text: 'my therapist said', createdAt: T })
    await a.table('people').add({ name: 'Annabelle Secretname', relation: 'friend', cadenceDays: 7 })
    await a.table('goals').add({ title: 'Run a sub-3 marathon', area: 'health', horizon: 'year', status: 'active', milestones: [], createdAt: T })
    await a.table('budgets').add({ category: 'Dining', monthlyLimit: 250 })
    await a.table('settings').put({ key: 'profile.name', value: 'Sam Owner' })
    await engine(a).sync()
    const wire = vault.sent.join('\n')
    expect(wire.length).toBeGreaterThan(100)
    for (const s of secrets) expect(wire, s).not.toContain(s)
    // Only these columns are sent.
    for (const batch of vault.sent) for (const row of JSON.parse(batch)) {
      expect(Object.keys(row).sort()).toEqual(['ciphertext', 'client_updated_at', 'deleted', 'nonce', 'record_id', 'table_name'])
    }
  })
})

describe('restore then replace cloud', () => {
  it('replaceCloudWithLocal tombstones cloud-only rows and pushes this device', async () => {
    const a = device()
    const b = device()
    await a.table('tasks').add({ title: 'old cloud task', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    await engine(a).sync()
    await b.table('tasks').add({ title: 'restored task', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
    await engine(b).replaceCloudWithLocal()
    await engine(a).sync()
    expect((await a.table('tasks').toArray()).map((t) => t.title)).toEqual(['restored task'])
    expect((await b.table('tasks').toArray()).map((t) => t.title)).toEqual(['restored task'])
  })
})
