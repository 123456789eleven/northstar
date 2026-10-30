// Pure helpers for the guided setup wizard (no DB access): name matching, dates, line parsing.
import type { Area, ISODate, Person } from '../../db'
import { toISODate } from '../../lib/dates'
import { parseTask, type CaptureContext, type TaskCapture } from '../../lib/capture'

export const SETUP_DONE_KEY = 'ui.setup.done'
export const SETUP_EVENT = 'northstar:open-setup'
/** Open the setup wizard from anywhere a SetupHost is mounted. */
export const openSetup = () => window.dispatchEvent(new Event(SETUP_EVENT))
export const WEEKLY_TARGET_KEY = 'learning.weeklyTargetMin'

/** Case/whitespace-insensitive key for duplicate checks. */
export const nameKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Split incoming names into new ones and duplicates (of existing names or of each other). Blanks are dropped. */
export function dedupeNames(existing: string[], incoming: string[]): { fresh: string[]; dupes: string[] } {
  const seen = new Set(existing.map(nameKey))
  const fresh: string[] = []
  const dupes: string[] = []
  for (const raw of incoming) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const k = nameKey(name)
    if (seen.has(k)) dupes.push(name)
    else { seen.add(k); fresh.push(name) }
  }
  return { fresh, dupes }
}

export function quarterEnd(now: Date = new Date()): ISODate {
  const q = Math.floor(now.getMonth() / 3)
  return toISODate(new Date(now.getFullYear(), q * 3 + 3, 0))
}

export function yearEnd(now: Date = new Date()): ISODate {
  return toISODate(new Date(now.getFullYear(), 11, 31))
}

/** Positive whole number from a text field ("$1,200", "150g"); blank/invalid -> undefined. */
export function parseAmount(s: string): number | undefined {
  const t = s.replace(/[$,\s]/g, '').replace(/[a-z]+$/i, '')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
}

/** "3/14", "03-14", "3/14/1990", "1990-03-14" -> "MM-DD". Invalid -> undefined. */
export function parseBirthday(s: string): Person['birthday'] {
  const t = s.trim()
  if (!t) return undefined
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t)
  let mo: number, da: number
  if (m) { mo = +m[2]; da = +m[3] } else {
    m = /^(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?$/.exec(t)
    if (!m) return undefined
    mo = +m[1]; da = +m[2]
  }
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return undefined
  const maxDay = new Date(2024, mo, 0).getDate() // leap year so Feb 29 is allowed
  if (da > maxDay) return undefined
  return `${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`
}

/** Strip list markers ("- ", "* ", "1. ", "[ ] ") from a pasted line. */
export function stripListMarker(line: string): string {
  return line.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)?(?:\[[ xX]?\]\s+)?/, '').trim()
}

/** One task per non-empty line, parsed with the shared capture parser. Lines with no title left are dropped. */
export function parseTaskLines(text: string, ctx: CaptureContext = {}): TaskCapture[] {
  return text
    .split(/\r?\n/)
    .map(stripListMarker)
    .filter(Boolean)
    .map((l) => parseTask(l, ctx))
    .filter((t) => t.title)
}

export interface HabitSuggestion { name: string; area: Area; perWeek: number }
export const HABIT_SUGGESTIONS: HabitSuggestion[] = [
  { name: 'Walk 20 minutes', area: 'health', perWeek: 7 },
  { name: 'Drink water', area: 'health', perWeek: 7 },
  { name: 'Strength training', area: 'health', perWeek: 3 },
  { name: 'Stretch', area: 'health', perWeek: 5 },
  { name: 'Sleep by 11pm', area: 'health', perWeek: 5 },
  { name: 'Read 20 minutes', area: 'learning', perWeek: 5 },
  { name: 'Journal', area: 'personal', perWeek: 5 },
  { name: 'Meditate', area: 'personal', perWeek: 5 },
  { name: 'Review budget', area: 'finance', perWeek: 1 },
]

export const BUDGET_CATEGORIES = ['Housing', 'Utilities', 'Groceries', 'Dining', 'Transport', 'Gas', 'Health', 'Insurance', 'Subscriptions', 'Shopping', 'Entertainment']
export const RELATIONS = ['Family', 'Friend', 'Partner', 'Colleague', 'Mentor']
export const CADENCE_PICKS: { days: number; label: string }[] = [
  { days: 7, label: 'Weekly' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
  { days: 0, label: 'None' },
]
export const WEEKLY_MINUTES = [60, 120, 180, 300]
