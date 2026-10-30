// Learning module data helpers. Status transitions go through here so the timeline stays accurate.
import { db, logEvent, type ISODate, type LearningItem } from '../../db'
import { addDays, today } from '../../lib/dates'

export const KINDS: { value: LearningItem['kind']; label: string }[] = [
  { value: 'course', label: 'Course' },
  { value: 'certification', label: 'Certification' },
  { value: 'book', label: 'Book' },
  { value: 'skill', label: 'Skill' },
]
export const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label])) as Record<LearningItem['kind'], string>

export const STATUSES: { value: LearningItem['status']; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Completed' },
]

async function logStarted(item: LearningItem) {
  await logEvent({ area: 'learning', kind: 'learning-started', title: `Started ${item.title}`, refTable: 'learning', refId: item.id })
}

async function logCompleted(item: LearningItem) {
  await logEvent({
    area: 'learning',
    kind: 'learning-completed',
    title: item.kind === 'certification' ? `Earned ${item.title}` : `Completed ${item.title}`,
    refTable: 'learning',
    refId: item.id,
    milestone: true,
  })
}

export async function startItem(item: LearningItem) {
  if (item.id == null) return
  const patch = { status: 'active' as const, startedAt: item.startedAt ?? today() }
  await db.learning.update(item.id, patch)
  await logStarted({ ...item, ...patch })
}

export async function completeItem(item: LearningItem) {
  if (item.id == null) return
  const patch = { status: 'done' as const, progress: 100, completedAt: today(), startedAt: item.startedAt ?? today() }
  await db.learning.update(item.id, patch)
  await logCompleted({ ...item, ...patch })
}

export type ItemDraft = Omit<LearningItem, 'id' | 'createdAt' | 'startedAt' | 'completedAt'>

/** Create or update an item, applying start/complete side-effects when status changes. */
export async function saveItem(draft: ItemDraft, prev?: LearningItem) {
  const clean: ItemDraft = {
    ...draft,
    title: draft.title.trim(),
    provider: draft.provider?.trim() || undefined,
    url: draft.url?.trim() || undefined,
    progress: Math.max(0, Math.min(100, Math.round(draft.progress))),
  }
  const prevStatus = prev?.status ?? 'planned'
  const t = today()
  const extra: Partial<LearningItem> = {}
  if (clean.status !== 'planned' && !prev?.startedAt) extra.startedAt = t
  if (clean.status === 'done') {
    clean.progress = 100
    if (prevStatus !== 'done') extra.completedAt = t
  } else if (prev?.completedAt) {
    extra.completedAt = undefined
  }

  let item: LearningItem
  if (prev?.id != null) {
    await db.learning.update(prev.id, { ...clean, ...extra })
    item = { ...prev, ...clean, ...extra }
  } else {
    const id = await db.learning.add({ ...clean, ...extra, createdAt: new Date().toISOString() })
    item = { ...clean, ...extra, id, createdAt: '' }
  }

  if (clean.status !== prevStatus || !prev) {
    if (clean.status === 'active' && prevStatus === 'planned') await logStarted(item)
    if (clean.status === 'done') await logCompleted(item)
  }
  return item
}

export async function addSession(itemId: number, minutes: number, date: ISODate = today(), note?: string) {
  if (!(minutes > 0)) return
  await db.studySessions.add({ itemId, minutes: Math.round(minutes), date, note: note?.trim() || undefined })
}

/** Remove the most recent session for this item with this length (used by toast undo). */
export async function undoLast(itemId: number, minutes: number, date: ISODate = today()) {
  const rows = await db.studySessions.where('itemId').equals(itemId).filter((s) => s.minutes === minutes && s.date === date).toArray()
  const last = rows.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))[0]
  if (last?.id != null) await db.studySessions.delete(last.id)
}

/** Consecutive days with a session, ending today (or yesterday if nothing logged yet today). */
export function sessionStreak(dates: Set<ISODate>, from: ISODate = today()): number {
  let d = dates.has(from) ? from : addDays(from, -1)
  let n = 0
  while (dates.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}
