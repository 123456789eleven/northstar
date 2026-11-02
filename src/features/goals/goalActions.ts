import { db, logEvent, type Goal } from '../../db'
import { newId } from './progress'

export async function completeGoal(g: Goal) {
  if (g.id == null) return
  await db.transaction('rw', db.goals, db.events, async () => {
    await db.goals.update(g.id!, { status: 'done', completedAt: new Date().toISOString() })
    await logEvent({ area: g.area, kind: 'goal.done', title: g.title, refTable: 'goals', refId: g.id, milestone: true })
  })
}

export async function reopenGoal(g: Goal) {
  if (g.id == null) return
  await db.transaction('rw', db.goals, db.events, async () => {
    await db.goals.update(g.id!, { status: 'active', completedAt: undefined })
    const evs = await db.events.filter((e) => e.refTable === 'goals' && e.refId === g.id && e.kind === 'goal.done').toArray()
    const last = evs.sort((a, b) => b.at.localeCompare(a.at))[0]
    if (last?.id != null) await db.events.delete(last.id)
  })
}

export async function setPaused(g: Goal, paused: boolean) {
  if (g.id == null) return
  await db.goals.update(g.id, { status: paused ? 'paused' : 'active' })
}

export async function toggleMilestone(g: Goal, msId: string) {
  if (g.id == null) return
  const ms = g.milestones.find((m) => m.id === msId)
  if (!ms) return
  const milestones = g.milestones.map((m) => (m.id === msId ? { ...m, done: !m.done } : m))
  await db.transaction('rw', db.goals, db.events, async () => {
    await db.goals.update(g.id!, { milestones })
    if (!ms.done) await logEvent({ area: g.area, kind: 'goal.milestone', title: `${ms.title} (${g.title})`, refTable: 'goals', refId: g.id })
  })
}

/** Undo of a just-checked milestone: unchecks it and removes the timeline event that check logged. */
export async function undoMilestone(goalId: number, msId: string) {
  await db.transaction('rw', db.goals, db.events, async () => {
    const g = await db.goals.get(goalId)
    const ms = g?.milestones.find((m) => m.id === msId)
    if (!g || !ms || !ms.done) return
    await db.goals.update(goalId, { milestones: g.milestones.map((m) => (m.id === msId ? { ...m, done: false } : m)) })
    const title = `${ms.title} (${g.title})`
    const evs = await db.events.filter((e) => e.refTable === 'goals' && e.refId === goalId && e.kind === 'goal.milestone' && e.title === title).toArray()
    const last = evs.sort((a, b) => b.at.localeCompare(a.at))[0]
    if (last?.id != null) await db.events.delete(last.id)
  })
}

export async function addMilestone(g: Goal, title: string) {
  if (g.id == null || !title.trim()) return
  await db.goals.update(g.id, { milestones: [...g.milestones, { id: newId(), title: title.trim(), done: false }] })
}

export async function removeMilestone(g: Goal, msId: string) {
  if (g.id == null) return
  await db.goals.update(g.id, { milestones: g.milestones.filter((m) => m.id !== msId) })
}

export function createGoal(g: Omit<Goal, 'id' | 'milestones' | 'createdAt'>) {
  return db.goals.add({ ...g, milestones: [], createdAt: new Date().toISOString() })
}
