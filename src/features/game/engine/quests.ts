// Daily quests: generated deterministically from the snapshot; they complete themselves from the day's gains.
import type { ISODate, Task } from '../../../db'
import { addDays, daysBetween, startOfWeek } from '../../../lib/dates'
import { WORKOUT_RE } from '../../progress/metrics'
import type { Quest } from '../types'
import type { Snapshot } from './snapshot'
import { groupByDay, localDate, type DatedGain } from './util'
import { RULES, TASK_GOAL_BONUS, TASK_PRIORITY_BONUS, type XpKind } from './xpTable'

export const MAX_QUESTS = 5
export const MIN_QUESTS = 3
const WEIGH_LOOKBACK = 14

interface Ctx {
  s: Snapshot
  byDay: Map<ISODate, DatedGain[]>
  weightDates: Set<ISODate>
  mealTotals: Map<ISODate, { cal: number; pro: number }>
  workoutHabitIds: Set<number>
  weightGoal: boolean
  workoutTarget: number | undefined
  careerGoal: boolean
  logsByHabit: Map<number, Set<ISODate>>
}

function buildCtx(s: Snapshot, byDay: Map<ISODate, DatedGain[]>): Ctx {
  const active = s.goals.filter((g) => g.status === 'active')
  const workoutHabits = s.habits.filter((h) => !h.archived && WORKOUT_RE.test(h.name))
  const goalTargets = active.filter((g) => g.metric?.source === 'workouts').map((g) => (g.metric!.window === 'month' ? Math.ceil(g.metric!.target / 4.3) : g.metric!.target))
  const habitTargets = workoutHabits.map((h) => h.perWeek)
  const all = [...goalTargets, ...habitTargets].filter((n) => Number.isFinite(n) && n > 0)
  const mealTotals = new Map<ISODate, { cal: number; pro: number }>()
  for (const m of s.meals) {
    const t = mealTotals.get(m.date) ?? { cal: 0, pro: 0 }
    t.cal += m.calories ?? 0
    t.pro += m.protein ?? 0
    mealTotals.set(m.date, t)
  }
  const logsByHabit = new Map<number, Set<ISODate>>()
  for (const l of s.habitLogs) {
    const set = logsByHabit.get(l.habitId) ?? new Set()
    set.add(l.date)
    logsByHabit.set(l.habitId, set)
  }
  return {
    s, byDay,
    weightDates: new Set(s.weights.map((w) => w.date)),
    mealTotals,
    workoutHabitIds: new Set(workoutHabits.map((h) => h.id!).filter((n) => n != null)),
    weightGoal: active.some((g) => g.metric?.source === 'weight'),
    workoutTarget: all.length ? Math.max(...all) : goalTargets.length || habitTargets.length ? 1 : undefined,
    careerGoal: active.some((g) => g.area === 'career'),
    logsByHabit,
  }
}

const has = (c: Ctx, date: ISODate, kind: XpKind) => (c.byDay.get(date) ?? []).some((g) => g.kind === kind)

