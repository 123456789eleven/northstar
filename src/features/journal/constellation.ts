// Pure helpers for the journal's writing ring and mood constellation.
import type { ISODate, JournalEntry } from '../../db'
import { addDays } from '../../lib/dates'
import { STREAK_WORDS, wordCount } from './stats'

export const MIN_STAR = 2.2
export const MAX_STAR = 9

/** Star radius in px for a day: 0 words = no star; sqrt scale so short entries stay visible; caps at 1.5x the goal. */
export function moodStarSize(words: number, goal: number): number {
  if (!(words > 0)) return 0
  const r = Math.min(1.5, words / Math.max(1, goal)) / 1.5
  return Math.round((MIN_STAR + (MAX_STAR - MIN_STAR) * Math.sqrt(r)) * 100) / 100
}

/** Mood 1..5 maps to powder blue scale step 1..5; unrated = 0 (neutral grey star). */
export function moodStep(mood: number | undefined | null): 0 | 1 | 2 | 3 | 4 | 5 {
  if (mood == null || !Number.isFinite(mood) || mood < 1) return 0
  return Math.min(5, Math.round(mood)) as 1 | 2 | 3 | 4 | 5
}

/** Days with at least STREAK_WORDS words in the week starting `weekStart` (7 days, up to `today`). */
export function weekDaysWritten(entries: Pick<JournalEntry, 'date' | 'text'>[], weekStart: ISODate, today: ISODate, min = STREAK_WORDS): number {
  const end = addDays(weekStart, 6)
  const days = new Set<string>()
  for (const e of entries) if (e.date >= weekStart && e.date <= end && e.date <= today && wordCount(e.text) >= min) days.add(e.date)
  return days.size
}

/** 0..1, clamped. */
export const fraction = (value: number, target: number) => (target > 0 ? Math.max(0, Math.min(1, value / target)) : 0)

export interface Star { date: ISODate; day: number; words: number; r: number; step: 0 | 1 | 2 | 3 | 4 | 5 }

/** One star per day of a month (YYYY-MM) with its radius and mood step. Days without writing have r = 0. */
export function monthStars(month: string, entries: Pick<JournalEntry, 'date' | 'text' | 'mood'>[], goal: number): { lead: number; stars: Star[] } {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const n = new Date(y, m, 0).getDate()
  const by = new Map(entries.filter((e) => e.date.startsWith(month)).map((e) => [e.date, e]))
  const stars: Star[] = []
  for (let d = 1; d <= n; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const e = by.get(date)
    const words = e ? wordCount(e.text) : 0
    stars.push({ date, day: d, words, r: moodStarSize(words, goal), step: moodStep(e?.mood) })
  }
  return { lead, stars }
}
