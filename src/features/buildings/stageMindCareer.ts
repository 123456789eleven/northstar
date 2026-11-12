// Stage inputs for the Library (Mind) and the Office (Career), read from the same tables the floors use.
import { db, getSetting } from '../../db'
import { addDays, startOfWeek, today } from '../../lib/dates'
import { goalProgress } from '../goals/progress'
import { WIN_KIND, winFromEvent } from '../career/careerData'
import { computeCaseStrength } from '../career/caseStrength'
import { parseOneOnOnes } from '../career/oneOnOne'
import { PROJECTS_KEY, parseProjects } from '../career/projects'
import { DEFAULT_GOAL } from '../journal/insights'
import { wordCount } from '../journal/stats'
import type { LibrarySnapshot, OfficeSnapshot } from './stage'

export async function librarySnapshot(): Promise<LibrarySnapshot> {
  const t = today()
  const wk = startOfWeek(t)
  const [entries, active, sessions, goal, target] = await Promise.all([
    db.journal.where('date').between(wk, addDays(wk, 6), true, true).toArray(),
    db.learning.where('status').equals('active').count(),
    db.studySessions.where('date').aboveOrEqual(wk).toArray(),
    getSetting<number>('journal.goal', DEFAULT_GOAL),
    getSetting<number>('learning.weeklyTargetMin', 120),
  ])
  const written = entries.filter((e) => e.text.trim())
  const g = Number(goal) > 0 ? Number(goal) : DEFAULT_GOAL
  return {
    wroteToday: written.some((e) => e.date === t),
    daysThisWeek: new Set(written.map((e) => e.date)).size,
    goalHitThisWeek: written.some((e) => wordCount(e.text) >= g),
    activeItems: active,
    studyMinutesThisWeek: sessions.reduce((n, s) => n + (s.minutes || 0), 0),
    studyTarget: Number(target) > 0 ? Number(target) : 120,
  }
}

export async function officeSnapshot(): Promise<OfficeSnapshot> {
  const t = today()
  const wk = startOfWeek(t)
  const [rows, projRow, notes, goals, tasks] = await Promise.all([
    db.events.filter((e) => e.kind === WIN_KIND || (e.kind === 'win' && e.area === 'career')).toArray(),
    db.settings.get(PROJECTS_KEY),
    db.journal.filter((j) => (j.tags ?? []).includes('1on1')).toArray(),
    db.goals.filter((g) => g.area === 'career').toArray(),
    db.tasks.toArray(),
  ])
  const wins = rows.map(winFromEvent).filter((w): w is NonNullable<typeof w> => !!w)
  const projects = parseProjects(projRow?.value)
  const proj = projects.find((p) => p.featured) ?? projects[0]
  const score = computeCaseStrength({
    today: t, wins, projects,
    notes: notes.flatMap((j) => parseOneOnOnes(j.date, j.text)).map((n) => ({ date: n.date, feedback: n.feedback })),
    goals: goals.map((g) => ({ pct: goalProgress(g, tasks).pct })),
  }).score
  return {
    winsThisWeek: wins.filter((w) => w.date >= wk && w.date <= addDays(wk, 6)).length,
    winsThisMonth: wins.filter((w) => w.date.startsWith(t.slice(0, 7))).length,
    projectBaseline: !!proj?.baseline,
    projectResult: !!proj?.result,
    caseScore: score,
  }
}
