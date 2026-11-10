// Pure journal logic: validation, search/filter, plan maths and the review summary. Journal text is private and stays here.
import type { TradeJournalEntry } from '../../db'

export const EMOTIONS = ['Calm', 'Confident', 'Anxious', 'Impatient', 'Fear of missing out', 'Frustrated', 'Bored'] as const

export interface JournalDraft {
  date: string; symbol: string; thesis: string; setup: string; emotion: string; tags: string
  entry: string; stop: string; target: string; outcome: string; lesson: string
  followedPlan: '' | 'yes' | 'no'; tradeId?: number
}

export const blankDraft = (date: string, symbol = '', tradeId?: number): JournalDraft => ({
  date, symbol, thesis: '', setup: '', emotion: '', tags: '', entry: '', stop: '', target: '', outcome: '', lesson: '', followedPlan: '', tradeId,
})

export const draftFromEntry = (e: TradeJournalEntry): JournalDraft => ({
  date: e.date, symbol: e.symbol, thesis: e.thesis, setup: e.setup ?? '', emotion: e.emotion ?? '', tags: (e.tags ?? []).join(', '),
  entry: e.plan?.entry?.toString() ?? '', stop: e.plan?.stop?.toString() ?? '', target: e.plan?.target?.toString() ?? '',
  outcome: e.outcome ?? '', lesson: e.lesson ?? '', followedPlan: e.followedPlan === undefined ? '' : e.followedPlan ? 'yes' : 'no', tradeId: e.tradeId,
})

export const parseTags = (s: string): string[] => [...new Set(s.split(/[,\n]/).map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter(Boolean))].slice(0, 12)

const optNum = (s: string, label: string): { v?: number; err?: string } => {
  if (!s.trim()) return {}
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? { v: n } : { err: `${label} must be a number above zero.` }
}

export type DraftErrors = Partial<Record<keyof JournalDraft, string>>

export function validateDraft(d: JournalDraft): { entry?: Omit<TradeJournalEntry, 'id'>; errors: DraftErrors } {
  const errors: DraftErrors = {}
  if (!d.thesis.trim()) errors.thesis = 'Write the thesis in a sentence: why this trade.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.date = 'Pick a date.'
  const e = optNum(d.entry, 'Entry'), s = optNum(d.stop, 'Stop'), t = optNum(d.target, 'Target')
  if (e.err) errors.entry = e.err
  if (s.err) errors.stop = s.err
  if (t.err) errors.target = t.err
  if (e.v && s.v && e.v === s.v) errors.stop = 'Stop must differ from entry.'
  if (e.v && s.v && t.v && !errors.stop) {
    const long = s.v < e.v
    if (long ? t.v <= e.v : t.v >= e.v) errors.target = long ? 'For a long trade the target sits above entry.' : 'For a short trade the target sits below entry.'
  }
  if (Object.keys(errors).length) return { errors }
  const plan = e.v || s.v || t.v ? { entry: e.v, stop: s.v, target: t.v } : undefined
  return {
    errors,
    entry: {
      date: d.date, symbol: d.symbol.trim().toUpperCase(), thesis: d.thesis.trim(),
      setup: d.setup.trim() || undefined, emotion: d.emotion.trim() || undefined, outcome: d.outcome.trim() || undefined, lesson: d.lesson.trim() || undefined,
      tags: parseTags(d.tags), plan, tradeId: d.tradeId, followedPlan: d.followedPlan === '' ? undefined : d.followedPlan === 'yes',
    },
  }
}

/** Reward to risk from a plan, or null when it is incomplete. */
export function rewardRisk(p?: TradeJournalEntry['plan']): number | null {
  if (!p?.entry || !p.stop || !p.target) return null
  const risk = Math.abs(p.entry - p.stop)
  return risk > 0 ? Math.abs(p.target - p.entry) / risk : null
}

export interface JournalFilter { text?: string; symbol?: string; tag?: string }

export function filterJournal(entries: TradeJournalEntry[], f: JournalFilter): TradeJournalEntry[] {
  const q = (f.text ?? '').trim().toLowerCase()
  return entries
    .filter((e) => (!f.symbol || e.symbol === f.symbol) && (!f.tag || (e.tags ?? []).includes(f.tag)))
    .filter((e) => !q || [e.symbol, e.thesis, e.setup, e.outcome, e.lesson, e.emotion, ...(e.tags ?? [])].some((x) => (x ?? '').toLowerCase().includes(q)))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))
}

export const journalSymbols = (es: TradeJournalEntry[]) => [...new Set(es.map((e) => e.symbol).filter(Boolean))].sort()
export const journalTags = (es: TradeJournalEntry[]) => [...new Set(es.flatMap((e) => e.tags ?? []))].sort()

/**
 * Plan-followed streak. Only days where you recorded whether you followed the plan count. Going back from the most recent such
 * day, the streak is how many days in a row had every entry marked as followed. Days with no entry neither add nor break it.
 */
export function planStreak(entries: TradeJournalEntry[]): { streak: number; followedDays: number; reviewedDays: number } {
  const days = new Map<string, boolean>()
  for (const e of entries) {
    if (e.followedPlan === undefined) continue
    days.set(e.date, (days.get(e.date) ?? true) && e.followedPlan)
  }
  const list = [...days.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  let streak = 0
  for (const [, ok] of list) {
    if (!ok) break
    streak++
  }
  return { streak, followedDays: list.filter(([, ok]) => ok).length, reviewedDays: list.length }
}
