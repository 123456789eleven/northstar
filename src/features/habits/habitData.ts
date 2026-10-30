// Habit mutations. One check-in per habit per day (unique [habitId+date] index).
import { db, logEvent, type Habit, type ISODate } from '../../db'
import { today } from '../../lib/dates'
import { milestoneFor, streak } from './stats'

/** Toggle a check-in. Returns true when the day is now checked. Safe against double-taps and the unique index. */
export async function toggleCheckIn(habit: Habit, date: ISODate): Promise<boolean> {
  if (habit.id == null) return false
  const id = habit.id
  const existing = await db.habitLogs.where('[habitId+date]').equals([id, date]).first()
  if (existing?.id != null) {
    await db.habitLogs.delete(existing.id)
    return false
  }
  try {
    await db.habitLogs.add({ habitId: id, date })
  } catch (e) {
    if ((e as { name?: string })?.name === 'ConstraintError') return true // another tap got there first
    throw e
  }
  await maybeLogMilestone(habit)
  return true
}

/** Streak milestones (7/30/100 days, or 4/12/26 weeks) are logged once per habit, never repeated. */
export async function maybeLogMilestone(habit: Habit): Promise<number | null> {
  if (habit.id == null) return null
  const logs = await db.habitLogs.where('habitId').equals(habit.id).toArray()
  const s = streak(new Set(logs.map((l) => l.date)), today(), habit.perWeek)
  const m = milestoneFor(s)
  if (m == null) return null
  const key = `streak:${s.unit}:${m}`
  const dup = await db.events.filter((e) => e.refTable === 'habits' && e.refId === habit.id && e.refKey === key).first()
  if (dup) return null
  await logEvent({ area: habit.area, kind: 'habit.streak', title: `${habit.name}: ${m}-${s.unit} streak`, refTable: 'habits', refId: habit.id, refKey: key, milestone: true })
  return m
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
