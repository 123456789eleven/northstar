// Which small toast (if any) a change in the plan earns. Pure, so it is unit-tested (moment.test.ts).
// One kind of moment: a plan item ticked off, or the whole plan done. No levels, no ranks.
import type { PlayerState } from '../types'

export interface Moment { id: number; title: string; sub: string; done: number; total: number }
export interface Base { done: number; total: number }

/** No baseline (first loaded state) = never. Fires only when the same plan gained a completed item. */
export function momentFor(b: Base | null, p: Pick<PlayerState, 'questsDone' | 'quests' | 'cleared'>): Omit<Moment, 'id'> | null {
  if (!b) return null
  const total = p.quests.length
  if (total === 0 || total !== b.total || p.questsDone <= b.done) return null
  return p.cleared
    ? { title: 'Plan done', sub: 'Everything planned for today is done.', done: p.questsDone, total }
    : { title: 'Done', sub: `${total - p.questsDone} left on today's plan.`, done: p.questsDone, total }
}
