// Pure XP derivation: one Snapshot in, dated XpGains out. Deterministic, idempotent, never negative.
// Dates are local YYYY-MM-DD strings; timestamps are converted with localDate (time-zone safe).
import type { ISODate } from '../../../db'
import { addDays } from '../../../lib/dates'
import { WORKOUT_RE } from '../../progress/metrics'
import type { SkillId } from '../types'
import { clearedDays } from './quests'
import type { Snapshot } from './snapshot'
import { computeStreak } from './streaks'
import { groupByDay, localDate, skillForArea, topSkill, type DatedGain } from './util'
import {
  JOURNAL_LONG_BONUS, JOURNAL_LONG_WORDS, LEARNING_MIN_PER_XP, QUALIFYING_DAY_XP, RULES, TARGET_MET_RATIO,
  TASK_GOAL_BONUS, TASK_PRIORITY_BONUS, type XpKind,
} from './xpTable'

interface Raw { kind: XpKind; date: ISODate; id: string; xp: number; at: string; skill: SkillId }

const gainOf = (r: Raw, xp: number): DatedGain => ({
  id: `${r.kind}:${r.id}`, at: r.at, skill: r.skill, xp, kind: r.kind, date: r.date, reason: `${RULES[r.kind].label} (+${xp})`,
})

/** Base gains (no clear bonuses), per-kind daily caps applied. */
export function baseGains(s: Snapshot, today: ISODate): DatedGain[] {
  const raw: Raw[] = []
  const goalById = new Map(s.goals.map((g) => [g.id, g]))
  const add = (kind: XpKind, date: ISODate, id: string | number | undefined, xp: number, skill?: SkillId, at?: string) => {
    if (!date || date > today || !(xp > 0)) return
    const rule = RULES[kind]
    const sk = skill ?? (rule.skill === 'goal' || rule.skill === 'top' ? (rule.fallback ?? 'mind') : rule.skill)
    raw.push({ kind, date, id: String(id ?? at ?? date), xp, at: at ?? `${date}T12:00:00`, skill: sk })
  }
  const goalSkill = (goalId: number | undefined, fb: SkillId) => skillForArea(goalId != null ? goalById.get(goalId)?.area : undefined, fb)

  for (const w of s.weights) add('weigh-in', w.date, w.date, RULES['weigh-in'].xp)

  // Meals: logging, and target days.
  const byMealDay = new Map<ISODate, { cal: number; pro: number }>()
  for (const m of s.meals) {
    add('meal', m.date, m.id, RULES.meal.xp)
    const t = byMealDay.get(m.date) ?? { cal: 0, pro: 0 }
    t.cal += m.calories ?? 0
    t.pro += m.protein ?? 0
    byMealDay.set(m.date, t)
  }
  const { calories: calT, protein: proT } = s.targets
  for (const [d, t] of byMealDay) {
    if (calT && calT > 0 && t.cal >= TARGET_MET_RATIO * calT) add('calories-met', d, d, RULES['calories-met'].xp)
    if (proT && proT > 0 && t.pro >= TARGET_MET_RATIO * proT) add('protein-met', d, d, RULES['protein-met'].xp)
  }

  // Habits; workout/lift habits count as workout days instead of a plain check-in.
  const habitById = new Map(s.habits.map((h) => [h.id, h]))
  const workoutDays = new Set<ISODate>()
  for (const l of s.habitLogs) {
    const h = habitById.get(l.habitId)
    if (!h) continue
    if (WORKOUT_RE.test(h.name)) workoutDays.add(l.date)
    else add('habit', l.date, `${l.habitId}:${l.date}`, RULES.habit.xp, goalSkill(h.goalId, 'mind'))
  }
  for (const e of s.events) if (e.kind === 'workout.logged') workoutDays.add(localDate(e.at))
  for (const d of workoutDays) add('workout', d, d, RULES.workout.xp)

  for (const j of s.journal) {
    const words = (j.text ?? '').trim().split(/\s+/).filter(Boolean).length
    add('journal', j.date, j.id, RULES.journal.xp + (words >= JOURNAL_LONG_WORDS ? JOURNAL_LONG_BONUS : 0))
  }
  const studyByDay = new Map<ISODate, number>()
  for (const st of s.studySessions) studyByDay.set(st.date, (studyByDay.get(st.date) ?? 0) + Math.max(0, st.minutes || 0))
  for (const [d, min] of studyByDay) add('learning', d, d, Math.floor(min / LEARNING_MIN_PER_XP))

  for (const e of s.events) {
    const d = localDate(e.at)
    if (e.kind === 'win' || e.kind === 'career.win') add('win', d, e.id, RULES.win.xp, undefined, e.at)
    else if (e.kind.startsWith('focus.')) add('focus', d, e.id, RULES.focus.xp, undefined, e.at)
    else if (e.kind === 'tx.categorize') add('categorize', d, e.id, RULES.categorize.xp, undefined, e.at)
    else if (e.kind === 'finance.import') add('import', d, e.id, RULES.import.xp, undefined, e.at)
    else if (e.kind === 'goal.milestone') add('milestone', d, e.id, RULES.milestone.xp, goalSkill(e.refId, 'career'), e.at)
  }
  for (const g of s.goals) if (g.status === 'done' && g.completedAt) add('goal-done', localDate(g.completedAt), g.id, RULES['goal-done'].xp, goalSkill(g.id, 'career'), g.completedAt)

  for (const t of s.tasks) {
    if (t.status !== 'done' || !t.doneAt) continue
    const xp = RULES.task.xp + (t.priority === 1 ? TASK_PRIORITY_BONUS : 0) + (t.goalId != null ? TASK_GOAL_BONUS : 0)
    add('task', localDate(t.doneAt), t.id, xp, goalSkill(t.goalId, 'mind'), t.doneAt)
  }
  for (const r of s.reviews) {
    const locked = (r as { lockedAt?: string }).lockedAt
    if (locked) add('review', localDate(locked), r.id, RULES.review.xp, undefined, locked)
  }
  const seenContact = new Set<string>()
  for (const i of s.interactions) {
    const k = `${i.personId}:${i.date}`
    if (seenContact.has(k)) continue
    seenContact.add(k)
    add('contact', i.date, k, RULES.contact.xp)
  }
  const nwDays = new Set<ISODate>()
  for (const b of s.balances) nwDays.add(b.date)
  for (const d of nwDays) add('net-worth', d, d, RULES['net-worth'].xp)

  for (const d of onBudgetDays(s, today)) add('budget-day', d, d, RULES['budget-day'].xp)

  // Per-day, per-kind caps. Sorting makes clipping deterministic.
  raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const used = new Map<string, number>()
  const out: DatedGain[] = []
  for (const r of raw) {
    const key = `${r.date}|${r.kind}`
    const left = RULES[r.kind].cap - (used.get(key) ?? 0)
    const xp = Math.min(r.xp, left)
    if (xp <= 0) continue
    used.set(key, (used.get(key) ?? 0) + xp)
    out.push(gainOf(r, xp))
  }
  return sortGains(out)
}

