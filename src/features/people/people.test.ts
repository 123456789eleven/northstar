import { describe, expect, it } from 'vitest'
import { db, type Person } from '../../db'
import { ago, cadenceLabel, deleteInteraction, deletePerson, logContact, nextBirthday, personStatus, plural, sortPeople } from './people'

const NOW = '2026-06-15'
const person = (over: Partial<Person> = {}): Person => ({ id: 1, name: 'Ann', relation: 'friend', cadenceDays: 14, ...over })

describe('personStatus', () => {
  it('no cadence: informational only, never overdue', () => {
    expect(personStatus(person({ cadenceDays: 0 }), NOW)).toEqual({ dueIn: null, text: 'No reminder', overdue: false })
    expect(personStatus(person({ cadenceDays: 0, lastContact: '2026-06-14' }), NOW)).toMatchObject({ dueIn: null, text: 'Last contact yesterday', overdue: false })
  })
  it('never contacted with a cadence is due now', () => {
    expect(personStatus(person(), NOW)).toEqual({ dueIn: 0, text: 'Due now · never logged', overdue: true })
  })
  it('due in the future', () => {
    expect(personStatus(person({ lastContact: '2026-06-10' }), NOW)).toEqual({ dueIn: 9, text: 'Due in 9 days', overdue: false })
    expect(personStatus(person({ lastContact: '2026-06-02' }), NOW)).toMatchObject({ dueIn: 1, text: 'Due in 1 day', overdue: false })
  })
  it('due today counts as overdue (action needed)', () => {
    expect(personStatus(person({ lastContact: '2026-06-01' }), NOW)).toEqual({ dueIn: 0, text: 'Due today', overdue: true })
  })
  it('overdue', () => {
    expect(personStatus(person({ lastContact: '2026-05-01' }), NOW)).toEqual({ dueIn: -31, text: 'Due 31 days ago', overdue: true })
    expect(personStatus(person({ lastContact: '2026-05-31' }), NOW)).toMatchObject({ dueIn: -1, text: 'Due 1 day ago' })
  })
  it('cadence arithmetic crosses month and year ends', () => {
    expect(personStatus(person({ cadenceDays: 7, lastContact: '2025-12-28' }), '2026-01-02')).toMatchObject({ dueIn: 2 })
  })
})

describe('sortPeople', () => {
  it('most overdue first, no-cadence last alphabetically, ties by name', () => {
    const list = [
      person({ id: 1, name: 'Zed', cadenceDays: 0 }),
      person({ id: 2, name: 'Bo', lastContact: '2026-06-14' }),
      person({ id: 3, name: 'Cy', lastContact: '2026-05-01' }),
      person({ id: 4, name: 'Al', cadenceDays: 0 }),
      person({ id: 5, name: 'Di', lastContact: '2026-05-01' }),
    ]
    expect(sortPeople(list, NOW).map((x) => x.p.name)).toEqual(['Cy', 'Di', 'Bo', 'Al', 'Zed'])
  })
  it('does not mutate input', () => {
    const list = [person({ name: 'B', cadenceDays: 0 }), person({ name: 'A', cadenceDays: 0 })]
    sortPeople(list, NOW)
    expect(list[0].name).toBe('B')
  })
})

describe('labels', () => {
  it('ago / plural / cadenceLabel', () => {
    expect(ago('2026-06-15', NOW)).toBe('today')
    expect(ago('2026-06-16', NOW)).toBe('today') // future clamps
    expect(ago('2026-06-14', NOW)).toBe('yesterday')
    expect(ago('2026-06-01', NOW)).toBe('14 days ago')
    expect(plural(1, 'day')).toBe('1 day')
    expect(plural(0, 'day')).toBe('0 days')
    expect(cadenceLabel(7)).toBe('Weekly')
    expect(cadenceLabel(45)).toBe('Every 45 days')
  })
})

describe('nextBirthday', () => {
  it('later this year, today, and rolled to next year', () => {
    expect(nextBirthday('09-20', NOW)).toBe('2026-09-20')
    expect(nextBirthday('06-15', NOW)).toBe('2026-06-15')
    expect(nextBirthday('06-14', NOW)).toBe('2027-06-14')
  })
  it('year-end rollover', () => {
    expect(nextBirthday('01-02', '2026-12-30')).toBe('2027-01-02')
  })
  it('rejects malformed input', () => {
    expect(nextBirthday('6-1', NOW)).toBeNull()
    expect(nextBirthday('', NOW)).toBeNull()
    expect(nextBirthday('June 1', NOW)).toBeNull()
  })
  it('Feb 29 birthday lands on a real date (known JS rollover to Mar 1 in non-leap years)', () => {
    expect(nextBirthday('02-29', '2026-01-10')).toBe('2026-03-01')
    expect(nextBirthday('02-29', '2027-12-01')).toBe('2028-02-29')
  })
})

describe('contact logging (db)', () => {
  async function make(over: Partial<Person> = {}) {
    const id = await db.people.add({ name: 'Ann', relation: 'friend', cadenceDays: 14, ...over })
    return (await db.people.get(id))!
  }

  it('logContact records the interaction, updates lastContact, logs an event', async () => {
    const p = await make()
    await logContact(p, 'call', '  catch up ', '2026-06-10')
    expect((await db.people.get(p.id!))!.lastContact).toBe('2026-06-10')
    expect(await db.interactions.toArray()).toMatchObject([{ personId: p.id, kind: 'call', note: 'catch up', date: '2026-06-10' }])
    const ev = await db.events.toArray()
    expect(ev).toHaveLength(1)
    expect(ev[0].title).toBe('Called Ann — catch up')
    expect(ev[0].area).toBe('relationships')
    expect(ev[0].at.startsWith('2026-06-10')).toBe(true) // backdated to the contact date
  })

  it('an older contact never moves lastContact backwards', async () => {
    const p = await make({ lastContact: '2026-06-10' })
    await logContact(p, 'text', undefined, '2026-06-01')
    expect((await db.people.get(p.id!))!.lastContact).toBe('2026-06-10')
    await logContact((await db.people.get(p.id!))!, 'in-person', undefined, '2026-06-12')
    expect((await db.people.get(p.id!))!.lastContact).toBe('2026-06-12')
  })

  it('deleteInteraction recomputes lastContact from what remains, or clears it', async () => {
    const p = await make()
    await logContact(p, 'text', undefined, '2026-06-01')
    await logContact((await db.people.get(p.id!))!, 'text', undefined, '2026-06-10')
    const [first, second] = (await db.interactions.orderBy('date').toArray())
    await deleteInteraction(second)
    expect((await db.people.get(p.id!))!.lastContact).toBe('2026-06-01')
    await deleteInteraction(first)
    expect((await db.people.get(p.id!))!.lastContact).toBeUndefined()
  })

  it('deletePerson removes their interactions only', async () => {
    const a = await make({ name: 'A' })
    const b = await make({ name: 'B' })
    await logContact(a, 'text', undefined, '2026-06-01')
    await logContact(b, 'text', undefined, '2026-06-01')
    await deletePerson(a)
    expect(await db.people.count()).toBe(1)
    expect((await db.interactions.toArray()).map((i) => i.personId)).toEqual([b.id])
  })

  it('no-ops for rows without ids', async () => {
    await logContact({ name: 'x', relation: '', cadenceDays: 0 }, 'text')
    await deletePerson({ name: 'x', relation: '', cadenceDays: 0 })
    expect(await db.interactions.count()).toBe(0)
  })
})
