import { describe, expect, it } from 'vitest'
import { coachNote, expectedShare } from './coach'

const goal = { status: 'active' as const, createdAt: '2026-10-01T00:00:00.000Z', targetDate: '2026-12-31' }

describe('expectedShare', () => {
  it('is about half at mid-season', () => {
    expect(expectedShare(goal, '2026-11-15')).toBeCloseTo(0.5, 1)
  })
  it('clamps after the target', () => {
    expect(expectedShare(goal, '2026-12-31')).toBe(1)
  })
})

describe('coachNote', () => {
  it('stays plain without milestones', () => {
    expect(coachNote({ goal, progress: 0.1, basis: 'tasks', today: '2026-11-15' }).text).toBe('Behind pace.')
  })
  it('says met when complete', () => {
    expect(coachNote({ goal, progress: 1, basis: 'metric', today: '2026-11-15' })).toEqual({ tone: 'met', text: 'Goal met.' })
  })
  it('asks for tracking when nothing is tracked', () => {
    expect(coachNote({ goal, progress: 0, basis: 'none', today: '2026-11-15' }).tone).toBe('idle')
  })
  it('flags behind pace in milestones', () => {
    const n = coachNote({ goal, progress: 0.2, basis: 'milestones', today: '2026-11-15', milestones: 4 })
    expect(n.tone).toBe('behind')
    expect(n.text).toMatch(/^\d+ milestones? behind pace\.$/)
  })
  it('is on pace inside the band', () => {
    expect(coachNote({ goal, progress: 0.52, basis: 'tasks', today: '2026-11-15' }).tone).toBe('on')
  })
  it('speaks in pounds for weight goals', () => {
    const n = coachNote({ goal, progress: 0.2, basis: 'metric', today: '2026-11-15', weight: { start: 135, value: 140, target: 165 } })
    expect(n.tone).toBe('behind')
    expect(n.text).toMatch(/lb behind the pace line\.$/)
  })
})
