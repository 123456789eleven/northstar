import { describe, expect, it } from 'vitest'
import { buildingStage, STAGES, type GymSnapshot } from './stage'
import { gymSnapshotFrom, homeSnapshotFrom } from './useBuildingStage'

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

describe('home base stage', () => {
  it('lights one window per real step', () => {
    const none = buildingStage('you', { you: { backupThisMonth: false, safeCopy: false, interviewAnswers: 3, badgesEarned: 0, standingReady: false } })!
    expect(none.stage).toBe(0)
    expect(none.line).toBe('Next: make a backup this month')
    const some = homeSnapshotFrom({ backupAt: '2026-11-02T10:00:00Z', backupEncrypted: true, syncOn: false, answers: {}, badgesEarned: 2, standingReady: true }, '2026-11-11')
    const s = buildingStage('you', { you: some })!
    expect(s.steps.filter((x) => x.done).map((x) => x.id)).toEqual(['backup', 'safe', 'badge', 'standing'])
    expect(s.next?.id).toBe('interview')
  })
  it('a backup from another month does not count', () => {
    expect(homeSnapshotFrom({ backupAt: '2026-10-30T10:00:00Z', backupEncrypted: null, syncOn: true, answers: {}, badgesEarned: 0, standingReady: false }, '2026-11-11').backupThisMonth).toBe(false)
  })
})
