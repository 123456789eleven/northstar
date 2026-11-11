// The highlights reel: real events turned into short, finite cards. Pure: raw snapshot in, at most 12 cards out.
import { daysBetween, formatDate, money } from '../../lib/dates'
import { computeRecords, runInfo, type ScoreRecord, type ScoreSnapshot } from './model'

export const MAX_HIGHLIGHTS = 12

export interface HighlightVisual { type: 'bars' | 'line' | 'dots'; values: number[] }

export interface Highlight {
  id: string
  kind: 'record' | 'reconnected' | 'milestone' | 'weight' | 'run'
  headline: string
  detail: string
  /** YYYY-MM-DD. */
  date: string
  dateLabel: string
  /** 1 to 3; higher sorts first on the same day. */
  weight: 1 | 2 | 3
  visual: HighlightVisual
}

const day = (s: string) => s.slice(0, 10)
const FULL: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)
const RECORD_WINDOW = 120
const EVENT_WINDOW = 60

const RECORD_COPY: Record<string, (r: ScoreRecord) => { headline: string; detail: string; visual: HighlightVisual['type'] }> = {
  'saving-month': (r) => ({ headline: `Best saving month yet: ${r.display}.`, detail: 'More came in than went out than in any month on record.', visual: 'bars' }),
  'under-budget': (r) => ({ headline: `${r.display} under budget in a row.`, detail: 'Your longest run of months inside every limit.', visual: 'bars' }),
  'net-worth': (r) => ({ headline: `Net worth hit a new high: ${r.display}.`, detail: 'Higher than every earlier snapshot.', visual: 'line' }),
  'tasks-week': (r) => ({ headline: `Record week: ${r.display} done.`, detail: 'Most you have finished in a single week.', visual: 'bars' }),
  'consistency-run': (r) => ({ headline: `${r.display} in a row. Your longest run yet.`, detail: 'Something logged every day, across all areas.', visual: 'dots' }),
  weight: (r) => ({ headline: `${r.display}. New best on the scale.`, detail: 'Your furthest point so far.', visual: 'line' }),
  'people-month': (r) => ({ headline: `${r.display} reached in one month. A new best.`, detail: 'Most people you have been in touch with in a month.', visual: 'bars' }),
  'journal-run': (r) => ({ headline: `${r.display} of journaling in a row. Longest yet.`, detail: 'Your longest journal run.', visual: 'dots' }),
  'study-week': (r) => ({ headline: `${r.display} of study in one week. A new best.`, detail: 'Most study minutes in a single week.', visual: 'bars' }),
}

export function deriveHighlights(s: ScoreSnapshot): Highlight[] {
  const out: Highlight[] = []
  const age = (d: string) => daysBetween(d, s.today)
  const add = (h: Omit<Highlight, 'dateLabel'>) => out.push({ ...h, dateLabel: formatDate(h.date, FULL) })

  // Records set recently.
  for (const r of computeRecords(s)) {
    const copy = RECORD_COPY[r.id]
    if (!copy || age(r.date) > RECORD_WINDOW || age(r.date) < 0 || r.series.length < 1) continue
    // A week or month that has not finished yet is not a highlight; point-in-time and run records are.
    if (r.date === s.today && ['saving-month', 'tasks-week', 'people-month', 'study-week'].includes(r.id)) continue
    const c = copy(r)
    add({ id: `rec-${r.id}`, kind: r.id.endsWith('run') ? 'run' : 'record', headline: c.headline, detail: c.detail, date: r.date, weight: r.id === 'net-worth' ? 3 : 2, visual: { type: c.visual, values: r.series } })
  }

  // Reconnected after a long gap.
  const names = new Map(s.people.map((p) => [p.id, p.name]))
  const byPerson = new Map<number, string[]>()
  s.interactions.forEach((i) => { const l = byPerson.get(i.personId) ?? []; l.push(day(i.date)); byPerson.set(i.personId, l) })
  for (const [pid, ds] of byPerson) {
    const sorted = [...new Set(ds)].sort()
    for (let i = 1; i < sorted.length; i++) {
      const gap = daysBetween(sorted[i - 1], sorted[i])
      const name = names.get(pid)
      if (gap >= 60 && name && age(sorted[i]) <= EVENT_WINDOW && age(sorted[i]) >= 0) {
        add({ id: `reconnect-${pid}-${sorted[i]}`, kind: 'reconnected', headline: `Back in touch with ${name} after ${gap} days.`, detail: `The last time was ${formatDate(sorted[i - 1], FULL)}.`, date: sorted[i], weight: 3, visual: { type: 'bars', values: [gap] } })
      }
    }
  }

  // Milestones off the timeline.
  const hasNw = out.some((h) => h.id === 'rec-net-worth')
  s.events.filter((e) => e.milestone && !(hasNw && /net worth/i.test(e.title)) && age(day(e.at)) <= EVENT_WINDOW && age(day(e.at)) >= 0).forEach((e, i) => {
    add({ id: `ms-${day(e.at)}-${i}`, kind: 'milestone', headline: e.title.endsWith('.') ? e.title : `${e.title}.`, detail: 'Milestone reached.', date: day(e.at), weight: 3, visual: { type: 'dots', values: [1] } })
  })

  // A run that is still going and has reached a week.
  const act = [...s.tasksDone, ...s.habitLogs, ...s.journalDates, ...s.study.map((x) => x.date), ...s.weights.map((w) => w.date), ...s.events.map((e) => e.at)]
  const ri = runInfo(act, s.today)
  if (ri.current >= 7 && ri.current < ri.best && !out.some((h) => h.id === 'rec-consistency-run')) {
    add({ id: 'run-live', kind: 'run', headline: `${ri.current} days in a row, still going.`, detail: `Your longest is ${ri.best}.`, date: s.today, weight: 1, visual: { type: 'dots', values: [ri.current] } })
  }

  // Weight: latest weigh-in is closest to target yet.
  if (s.weightTarget !== undefined && s.weights.length >= 3) {
    const ws = [...s.weights].sort((a, b) => a.date.localeCompare(b.date))
    const dist = (w: number) => Math.abs(w - s.weightTarget!)
    const latest = ws[ws.length - 1]
    if (ws.slice(0, -1).every((w) => dist(w.weight) > dist(latest.weight)) && age(latest.date) <= EVENT_WINDOW) {
      const left = Math.round(dist(latest.weight) * 10) / 10
      add({ id: `weight-${latest.date}`, kind: 'weight', headline: `${Math.round(latest.weight * 10) / 10} lb. Closest to your target yet.`, detail: left === 0 ? 'You are on target.' : `${left} lb to go.`, date: latest.date, weight: 2, visual: { type: 'line', values: ws.slice(-8).map((w) => w.weight) } })
    }
  }

  // Total saved this year as a plain closer, only when positive and no other saving card exists.
  if (!out.length) {
    const year = s.today.slice(0, 4)
    const saved = s.transactions.filter((t) => t.date.startsWith(year)).reduce((a, t) => a + t.amount, 0)
    if (saved > 0) add({ id: 'year-saved', kind: 'record', headline: `${money(saved)} net so far in ${year}.`, detail: 'More came in than went out.', date: s.today, weight: 1, visual: { type: 'bars', values: [saved] } })
  }

  const seen = new Set<string>()
  return out
    .filter((h) => (seen.has(h.id) ? false : (seen.add(h.id), true)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.weight - a.weight)
    .slice(0, MAX_HIGHLIGHTS)
}

export const highlightCount = (n: number) => `${n} ${plural(n, 'highlight')}`
