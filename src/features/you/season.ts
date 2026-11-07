// Pure season math: a season is the calendar quarter. Reuses the goals quarter bounds so the year boundary is handled once.
import type { ISODate } from '../../db'
import { daysBetween } from '../../lib/dates'
import { quarterRange } from '../goals/boss'

export interface Season {
  name: string
  start: ISODate
  end: ISODate
  /** Whole days left after `day` (0 on the last day). */
  daysLeft: number
  totalDays: number
  /** 0..1 of the quarter elapsed, counting `day` as elapsed. */
  elapsed: number
}

export function seasonOf(day: ISODate): Season {
  const { start, end } = quarterRange(day)
  const q = Math.floor((Number(day.slice(5, 7)) - 1) / 3) + 1
  const totalDays = daysBetween(start, end) + 1
  const daysLeft = Math.max(0, daysBetween(day, end))
  return { name: `Q${q} ${day.slice(0, 4)}`, start, end, daysLeft, totalDays, elapsed: (totalDays - daysLeft) / totalDays }
}

export type StoryId = 'summary' | 'wins' | 'slipped' | 'numbers' | 'next'

/** Five story cards: the summary opens, the next-week plan closes, and in between whatever has content comes first. */
export function storyOrder(has: { wins: boolean; slipped: boolean; numbers: boolean }): StoryId[] {
  const mid: Array<'wins' | 'slipped' | 'numbers'> = ['wins', 'slipped', 'numbers']
  const sorted = mid.map((id, i) => ({ id, i })).sort((a, b) => Number(!has[a.id]) - Number(!has[b.id]) || a.i - b.i).map((x) => x.id)
  return ['summary', ...sorted, 'next']
}

/** The coach note under a season goal, from real progress against the share of the season already gone. */
export function paceNote(progress: number, elapsed: number, daysLeft: number): string {
  const done = Math.round(progress * 100)
  const gone = Math.round(elapsed * 100)
  if (progress >= 1) return 'Season goal met.'
  if (progress >= elapsed - 0.05) return `On pace: ${done}% done with ${gone}% of the season gone.`
  return `Behind pace: ${done}% done with ${gone}% of the season gone. ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left.`
}
