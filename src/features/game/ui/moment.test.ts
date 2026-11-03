import { describe, expect, it } from 'vitest'
import { momentFor } from './moment'
import { EMPTY_PLAYER } from './playerContext'

const base = { level: 2, skills: { body: 2, money: 1, mind: 1, career: 1, people: 1 }, cleared: false }
const player = (over: Partial<typeof EMPTY_PLAYER>) => ({ ...EMPTY_PLAYER, level: 2, skills: EMPTY_PLAYER.skills.map((s) => ({ ...s, level: s.id === 'body' ? 2 : 1 })), ...over })

describe('momentFor', () => {
  it('never fires without a baseline (first load)', () => {
    expect(momentFor(null, player({ level: 9, cleared: true }))).toBeNull()
  })
  it('fires on a level-up, a skill-up and a day clear, in that priority', () => {
    expect(momentFor(base, player({ level: 3 }))?.kicker).toBe('Level up')
    const skills = player({}).skills.map((s) => (s.id === 'mind' ? { ...s, level: 2 } : s))
    expect(momentFor(base, player({ skills }))?.title).toBe('Mind 2')
    expect(momentFor(base, player({ cleared: true }))?.kicker).toBe('Day cleared')
  })
  it('stays quiet when nothing rose, and in Calm mode', () => {
    expect(momentFor(base, player({}))).toBeNull()
    expect(momentFor(base, player({ level: 5, calm: true }))).toBeNull()
  })
})
