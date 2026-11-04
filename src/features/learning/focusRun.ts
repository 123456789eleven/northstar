// Pure reducer for a Learning focus run: a count-up timer with pause/resume and an optional target.
// Time is always passed in (ms epoch), never read here. Elapsed time is the sum of running segments, so a paused
// run does not count and a run that crosses local midnight is split into per-day minutes.
import { toISODate } from '../../lib/dates'

export interface Segment { from: number; to: number | null }
export type FocusRun =
  | { phase: 'idle' }
  | { phase: 'running' | 'paused'; itemId: number; targetMin: number | null; segments: Segment[] }

export type FocusAction =
  | { type: 'start'; itemId: number; targetMin: number | null; now: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'target'; targetMin: number | null }
  | { type: 'reset' }

export const IDLE: FocusRun = { phase: 'idle' }
export const TARGETS = [25, 45, 60] as const

export function focusReducer(s: FocusRun, a: FocusAction): FocusRun {
  switch (a.type) {
    case 'start':
      return s.phase === 'idle' ? { phase: 'running', itemId: a.itemId, targetMin: a.targetMin, segments: [{ from: a.now, to: null }] } : s
    case 'pause':
      return s.phase === 'running' ? { ...s, phase: 'paused', segments: s.segments.map((g) => (g.to == null ? { ...g, to: Math.max(g.from, a.now) } : g)) } : s
    case 'resume':
      return s.phase === 'paused' ? { ...s, phase: 'running', segments: [...s.segments, { from: a.now, to: null }] } : s
    case 'target':
      return s.phase === 'idle' ? s : { ...s, targetMin: a.targetMin }
    case 'reset':
      return IDLE
  }
}

export function elapsedMs(s: FocusRun, now: number): number {
  if (s.phase === 'idle') return 0
  return s.segments.reduce((n, g) => n + Math.max(0, (g.to ?? now) - g.from), 0)
}

/** 0..1 toward the target; 0 when there is no target. */
export function targetProgress(s: FocusRun, now: number): number {
  if (s.phase === 'idle' || !s.targetMin) return 0
  return Math.min(1, elapsedMs(s, now) / (s.targetMin * 60_000))
}

/** "mm:ss" (or "h:mm:ss" past an hour). */
export function formatClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

/** Running time per local calendar day, in whole minutes (rounded per day; days under 30 s drop out). */
export function minutesByDay(s: FocusRun, now: number): { date: string; minutes: number }[] {
  if (s.phase === 'idle') return []
  const ms = new Map<string, number>()
  for (const g of s.segments) {
    let from = g.from
    const to = g.to ?? now
    while (from < to) {
      const d = new Date(from)
      const nextMidnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime()
      const end = Math.min(to, nextMidnight)
      const date = toISODate(d)
      ms.set(date, (ms.get(date) ?? 0) + (end - from))
      from = end
    }
  }
  return [...ms].map(([date, v]) => ({ date, minutes: Math.round(v / 60_000) })).filter((x) => x.minutes > 0).sort((a, b) => a.date.localeCompare(b.date))
}
