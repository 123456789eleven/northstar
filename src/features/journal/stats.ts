// Pure journal helpers.
import type { ISODate, JournalEntry } from '../../db'
import { addDays } from '../../lib/dates'

/** A day counts toward the writing streak at this many words. */
export const STREAK_WORDS = 10

export const wordCount = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0)

export function extractTags(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu)) out.add(m[1].toLowerCase())
  return [...out]
}

export function wordStreak(entries: Pick<JournalEntry, 'date' | 'text'>[], today: ISODate, min = STREAK_WORDS): number {
  const ok = new Set(entries.filter((e) => wordCount(e.text) >= min).map((e) => e.date))
  let d = ok.has(today) ? today : addDays(today, -1)
  let n = 0
  while (ok.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export interface MoodPoint {
  date: ISODate
  mood: number | null
  energy: number | null
}

/** One point per day for the last `days` days; gaps are null so the chart can break the line. */
export function moodSeries(entries: JournalEntry[], today: ISODate, days = 90): MoodPoint[] {
  const by = new Map(entries.map((e) => [e.date, e]))
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1))
    const e = by.get(date)
    return { date, mood: e?.mood ?? null, energy: e?.energy ?? null }
  })
}

/** Entries written on today's month/day in earlier years, newest first. */
export function onThisDay(entries: JournalEntry[], today: ISODate): JournalEntry[] {
  const md = today.slice(5)
  return entries
    .filter((e) => e.date.slice(5) === md && e.date < today && e.text.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function matchesSearch(e: JournalEntry, q: string): boolean {
  const needle = q.trim().toLowerCase()
  if (!needle) return true
  return e.text.toLowerCase().includes(needle) || (e.tags ?? []).some((t) => t.includes(needle.replace(/^#/, '')))
}

/** Group newest-first by YYYY-MM. */
export function groupByMonth(entries: JournalEntry[]): { month: string; entries: JournalEntry[] }[] {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const out: { month: string; entries: JournalEntry[] }[] = []
  for (const e of sorted) {
    const m = e.date.slice(0, 7)
    const last = out[out.length - 1]
    if (last?.month === m) last.entries.push(e)
    else out.push({ month: m, entries: [e] })
  }
  return out
}
