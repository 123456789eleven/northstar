import { describe, expect, it } from 'vitest'
import { deriveGains } from './derive'
import { habit, ownerSnapshot, person, snap, task, TODAY } from './fixtures'
import { buildPlayer } from './player'
import { generateQuests } from './quests'

const D = TODAY
const quests = (s: ReturnType<typeof snap>) => generateQuests(s, D, deriveGains(s, D))

describe('generateQuests', () => {
  it('owner setup: five quests in priority order with stable ids', () => {
    const q = quests(ownerSnapshot())
    expect(q.map((x) => x.id)).toEqual([`${D}:weigh-in`, `${D}:protein`, `${D}:workout`, `${D}:journal`, `${D}:win`])
    expect(q.every((x) => !x.done && x.auto)).toBe(true)
    expect(q[1].progress).toEqual({ value: 0, target: 140, unit: 'g' })
  })
  it('is deterministic and never exceeds five', () => {
    const s = ownerSnapshot({ tasks: [task({ id: 1, due: D })] })
    expect(quests(s)).toEqual(quests(s))
    expect(quests(s).length).toBeLessThanOrEqual(5)
  })
  it('quests complete themselves when the data appears', () => {
    const s = ownerSnapshot()
    const s2 = {
      ...s,
      weights: [{ id: 1, date: D, weight: 181 }],
      meals: [{ id: 1, date: D, slot: 'lunch' as const, name: 'chicken', calories: 800, protein: 70 }],
      journal: [{ id: 1, date: D, text: 'x', createdAt: '' }],
    }
    const q = quests(s2)
    expect(q.find((x) => x.kind === 'weigh-in')?.done).toBe(true)
    expect(q.find((x) => x.kind === 'journal')?.done).toBe(true)
    const p = q.find((x) => x.kind === 'protein')!
    expect(p.done).toBe(false)
    expect(p.progress?.value).toBe(70)
    const s3 = { ...s2, meals: [...s2.meals, { id: 2, date: D, slot: 'dinner' as const, name: 'shake', calories: 900, protein: 66 }] }
    expect(quests(s3).find((x) => x.kind === 'protein')?.done).toBe(true)
  })
  it('workout quest disappears once the weekly target was reached earlier in the week', () => {
    const logs = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d, i) => ({ id: i, habitId: 1, date: d }))
    const s = ownerSnapshot({ habitLogs: logs })
    expect(generateQuests(s, '2026-11-04', deriveGains(s, '2026-11-04')).some((x) => x.kind === 'workout')).toBe(true)
    expect(generateQuests(s, '2026-11-06', deriveGains(s, '2026-11-06')).some((x) => x.kind === 'workout')).toBe(false)
  })
  it('brand-new empty app has just the journal quest and no NaN', () => {
    const q = quests(snap())
    expect(q.map((x) => x.kind)).toEqual(['journal'])
    expect(JSON.stringify(q)).not.toMatch(/NaN|undefined/)
  })
  it('pads to three with habits due today', () => {
    const q = quests(snap({ habits: [habit({ id: 1, name: 'Stretch' }), habit({ id: 2, name: 'Read' }), habit({ id: 3, name: 'Walk' })] }))
    expect(q.map((x) => x.kind)).toEqual(['journal', 'habit', 'habit'])
    expect(new Set(q.map((x) => x.id)).size).toBe(q.length)
  })
  it('adds the most overdue contact and the top task', () => {
    const s = snap({
      people: [person({ id: 1, name: 'Pat', cadenceDays: 7, lastContact: '2026-10-20' }), person({ id: 2, name: 'Lee', cadenceDays: 30, lastContact: '2026-09-01' }), person({ id: 3, name: 'Off', cadenceDays: 0 })],
      tasks: [task({ id: 1, title: 'Low', priority: 3, due: D }), task({ id: 2, title: 'Pinned', priority: 2, focusDate: D })],
    })
    const q = quests(s)
    expect(q.find((x) => x.kind === 'contact')?.title).toBe('Reach out to Lee')
    expect(q.find((x) => x.kind === 'task')?.title).toBe('Pinned')
  })
  it('offers no contact quest when nobody is overdue', () => {
    const s = snap({ people: [person({ id: 1, cadenceDays: 30, lastContact: '2026-10-30' })] })
    expect(quests(s).some((x) => x.kind === 'contact')).toBe(false)
  })
  it('contact and task quests stay in place after they are completed', () => {
    const s = snap({
      people: [person({ id: 1, name: 'Pat', cadenceDays: 7, lastContact: '2026-10-01' })],
      interactions: [{ id: 1, personId: 1, date: D, kind: 'call' }],
      tasks: [task({ id: 1, title: 'Pinned', focusDate: D, status: 'done', doneAt: `${D}T09:00:00` })],
    })
    const q = quests(s)
    expect(q.find((x) => x.kind === 'contact')?.done).toBe(true)
    expect(q.find((x) => x.kind === 'task')?.done).toBe(true)
  })
  it('money quest needs a budget and completes on a categorize event', () => {
    const base = snap({ budgets: [{ id: 1, category: 'Dining', monthlyLimit: 100 }] })
    expect(quests(base).find((x) => x.kind === 'money')?.done).toBe(false)
    const done = { ...base, events: [{ id: 1, at: `${D}T12:00:00`, area: 'finance' as const, kind: 'tx.categorize', title: '', milestone: false }] }
    expect(quests(done).find((x) => x.kind === 'money')?.done).toBe(true)
  })
})

describe('calm mode', () => {
  it('hides quests and recent gains but keeps levels', () => {
    const s = ownerSnapshot({ calm: true, journal: [{ id: 1, date: D, text: 'x', createdAt: '' }] })
    const p = buildPlayer(s, D)
    expect(p.calm).toBe(true)
    expect(p.quests).toEqual([])
    expect(p.recent).toEqual([])
    expect(p.cleared).toBe(false)
    expect(p.xp).toBeGreaterThan(0)
  })
})
