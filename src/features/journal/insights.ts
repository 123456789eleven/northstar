// Pure helpers for the month map, tag chips, search highlight, lookback and tag editing.
import type { ISODate, JournalEntry } from '../../db'
import { wordCount } from './stats'

export const DEFAULT_GOAL = 150

/** 0 = nothing written; 1-4 = share of the daily goal (<25%, <50%, <100%, goal met). */
export function shadeLevel(words: number, goal = DEFAULT_GOAL): 0 | 1 | 2 | 3 | 4 {
  if (words <= 0) return 0
  const r = words / Math.max(1, goal)
  return r < 0.25 ? 1 : r < 0.5 ? 2 : r < 1 ? 3 : 4
}

export interface DayCell { date: ISODate | null; day: number; words: number; level: 0 | 1 | 2 | 3 | 4 }

/** Cells for a month (YYYY-MM), Monday-first, with null-date padding at the start. */
export function monthCells(month: string, entries: Pick<JournalEntry, 'date' | 'text'>[], goal = DEFAULT_GOAL): DayCell[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(y, m, 0).getDate()
  const words = new Map<string, number>()
  for (const e of entries) if (e.date.startsWith(month)) words.set(e.date, wordCount(e.text))
  const cells: DayCell[] = Array.from({ length: lead }, () => ({ date: null, day: 0, words: 0, level: 0 as const }))
  for (let d = 1; d <= days; d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    const w = words.get(date) ?? 0
    cells.push({ date, day: d, words: w, level: shadeLevel(w, goal) })
  }
  return cells
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Tags by use, most used first. */
export function tagCounts(entries: Pick<JournalEntry, 'tags'>[]): { tag: string; n: number }[] {
  const c = new Map<string, number>()
  for (const e of entries) for (const t of e.tags ?? []) c.set(t, (c.get(t) ?? 0) + 1)
  return [...c].map(([tag, n]) => ({ tag, n })).sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag))
}

export const SUGGESTED_TAGS = ['career', 'training', 'money', 'people']

/** Suggested tags first, then the user's most used ones; unique, capped. */
export function tagSuggestions(recent: { tag: string }[], limit = 8): string[] {
  return [...new Set([...SUGGESTED_TAGS, ...recent.map((r) => r.tag)])].slice(0, limit)
}

export interface Seg { text: string; hit: boolean }

/** Split text around case-insensitive matches of q for highlighting. */
export function highlight(text: string, q: string): Seg[] {
  const needle = q.trim().replace(/^#/, '').toLowerCase()
  if (!needle) return [{ text, hit: false }]
  const out: Seg[] = []
  const low = text.toLowerCase()
  let i = 0
  for (;;) {
    const at = low.indexOf(needle, i)
    if (at < 0) break
    if (at > i) out.push({ text: text.slice(i, at), hit: false })
    out.push({ text: text.slice(at, at + needle.length), hit: true })
    i = at + needle.length
  }
  if (i < text.length) out.push({ text: text.slice(i), hit: false })
  return out.length ? out : [{ text, hit: false }]
}

/** A one-line excerpt around the first match (or the first line when no match). */
export function snippet(text: string, q: string, radius = 60): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const needle = q.trim().replace(/^#/, '').toLowerCase()
  const at = needle ? flat.toLowerCase().indexOf(needle) : -1
  if (at < 0) return text.trim().split('\n')[0] ?? ''
  const start = Math.max(0, at - radius)
  const end = Math.min(flat.length, at + needle.length + radius)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

const isTagLine = (l: string) => l.trim() !== '' && l.trim().split(/\s+/).every((w) => /^#[\p{L}\p{N}_-]+$/u.test(w))

/** Add or remove #tag. Tags live on a trailing tag-only line. */
export function toggleTag(text: string, tag: string): string {
  const lines = text.replace(/\s+$/, '').split('\n')
  const last = lines[lines.length - 1] ?? ''
  if (isTagLine(last) && last.split(/\s+/).includes(`#${tag}`)) {
    const rest = last.split(/\s+/).filter((w) => w !== `#${tag}`).join(' ')
    if (rest) { lines[lines.length - 1] = rest; return lines.join('\n') }
    lines.pop()
    return lines.join('\n').replace(/\s+$/, '')
  }
  if (isTagLine(last)) { lines[lines.length - 1] = `${last.trim()} #${tag}`; return lines.join('\n') }
  return text.trim() ? `${lines.join('\n')}\n\n#${tag}` : `#${tag}`
}

const MONTH_OFFSETS = [1, 2, 3, 6, 9, 12, 18, 24, 36, 48, 60]

export interface Lookback { entry: JournalEntry; label: string }

/** Entries written the same day-of-month in earlier months and years (not today). */
export function lookback(entries: JournalEntry[], today: ISODate): Lookback[] {
  const [y, m, d] = today.split('-').map(Number)
  const by = new Map(entries.filter((e) => e.text.trim()).map((e) => [e.date, e]))
  const out: Lookback[] = []
  for (const n of MONTH_OFFSETS) {
    const dt = new Date(y, m - 1 - n, d)
    if (dt.getDate() !== d) continue // day does not exist in that month
    const date = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const entry = by.get(date)
    if (!entry) continue
    out.push({ entry, label: n % 12 === 0 ? `${n / 12} ${n === 12 ? 'year' : 'years'} ago` : `${n} ${n === 1 ? 'month' : 'months'} ago` })
  }
  return out
}
