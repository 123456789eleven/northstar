// Promotion case strength (pure, no hidden weights). Five segments of 20 points each; the total is their sum (0-100).
// Every rule is listed in CASE_RULES, which the "How this is scored" disclosure renders verbatim.
import { addDays } from '../../lib/dates'
import type { Win } from './leadership'
import { improvementPct, type Project } from './projects'

export const WINDOW_DAYS = 90
export const SEGMENT_MAX = 20

export type SegmentKey = 'wins' | 'project' | 'leadership' | 'feedback' | 'goals'
export type NextAction = 'win' | 'project' | 'oneonone' | 'goals'

export interface CaseStrengthInput {
  today: string
  wins: Pick<Win, 'date' | 'tags'>[]
  projects: Pick<Project, 'baseline' | 'result' | 'better' | 'featured'>[]
  /** 1:1 notes with their feedback lines. */
  notes: { date: string; feedback: string[] }[]
  /** Progress 0-100 of each career goal. */
  goals: { pct: number }[]
}

export interface Segment { key: SegmentKey; label: string; points: number; max: number; detail: string; action: NextAction; actionLabel: string }
export interface CaseStrength { score: number; segments: Segment[]; next: Segment | null }

export const CASE_RULES: Record<SegmentKey, { label: string; rule: string }> = {
  wins: { label: 'Wins', rule: 'Up to 20 points: 12 for how many different tags your last-90-day wins cover (4 or more tags is full), 8 for how many wins you logged (6 or more is full).' },
  project: { label: 'Project', rule: 'Up to 20 points on your featured project: 8 for a baseline, 8 for a result, 4 when the result is a measurable improvement.' },
  leadership: { label: 'Leadership', rule: 'Up to 20 points from the last 90 days: 10 for mentoring wins (3 or more is full), 10 for escalation wins (2 or more is full).' },
  feedback: { label: 'Feedback', rule: 'Up to 20 points: 1:1 notes from the last 90 days that contain feedback (3 notes is full).' },
  goals: { label: 'Goals', rule: 'Up to 20 points: the average progress of your career-area goals. No career goals scores 0.' },
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))
const pts = (frac: number) => Math.round(clamp01(frac) * SEGMENT_MAX * 10) / 10

export function computeCaseStrength(i: CaseStrengthInput): CaseStrength {
  const from = addDays(i.today, -(WINDOW_DAYS - 1))
  const inWin = (d: string) => d >= from && d <= i.today
  const wins = i.wins.filter((w) => inWin(w.date))
  const tags = new Set(wins.flatMap((w) => w.tags as string[]))
  const count = (t: string) => wins.filter((w) => (w.tags as string[]).includes(t)).length

  const winsFrac = 0.6 * clamp01(tags.size / 4) + 0.4 * clamp01(wins.length / 6)
  const proj = i.projects.find((p) => p.featured) ?? i.projects[0]
  const pct = proj ? improvementPct(proj) : null
  const projPts = proj ? (proj.baseline ? 8 : 0) + (proj.result ? 8 : 0) + (pct != null && pct > 0 ? 4 : 0) : 0
  const mentor = count('mentoring'), esc = count('escalation')
  const leadFrac = 0.5 * clamp01(mentor / 3) + 0.5 * clamp01(esc / 2)
  const fbNotes = i.notes.filter((n) => inWin(n.date) && n.feedback.some((f) => f.trim())).length
  const goalAvg = i.goals.length ? i.goals.reduce((n, g) => n + clamp01(g.pct / 100), 0) / i.goals.length : 0

  const seg = (key: SegmentKey, points: number, detail: string, action: NextAction, actionLabel: string): Segment =>
    ({ key, label: CASE_RULES[key].label, points, max: SEGMENT_MAX, detail, action, actionLabel })
  const segments: Segment[] = [
    seg('wins', pts(winsFrac), `${wins.length} ${wins.length === 1 ? 'win' : 'wins'}, ${tags.size} ${tags.size === 1 ? 'tag' : 'tags'}`, 'win', 'Log a win'),
    seg('project', projPts, proj ? `${proj.baseline ? 'baseline' : 'no baseline'}, ${proj.result ? 'result' : 'no result'}` : 'no project', 'project', 'Open project'),
    seg('leadership', pts(leadFrac), `${mentor} mentoring, ${esc} escalation`, 'win', 'Log a win'),
    seg('feedback', pts(fbNotes / 3), `${fbNotes} ${fbNotes === 1 ? 'note' : 'notes'} with feedback`, 'oneonone', 'Add a 1:1'),
    seg('goals', pts(goalAvg), i.goals.length ? `${Math.round(goalAvg * 100)}% average` : 'no career goals', 'goals', 'Open goals'),
  ]
  const score = Math.round(segments.reduce((n, s) => n + s.points, 0))
  return { score: Math.max(0, Math.min(100, score)), segments, next: nextToStrengthen(segments) }
}

/** The segment with the lowest fill (points / max); ties go to the earlier segment. Null when every segment is full. */
export function nextToStrengthen(segments: Segment[]): Segment | null {
  let best: Segment | null = null
  for (const s of segments) if (s.points < s.max && (!best || s.points / s.max < best.points / best.max)) best = s
  return best
}
