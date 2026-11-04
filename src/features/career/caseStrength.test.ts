import { describe, expect, it } from 'vitest'
import { computeCaseStrength, nextToStrengthen, type CaseStrengthInput } from './caseStrength'

const T = '2026-11-02'
const empty: CaseStrengthInput = { today: T, wins: [], projects: [], notes: [], goals: [] }
const m = (value: number) => ({ value, unit: '', date: T })

describe('computeCaseStrength', () => {
  it('is 0 with nothing and names the first segment to strengthen', () => {
    const r = computeCaseStrength(empty)
    expect(r.score).toBe(0)
    expect(r.segments).toHaveLength(5)
    expect(r.next?.key).toBe('wins')
  })
  it('counts only wins from the last 90 days', () => {
    expect(computeCaseStrength({ ...empty, wins: [{ date: '2026-06-01', tags: ['client'] }] }).segments[0].points).toBe(0)
    expect(computeCaseStrength({ ...empty, wins: [{ date: '2026-10-30', tags: ['client'] }] }).segments[0].points).toBeGreaterThan(0)
  })
  it('scores a project by baseline, result and improvement', () => {
    const seg = (p: object) => computeCaseStrength({ ...empty, projects: [{ better: 'lower', featured: true, ...p }] }).segments[1].points
    expect(seg({})).toBe(0)
    expect(seg({ baseline: m(10) })).toBe(8)
    expect(seg({ baseline: m(10), result: m(4) })).toBe(20)
    expect(seg({ baseline: m(10), result: m(12) })).toBe(16)
  })
  it('reaches 100 when everything is covered', () => {
    const wins = [
      { date: '2026-10-20', tags: ['mentoring'] }, { date: '2026-10-21', tags: ['mentoring'] }, { date: '2026-10-22', tags: ['mentoring'] },
      { date: '2026-10-23', tags: ['escalation'] }, { date: '2026-10-24', tags: ['escalation'] },
      { date: '2026-10-25', tags: ['client'] }, { date: '2026-10-26', tags: ['reliability'] },
    ] as CaseStrengthInput['wins']
    const r = computeCaseStrength({
      today: T, wins,
      projects: [{ better: 'lower', featured: true, baseline: m(10), result: m(5) }],
      notes: [1, 2, 3].map((n) => ({ date: `2026-10-0${n}`, feedback: ['good'] })),
      goals: [{ pct: 100 }],
    })
    expect(r.score).toBe(100)
    expect(r.next).toBeNull()
  })
  it('picks the weakest segment, earliest on ties', () => {
    const r = computeCaseStrength({ ...empty, goals: [{ pct: 50 }], notes: [{ date: '2026-10-01', feedback: ['x'] }] })
    expect(r.next?.key).toBe('wins')
    const segs = r.segments.map((s) => ({ ...s, points: s.key === 'feedback' ? 2 : 10 }))
    expect(nextToStrengthen(segs)?.key).toBe('feedback')
  })
})