function questsFor(c: Ctx, date: ISODate, live: boolean): Quest[] {
  const { s } = c
  const out: Quest[] = []
  const q = (kind: Quest['kind'], skill: Quest['skill'], title: string, xp: number, done: boolean, href: string, extra: Partial<Quest> = {}, id = `${date}:${kind}`) =>
    out.push({ id, kind, skill, title, xp, done, auto: true, href, ...extra })

  // 1. weigh-in
  let recentWeight = false
  for (let i = 0; i <= WEIGH_LOOKBACK && !recentWeight; i++) recentWeight = c.weightDates.has(addDays(date, -i))
  if (c.weightGoal || recentWeight) q('weigh-in', 'body', 'Weigh in', RULES['weigh-in'].xp, has(c, date, 'weigh-in'), '/body', { hint: 'Step on the scale' })

  // 2. protein, else calories
  const tot = c.mealTotals.get(date) ?? { cal: 0, pro: 0 }
  if (s.targets.protein && s.targets.protein > 0) {
    q('protein', 'body', 'Hit your protein', RULES['protein-met'].xp, has(c, date, 'protein-met'), '/food', {
      hint: `${Math.round(tot.pro)} of ${s.targets.protein} g`, progress: { value: Math.round(tot.pro), target: s.targets.protein, unit: 'g' },
    })
  } else if (s.targets.calories && s.targets.calories > 0) {
    q('calories', 'body', 'Hit your calories', RULES['calories-met'].xp, has(c, date, 'calories-met'), '/food', {
      hint: `${Math.round(tot.cal)} of ${s.targets.calories} kcal`, progress: { value: Math.round(tot.cal), target: s.targets.calories, unit: 'kcal' },
    })
  }

  // 3. workout
  if (c.workoutTarget != null) {
    const wk = startOfWeek(date)
    let doneBefore = 0
    for (let d = wk; d < date; d = addDays(d, 1)) if (has(c, d, 'workout')) doneBefore++
    const doneToday = has(c, date, 'workout')
    if (doneToday || doneBefore < c.workoutTarget) {
      q('workout', 'body', 'Train today', RULES.workout.xp, doneToday, '/body', { hint: `${doneBefore + (doneToday ? 1 : 0)} of ${c.workoutTarget} this week` })
    }
  }

  // 4. journal
  q('journal', 'mind', "Write today's entry", RULES.journal.xp, has(c, date, 'journal'), '/journal')

  // 5. win
  if (c.careerGoal) q('win', 'career', 'Log a win', RULES.win.xp, has(c, date, 'win'), '/career')

  // 6. contact (live only: depends on who is overdue right now)
  if (live) {
    let best: { id: number; name: string; over: number } | undefined
    const last = new Map<number, ISODate>()
    for (const i of s.interactions) if (i.date < date && i.date > (last.get(i.personId) ?? '')) last.set(i.personId, i.date)
    for (const p of s.people) {
      if (p.id == null || !(p.cadenceDays > 0)) continue
      const l = [last.get(p.id), p.lastContact && p.lastContact < date ? p.lastContact : undefined].filter(Boolean).sort().pop()
      const over = l ? daysBetween(l, date) - p.cadenceDays : 9999
      if (over >= 0 && (!best || over > best.over)) best = { id: p.id, name: p.name, over }
    }
    if (best) q('contact', 'people', `Reach out to ${best.name}`, RULES.contact.xp, has(c, date, 'contact'), '/people', { hint: best.over >= 9999 ? 'Not contacted yet' : `${best.over}d overdue` })
  }

  // 7. one money action
  if (s.budgets.length) {
    const done = ['categorize', 'import', 'budget-day'].some((k) => has(c, date, k as XpKind))
    q('money', 'money', "Review today's spending", RULES.categorize.xp, done, '/finance', { hint: 'Categorize or import a transaction' })
  }

  // 8. top focus/pinned/high-priority task due today (live only)
  if (live) {
    const cand: Task[] = s.tasks.filter((t) => {
      if (t.status === 'done') return localDate(t.doneAt) === date && (t.focusDate === date || (!!t.due && t.due <= date))
      return t.focusDate === date || (!!t.due && t.due <= date)
    })
    cand.sort((a, b) => Number(b.focusDate === date) - Number(a.focusDate === date) || a.priority - b.priority || (a.due ?? '9').localeCompare(b.due ?? '9') || (a.id ?? 0) - (b.id ?? 0))
    const t = cand[0]
    if (t) {
      const xp = RULES.task.xp + (t.priority === 1 ? TASK_PRIORITY_BONUS : 0) + (t.goalId != null ? TASK_GOAL_BONUS : 0)
      q('task', 'mind', t.title, xp, t.status === 'done', '/tasks', { hint: t.focusDate === date ? 'Focus task' : 'Due today' }, `${date}:task`)
    }
  }

  const top = out.slice(0, MAX_QUESTS)
  // Pad with habits due today when fewer than 3 quests apply.
  if (top.length < MIN_QUESTS) {
    const wk = startOfWeek(date)
    for (const h of [...s.habits].sort((a, b) => (a.id ?? 0) - (b.id ?? 0))) {
      if (top.length >= MIN_QUESTS) break
      if (h.id == null || h.archived || c.workoutHabitIds.has(h.id) || WORKOUT_RE.test(h.name)) continue
      const logs = c.logsByHabit.get(h.id)
      let n = 0
      for (let d = wk; d <= date; d = addDays(d, 1)) if (logs?.has(d)) n++
      const doneToday = !!logs?.has(date)
      if (!doneToday && n >= h.perWeek) continue
      top.push({ id: `${date}:habit:${h.id}`, kind: 'habit', skill: 'mind', title: h.name, xp: RULES.habit.xp, done: doneToday, auto: true, href: '/habits', hint: `${n} of ${h.perWeek} this week` })
    }
  }
  return top
}

/** Up to 5 quests for `today`, completed from `gains` (the output of deriveGains). */
export function generateQuests(snapshot: Snapshot, today: ISODate, gains: DatedGain[]): Quest[] {
  return questsFor(buildCtx(snapshot, groupByDay(gains)), today, true)
}

/** Days (with gains) on which every quest was done. Past days use the stable subset (no contact/task quests). */
export function clearedDays(s: Snapshot, byDay: Map<ISODate, DatedGain[]>, today: ISODate): ISODate[] {
  const c = buildCtx(s, byDay)
  const days: ISODate[] = []
  for (const d of byDay.keys()) {
    const qs = questsFor(c, d, d === today)
    if (qs.length && qs.every((x) => x.done)) days.push(d)
  }
  return days.sort()
}
