// Habit mutations. One check-in per habit per day (unique [habitId+date] index).
import { db, logEvent, type Habit, type ISODate } from '../../db'
import { today } from '../../lib/dates'
import { milestoneFor, streak, STREAK_MILESTONES } from './stats'

/** A streak milestone that a check-in just reached (logged on the timeline). */
export interface StreakHit { count: number; unit: 'day' | 'week'; key: string; next: number | null }
export interface CheckInResult { checked: boolean; milestone: StreakHit | null }

/** Toggle a check-in and report a streak milestone it reached. Safe against double-taps and the unique index. */
export async function checkIn(habit: Habit, date: ISODate): Promise<CheckInResult> {
  if (habit.id == null) return { checked: false, milestone: null }
  const id = habit.id
  const existing = await db.habitLogs.where('[habitId+date]').equals([id, date]).first()
  if (existing?.id != null) {
    await db.habitLogs.delete(existing.id)
    return { checked: false, milestone: null }
  }
  try {
    await db.habitLogs.add({ habitId: id, date })
  } catch (e) {
    if ((e as { name?: string })?.name === 'ConstraintError') return { checked: true, milestone: null } // another tap got there first
    throw e
  }
  return { checked: true, milestone: await logStreakMilestone(habit) }
}

/** Toggle a check-in. Returns true when the day is now checked. */
export async function toggleCheckIn(habit: Habit, date: ISODate): Promise<boolean> {
  return (await checkIn(habit, date)).checked
}

/** Undo a check-in made by `checkIn`, including the streak milestone it logged (so History stays honest). */
export async function undoCheckIn(habit: Habit, date: ISODate, milestone: StreakHit | null) {
  if (habit.id == null) return
  const id = habit.id
  await db.transaction('rw', db.habitLogs, db.events, async () => {
    const log = await db.habitLogs.where('[habitId+date]').equals([id, date]).first()
    if (log?.id != null) await db.habitLogs.delete(log.id)
    if (milestone) {
      const evs = await db.events.filter((e) => e.refTable === 'habits' && e.refId === id && e.refKey === milestone.key).toArray()
      await db.events.bulkDelete(evs.map((e) => e.id!).filter((x) => x != null))
    }
  })
}

async function logStreakMilestone(habit: Habit): Promise<StreakHit | null> {
  if (habit.id == null) return null
  const logs = await db.habitLogs.where('habitId').equals(habit.id).toArray()
  const s = streak(new Set(logs.map((l) => l.date)), today(), habit.perWeek)
  const m = milestoneFor(s)
  if (m == null) return null
  const key = `streak:${s.unit}:${m}`
  const dup = await db.events.filter((e) => e.refTable === 'habits' && e.refId === habit.id && e.refKey === key).first()
  if (dup) return null
  await logEvent({ area: habit.area, kind: 'habit.streak', title: `${habit.name}: ${m}-${s.unit} streak`, refTable: 'habits', refId: habit.id, refKey: key, milestone: true })
  const ladder = STREAK_MILESTONES[s.unit]
  return { count: m, unit: s.unit, key, next: ladder.find((x) => x > m) ?? null }
}

/** Streak milestones (7/30/100 days, or 4/12/26 weeks) are logged once per habit, never repeated. */
export async function maybeLogMilestone(habit: Habit): Promise<number | null> {
  return (await logStreakMilestone(habit))?.count ?? null
}

export async function archiveHabit(h: Habit, archived: boolean) {
  if (h.id != null) await db.habits.update(h.id, { archived })
}

export async function deleteHabit(h: Habit) {
  if (h.id == null) return
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(h.id!).delete()
    await db.habits.delete(h.id!)
  })
}
