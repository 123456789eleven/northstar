import { describe, expect, it } from 'vitest'
import { paceNote } from './pace'

describe('paceNote', () => {
  it('asks for data when rate is unknown', () => {
    expect(paceNote({ rate: null, current: 140, goal: 165, neededRate: null }).tone).toBe('idle')
  })
  it('reports gaining pace with a projection', () => {
    const n = paceNote({ rate: 0.6, current: 140, goal: 165, neededRate: null, projected: 'about Mar 3' })
    expect(n).toEqual({ tone: 'ok', text: 'Gaining 0.6 lb/wk. 165 lb about Mar 3.' })
  })
  it('is honest when slower than the goal date needs', () => {
    const n = paceNote({ rate: 0.4, current: 140, goal: 165, neededRate: 0.9, projected: 'about Jun 1' })
    expect(n.tone).toBe('slow')
    expect(n.text).toContain('needs 0.9 lb/wk')
  })
  it('flags a flat trend', () => {
    expect(paceNote({ rate: -0.2, current: 140, goal: 165, neededRate: null }).tone).toBe('flat')
  })
  it('recognises goal reached', () => {
    expect(paceNote({ rate: 0.5, current: 165, goal: 165, neededRate: null }).tone).toBe('done')
  })
})
