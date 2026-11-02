// Informal-leadership counters (pure), derived from win tags by month.
import type { WinTag } from './impact'

export interface Win { id: number; date: string; title: string; tags: WinTag[]; impact?: { value: number; unit: string } }

export const LEAD_TAGS = ['mentoring', 'escalation', 'cross-team'] as const
export interface MonthCounts { month: string; wins: number; mentoring: number; escalation: number; 'cross-team': number }

/** Last `n` calendar months ending at `endMonth` (YYYY-MM), oldest first. */
export function monthRange(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export function monthlyCounts(wins: Win[], endMonth: string, n = 6): MonthCounts[] {
  const rows = new Map<string, MonthCounts>(monthRange(endMonth, n).map((month) => [month, { month, wins: 0, mentoring: 0, escalation: 0, 'cross-team': 0 }]))
  for (const w of wins) {
    const r = rows.get(w.date.slice(0, 7))
    if (!r) continue
    r.wins++
    for (const t of LEAD_TAGS) if (w.tags.includes(t)) r[t]++
  }
  return [...rows.values()]
}
