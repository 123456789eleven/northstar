// Pure trophy logic for the You hub: rarity, "New" moments, and the next attainable trophies. All derived from events and
// counts the app already has; nothing is stored and nothing is invented.
import type { LifeEvent } from '../../db'
import { weightCheckpoints } from '../goals/boss'

export type Rarity = 'Common' | 'Uncommon' | 'Rare'

/** How many trophies of the same kind exist: one is Rare, two to four Uncommon, five or more Common. */
export function rarity(sameKind: number): Rarity {
  if (sameKind <= 1) return 'Rare'
  if (sameKind <= 4) return 'Uncommon'
  return 'Common'
}

export function kindCounts(milestones: LifeEvent[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of milestones) m.set(e.kind, (m.get(e.kind) ?? 0) + 1)
  return m
}

export const NEW_DAYS = 7

/** A first-of-its-kind moment logged within the last 7 days. */
export function isNewMoment(e: LifeEvent, milestones: LifeEvent[], now: Date): boolean {
  if (now.getTime() - new Date(e.at).getTime() > NEW_DAYS * 86_400_000) return false
  return !milestones.some((o) => o.kind === e.kind && (o.at < e.at || (o.at === e.at && (o.id ?? 0) < (e.id ?? 0))))
}

export interface TrophyState {
  workouts: number
  wins: number
  tasksDone: number
  reviews: number
  weight?: { start: number; target: number; current: number }
}

export interface NextTrophy {
  id: string
  title: string
  hint: string
  /** 0..1 toward it. */
  progress: number
  href: string
}

export const LADDERS = {
  workouts: [1, 10, 25, 50, 100],
  wins: [1, 5, 10, 30, 50, 100],
  tasks: [10, 50, 100, 250, 500],
  reviews: [1, 4, 12, 26, 52],
} as const

const nextRung = (count: number, ladder: readonly number[]) => ladder.find((n) => n > count)

function rung(id: string, count: number, ladder: readonly number[], one: string, many: (n: number) => string, unit: string, href: string): NextTrophy | null {
  const n = nextRung(count, ladder)
  if (n == null) return null
  return { id, title: n === 1 ? one : many(n), hint: `${count} of ${n} ${unit}`, progress: count / n, href }
}

/** Up to five trophies you can still reach, the closest first. */
export function nextTrophies(s: TrophyState, max = 5): NextTrophy[] {
  const out: NextTrophy[] = []
  const push = (t: NextTrophy | null) => { if (t) out.push(t) }
  if (s.weight) {
    const flags = weightCheckpoints(s.weight.start, s.weight.target, s.weight.current)
    const i = flags.findIndex((f) => !f.reached)
    if (i >= 0) {
      const from = i === 0 ? 0 : flags[i - 1].pos
      const span = Math.abs(s.weight.target - s.weight.start)
      const done = span > 0 ? (Math.abs(s.weight.current - s.weight.start) / span) * 100 : 0
      const progress = Math.min(1, Math.max(0, (done - from) / (flags[i].pos - from)))
      out.push({ id: 'weight', title: `Weight checkpoint: ${flags[i].label} lb`, hint: `Now ${Math.round(s.weight.current * 10) / 10} lb`, progress, href: '/body' })
    }
  }
  push(rung('workouts', s.workouts, LADDERS.workouts, 'Your first workout', (n) => `${n} workouts logged`, 'workouts', '/habits'))
  push(rung('wins', s.wins, LADDERS.wins, 'Your first career win', (n) => `${n} wins logged`, 'wins', '/career'))
  push(rung('tasks', s.tasksDone, LADDERS.tasks, 'First task done', (n) => `${n} tasks done`, 'tasks', '/tasks'))
  push(rung('reviews', s.reviews, LADDERS.reviews, 'Your first season recap', (n) => `${n} weekly recaps`, 'recaps', '/review'))
  return out.sort((a, b) => b.progress - a.progress).slice(0, max)
}
