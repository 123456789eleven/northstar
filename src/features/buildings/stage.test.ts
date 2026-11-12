import { describe, expect, it } from 'vitest'
import { buildingStage, STAGES, type GymSnapshot, type ParkSnapshot, type TownSnapshot } from './stage'
import { gymSnapshotFrom, parkSnapshotFrom, townSnapshotFrom } from './useBuildingStage'

const empty: GymSnapshot = { goalSet: false, weighInsThisMonth: 0, mealDaysThisWeek: 0, trainingThisWeek: 0, trainingTarget: 4, flagsCrossed: 0 }

describe('buildingStage', () => {
  it('returns null for buildings without a stage or without data', () => {
    expect(buildingStage('money', {})).toBeNull()
    expect(buildingStage('body', {})).toBeNull()
  })

  it('starts the Gym dark and says the first step', () => {
    const s = buildingStage('body', { body: empty })!
    expect(s.stage).toBe(0)
    expect(s.steps).toHaveLength(STAGES)
    expect(s.line).toBe('Next: set a goal weight')
  })

  it('lights one window per concrete thing, in any order', () => {
    const s = buildingStage('body', { body: { ...empty, weighInsThisMonth: 4, trainingThisWeek: 4 } })!
    expect(s.stage).toBe(2)
    expect(s.steps.filter((x) => x.done).map((x) => x.id)).toEqual(['weigh', 'train'])
    expect(s.next?.id).toBe('goal')
  })

  it('counts what is left in plain words', () => {
    const s = buildingStage('body', { body: { ...empty, goalSet: true, weighInsThisMonth: 3 } })!
    expect(s.line).toBe('Next: 1 more weigh-in')
    const m = buildingStage('body', { body: { ...empty, goalSet: true, weighInsThisMonth: 5, mealDaysThisWeek: 2 } })!
    expect(m.line).toBe('Next: meals 3 more days')
    const t = buildingStage('body', { body: { ...empty, goalSet: true, weighInsThisMonth: 5, mealDaysThisWeek: 5, trainingThisWeek: 1, trainingTarget: 3 } })!
    expect(t.line).toBe('Next: 2 more sessions')
  })

  it('lights every window when all five are true', () => {
    const s = buildingStage('body', { body: { goalSet: true, weighInsThisMonth: 9, mealDaysThisWeek: 6, trainingThisWeek: 5, trainingTarget: 4, flagsCrossed: 2 } })!
    expect(s.stage).toBe(5)
    expect(s.next).toBeNull()
    expect(s.line).toBe('Every window lit')
  })

  it('keeps every label under four words', () => {
    for (const st of buildingStage('body', { body: empty })!.steps) expect(st.label.split(' ').length).toBeLessThan(4)
  })

  it('builds the Gym snapshot from real rows (month and Monday week)', () => {
    // 2026-11-11 is a Wednesday: the week runs Nov 9 to Nov 15.
    const snap = gymSnapshotFrom({
      settings: [{ key: 'body.goal', value: 150 }],
      weights: [{ date: '2026-10-20', weight: 130 }, { date: '2026-11-02', weight: 136 }, { date: '2026-11-05', weight: 137 }, { date: '2026-11-10', weight: 138 }],
      meals: [{ date: '2026-11-08' }, { date: '2026-11-09' }, { date: '2026-11-09' }, { date: '2026-11-11' }],
      habits: [{ id: 3, name: 'Lift', area: 'health', perWeek: 3, createdAt: '' }],
      logs: [{ habitId: 3, date: '2026-11-09' }, { habitId: 3, date: '2026-11-08' }, { habitId: 9, date: '2026-11-10' }],
    }, '2026-11-11')
    expect(snap).toEqual({ goalSet: true, weighInsThisMonth: 3, mealDaysThisWeek: 2, trainingThisWeek: 1, trainingTarget: 3, flagsCrossed: 1 })
  })

  it('treats a zero training target as one session', () => {
    expect(buildingStage('body', { body: { ...empty, trainingTarget: 0, trainingThisWeek: 1 } })!.steps[3].done).toBe(true)
  })
})

describe('Town hall and Park stages', () => {
  const town: TownSnapshot = { focusPinned: 0, doneToday: 0, blocksThisWeek: 0, seasonGoals: 0, habitDaysThisWeek: 0 }
  const park: ParkSnapshot = { people: 0, withRhythm: 0, reachedThisWeek: 0, warmthPct: null, overdue: 0 }

  it('lights Town hall windows from real plan activity', () => {
    expect(buildingStage('plan', { plan: town })!.line).toBe('Next: pin a task to today')
    const s = buildingStage('plan', { plan: { ...town, doneToday: 2, seasonGoals: 1, habitDaysThisWeek: 3 } })!
    expect(s.stage).toBe(3)
    expect(s.next?.id).toBe('focus')
    expect(buildingStage('plan', { plan: { focusPinned: 1, doneToday: 1, blocksThisWeek: 1, seasonGoals: 1, habitDaysThisWeek: 4 } })!.line).toBe('Every window lit')
  })

  it('counts Town hall data from rows for the week containing the day', () => {
    const snap = townSnapshotFrom({
      tasks: [{ status: 'open', focusDate: '2026-11-11' }, { status: 'done', doneAt: '2026-11-11T09:00:00.000Z', focusDate: '2026-11-10' }],
      goals: [{ status: 'active', horizon: 'quarter' }, { status: 'done', horizon: 'quarter' }],
      events: [{ title: 'Focus', date: '2026-11-12', allDay: false, uid: 'tb:task:3:abc' }, { title: 'Lunch', date: '2026-11-12', allDay: false }],
      logs: [{ date: '2026-11-09' }, { date: '2026-11-09' }, { date: '2026-11-10' }, { date: '2026-11-02' }],
    }, '2026-11-11')
    expect(snap).toEqual({ focusPinned: 1, doneToday: 1, blocksThisWeek: 1, seasonGoals: 1, habitDaysThisWeek: 2 })
  })

  it('lights Park windows and names who is waiting', () => {
    expect(buildingStage('people', { people: park })!.line).toBe('Next: 5 more people')
    const s = buildingStage('people', { people: { people: 6, withRhythm: 3, reachedThisWeek: 2, warmthPct: 40, overdue: 2 } })!
    expect(s.stage).toBe(3)
    expect(s.next?.id).toBe('warm')
  })

  it('reads the Park from people and weekly interactions', () => {
    const p = (id: number, cadenceDays: number, lastContact?: string) => ({ id, name: `P${id}`, relation: '', cadenceDays, lastContact })
    const snap = parkSnapshotFrom({ people: [p(1, 7, '2026-11-10'), p(2, 7, '2026-10-01'), p(3, 0)], interactions: [{ personId: 1, date: '2026-11-10' }, { personId: 1, date: '2026-11-11' }] }, '2026-11-11')
    expect(snap).toMatchObject({ people: 3, withRhythm: 2, reachedThisWeek: 1, overdue: 1 })
  })
})
