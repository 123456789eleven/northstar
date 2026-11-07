import { describe, expect, it } from 'vitest'
import { momentFor } from './moment'
import { EMPTY_PLAYER } from './playerContext'

const q = (n: number) => Array.from({ length: n }, (_, i) => ({ ...EMPTY_PLAYER.quests[0], id: String(i) })) as typeof EMPTY_PLAYER.quests
const player = (done: number, total: number) => ({ quests: q(total), questsDone: done, cleared: total > 0 && done === total })

describe('momentFor', () => {
  it('never fires without a baseline (first load)', () => {
    expect(momentFor(null, player(5, 5))).toBeNull()
  })
  it('fires when the same plan gains a finished item, and says so plainly when the plan is done', () => {
    expect(momentFor({ done: 1, total: 5 }, player(2, 5))).toMatchObject({ title: 'Done', done: 2, total: 5 })
    expect(momentFor({ done: 4, total: 5 }, player(5, 5))).toMatchObject({ title: 'Plan done', done: 5 })
  })
  it('stays quiet when nothing rose, the plan changed shape, or it is a new day', () => {
    expect(momentFor({ done: 2, total: 5 }, player(2, 5))).toBeNull()
    expect(momentFor({ done: 2, total: 4 }, player(3, 5))).toBeNull()
    expect(momentFor({ done: 3, total: 5 }, player(0, 5))).toBeNull()
    expect(momentFor({ done: 0, total: 0 }, player(0, 0))).toBeNull()
  })
})
