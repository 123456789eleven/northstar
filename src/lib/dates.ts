// Local-time date helpers. All app dates are YYYY-MM-DD in the user's local timezone.
import type { ISODate } from '../db'

const pad = (n: number) => String(n).padStart(2, '0')

export function toISODate(d: Date = new Date()): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const today = () => toISODate()

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s)
  d.setDate(d.getDate() + n)
  return toISODate(d)
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000)
}

/** Monday of the week containing s. */
export function startOfWeek(s: ISODate = today()): ISODate {
  const d = parseISODate(s)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

/** YYYY-MM */
export const monthKey = (s: ISODate = today()) => s.slice(0, 7)

export function formatDate(s: ISODate, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return parseISODate(s).toLocaleDateString(undefined, opts)
}

export function relativeDay(s: ISODate): string {
  const diff = daysBetween(today(), s)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < 0) return `${-diff}d ago`
  if (diff < 7) return parseISODate(s).toLocaleDateString(undefined, { weekday: 'short' })
  return formatDate(s)
}

export const money = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2 })