/** Past days with spending logged where no budgeted category is over its monthly limit so far. */
function onBudgetDays(s: Snapshot, today: ISODate): ISODate[] {
  if (!s.budgets.length) return []
  const limit = new Map(s.budgets.map((b) => [b.category, b.monthlyLimit]))
  const tx = s.transactions.filter((t) => t.date < today && t.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const days: ISODate[] = []
  let month = ''
  let spent = new Map<string, number>()
  for (let i = 0; i < tx.length; ) {
    const date = tx[i].date
    if (date.slice(0, 7) !== month) { month = date.slice(0, 7); spent = new Map() }
    let any = false
    while (i < tx.length && tx[i].date === date) {
      const t = tx[i++]
      any = true
      if (t.amount < 0 && limit.has(t.category)) spent.set(t.category, (spent.get(t.category) ?? 0) - t.amount)
    }
    if (any && [...spent].every(([c, v]) => v <= (limit.get(c) ?? 0))) days.push(date)
  }
  return days
}

export function sortGains<T extends { at: string; id: string }>(g: T[]): T[] {
  return g.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export interface Derived {
  gains: DatedGain[]
  streak: ReturnType<typeof computeStreak>
}

/** Base gains plus day-clear and week-clear bonuses, and the weekly streak. */
export function deriveFull(s: Snapshot, today: ISODate): Derived {
  const base = baseGains(s, today)
  const byDay = groupByDay(base)
  const bonuses: DatedGain[] = []
  for (const d of clearedDays(s, byDay, today)) {
    const r = RULES['day-clear']
    bonuses.push({ id: `day-clear:${d}`, at: `${d}T23:59:00`, skill: topSkill(byDay.get(d) ?? []), xp: r.xp, kind: 'day-clear', date: d, reason: `${r.label} (+${r.xp})` })
  }
  const active = new Set<ISODate>()
  for (const [d, gs] of byDay) if (gs.reduce((a, g) => a + g.xp, 0) >= QUALIFYING_DAY_XP) active.add(d)
  const streak = computeStreak(active, today, s.weekTarget)
  for (const w of streak.metWeeks) {
    const r = RULES['week-clear']
    const days: DatedGain[] = []
    for (let i = 0; i < 7; i++) days.push(...(byDay.get(addDays(w.weekOf, i)) ?? []))
    bonuses.push({ id: `week-clear:${w.weekOf}`, at: `${w.date}T23:59:30`, skill: topSkill(days), xp: r.xp, kind: 'week-clear', date: w.date, reason: `${r.label} (+${r.xp})` })
  }
  return { gains: sortGains([...base, ...bonuses]), streak }
}

export function deriveGains(snapshot: Snapshot, today: ISODate): DatedGain[] {
  return deriveFull(snapshot, today).gains
}
