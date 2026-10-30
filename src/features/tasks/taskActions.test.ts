import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db, type Task } from '../../db'
import { addTask, byDue, byUrgency, completeTask, isPinned, MAX_FOCUS, reopenTask, toggleDone, togglePin } from './taskActions'
import { saveCapture } from './captureSave'
import { parseCapture } from '../../lib/capture'

// Today = 2026-03-31 (so "next month" arithmetic hits short months).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 2, 31, 12, 0))
})
afterEach(() => vi.useRealTimers())

const base = (over: Partial<Task> = {}): Omit<Task, 'id'> => ({ title: 'Pay rent', priority: 2, status: 'open', recurrence: 'none', createdAt: '2026-01-01T00:00:00Z', ...over })
const add = async (over: Partial<Task> = {}) => (await db.tasks.get(await db.tasks.add(base(over))))!

describe('completeTask / reopenTask', () => {
  it('completes, logs an event, and does not spawn for non-recurring tasks', async () => {
    const t = await add()
    await completeTask(t)
    expect(await db.tasks.get(t.id!)).toMatchObject({ status: 'done' })
    expect(await db.tasks.count()).toBe(1)
    expect(await db.events.toArray()).toMatchObject([{ kind: 'task.done', refId: t.id }])
  })

  it('weekly recurrence spawns the next open task with the same attributes', async () => {
    const t = await add({ recurrence: 'weekly', due: '2026-03-31', priority: 1, goalId: 7 })
    await completeTask(t)
    const open = await db.tasks.where('status').equals('open').toArray()
    expect(open).toHaveLength(1)
    expect(open[0]).toMatchObject({ title: 'Pay rent', due: '2026-04-07', priority: 1, goalId: 7, recurrence: 'weekly' })
  })

  it('monthly task due on the 31st keeps the 31st across short months (no drift)', async () => {
    vi.setSystemTime(new Date(2026, 0, 31, 12))
    let t = await add({ recurrence: 'monthly', due: '2026-01-31' })
    const seen: string[] = []
    for (const [y, m, d] of [[2026, 0, 31], [2026, 1, 28], [2026, 2, 31], [2026, 3, 30]]) {
      vi.setSystemTime(new Date(y, m, d, 12))
      await completeTask(t)
      t = (await db.tasks.where('status').equals('open').first())!
      seen.push(t.due!)
    }
    expect(seen).toEqual(['2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('monthly task created on the 15th stays on the 15th', async () => {
    vi.setSystemTime(new Date(2026, 5, 15, 9))
    const t = await add({ recurrence: 'monthly', due: '2026-06-15' })
    await completeTask(t)
    expect((await db.tasks.where('status').equals('open').first())!.due).toBe('2026-07-15')
  })

  it('reopen restores the task, removes its event, and deletes the spawned recurrence', async () => {
    const t = await add({ recurrence: 'daily', due: '2026-03-31' })
    await completeTask(t)
    const done = (await db.tasks.get(t.id!))!
    expect(await db.tasks.count()).toBe(2)
    await reopenTask(done)
    expect(await db.tasks.count()).toBe(1)
    expect(await db.tasks.get(t.id!)).toMatchObject({ status: 'open' })
    expect((await db.tasks.get(t.id!))!.doneAt).toBeUndefined()
    expect(await db.events.count()).toBe(0)
  })

  it('toggleDone dispatches by status', async () => {
    const t = await add()
    await toggleDone(t)
    expect((await db.tasks.get(t.id!))!.status).toBe('done')
    await toggleDone((await db.tasks.get(t.id!))!)
    expect((await db.tasks.get(t.id!))!.status).toBe('open')
  })

  it('ignores tasks without an id', async () => {
    await completeTask({ ...base() })
    await reopenTask({ ...base() })
    expect(await db.events.count()).toBe(0)
  })
})

describe('focus pinning', () => {
  it('pins up to MAX_FOCUS and refuses the next; unpin frees a slot', async () => {
    const ts = [await add({ title: 'a' }), await add({ title: 'b' }), await add({ title: 'c' }), await add({ title: 'd' })]
    for (let i = 0; i < MAX_FOCUS; i++) expect(await togglePin(ts[i])).toBe(true)
    expect(await togglePin(ts[3])).toBe(false)
    const a = (await db.tasks.get(ts[0].id!))!
    expect(isPinned(a)).toBe(true)
    expect(await togglePin(a)).toBe(true)
    expect(isPinned((await db.tasks.get(ts[0].id!))!)).toBe(false)
    expect(await togglePin(ts[3])).toBe(true)
  })
  it('done tasks do not occupy focus slots', async () => {
    const done = await add({ title: 'old', status: 'done', focusDate: '2026-03-31' })
    const fresh = [await add({ title: '1' }), await add({ title: '2' }), await add({ title: '3' })]
    expect(done.status).toBe('done')
    for (const f of fresh) expect(await togglePin(f)).toBe(true)
  })
  it('a focusDate from a prior day is not pinned today', () => {
    expect(isPinned({ ...base(), focusDate: '2026-03-30' })).toBe(false)
  })
})

describe('ordering', () => {
  const T = (title: string, over: Partial<Task>): Task => ({ ...base(over), title, id: 0 })
  it('byUrgency: overdue/today, then soon, then rest; priority breaks ties', () => {
    const list = [
      T('later', { due: '2026-05-01' }),
      T('nodue', {}),
      T('soon', { due: '2026-04-02' }),
      T('overdue-low', { due: '2026-03-01', priority: 3 }),
      T('today-high', { due: '2026-03-31', priority: 1 }),
    ]
    expect([...list].sort(byUrgency).map((t) => t.title)).toEqual(['today-high', 'overdue-low', 'soon', 'later', 'nodue'])
  })
  it('byDue: undated last, then priority, then creation', () => {
    const list = [T('c', {}), T('b', { due: '2026-04-01', priority: 3 }), T('a', { due: '2026-04-01', priority: 1 })]
    expect([...list].sort(byDue).map((t) => t.title)).toEqual(['a', 'b', 'c'])
  })
})

describe('addTask / saveCapture', () => {
  it('addTask stores an open task', async () => {
    const id = await addTask({ title: 'x', priority: 2, recurrence: 'none', due: undefined, goalId: undefined })
    expect(await db.tasks.get(id)).toMatchObject({ status: 'open', title: 'x' })
  })

  it('saveCapture persists each kind and undo removes it', async () => {
    const now = new Date()
    for (const line of ['buy milk tomorrow', '$12.50 lunch', 'ate eggs 200cal', 'win: promoted #career']) {
      const saved = await saveCapture(parseCapture(line, { now }))
      expect(saved, line).not.toBeNull()
    }
    expect(await db.tasks.count()).toBe(1)
    expect(await db.transactions.toArray()).toMatchObject([{ amount: -12.5, category: 'Uncategorized' }])
    expect(await db.meals.count()).toBe(1)
    expect(await db.events.toArray()).toMatchObject([{ kind: 'win', milestone: true, area: 'career' }])

    const s = await saveCapture(parseCapture('another task', { now }))
    await s!.undo()
    expect(await db.tasks.count()).toBe(1)
  })

  it('empty input and title-less tasks save nothing', async () => {
    expect(await saveCapture(parseCapture('', {}))).toBeNull()
    expect(await saveCapture(parseCapture('tomorrow', {}))).toBeNull() // a date and no title
    expect(await db.tasks.count()).toBe(0)
  })
})
