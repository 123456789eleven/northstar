// Time-block mutations (create / move / resize / edit / delete) with an Undo toast for each. Blocks are local calendar rows
// tagged by uid (see timeBlock.ts); Google rows are never touched.
import { db, type CalendarEvent, type ISODate, type Task } from '../../db'
import { useToast } from '../../components/toastContext'
import { isGoogleEvent } from '../gcal/help'
import { fmtTime, toMin } from './layout'
import { blockMeta, blockUid, makeSpan, moveSpan, resizeSpan, type BlockKind, type Span } from './timeBlock'

export interface NewBlock { kind: BlockKind; task?: Task; title?: string; span: Span }

export function useBlocks() {
  const toast = useToast()

  const create = async (b: NewBlock) => {
    const title = b.kind === 'task' ? b.task?.title ?? 'Task block' : b.title?.trim() || 'Training'
    const id = (await db.calendar.add({
      title, date: b.span.date, allDay: false, start: b.span.start, end: b.span.end, uid: blockUid(b.kind, b.task?.id),
    })) as number
    toast({ message: `Blocked ${fmtTime(toMin(b.span.start))} for "${title}"`, undo: () => db.calendar.delete(id) })
    return id
  }

  const patch = async (e: CalendarEvent, changes: Partial<CalendarEvent>, message: string) => {
    if (e.id == null || isGoogleEvent(e) || !blockMeta(e)) return
    const prev = { ...e }
    await db.calendar.update(e.id, changes)
    toast({ message, undo: () => db.calendar.put(prev).then(() => undefined) })
  }

  const move = (e: CalendarEvent, date: ISODate, startMin: number) => {
    if (!e.start) return
    const s = moveSpan({ date: e.date, start: e.start, end: e.end ?? e.start }, date, startMin)
    return patch(e, { date: s.date, start: s.start, end: s.end }, `Moved "${e.title}" to ${fmtTime(toMin(s.start))}`)
  }

  const resize = (e: CalendarEvent, endMin: number) => {
    if (!e.start) return
    const s = resizeSpan({ date: e.date, start: e.start, end: e.end ?? e.start }, endMin)
    return patch(e, { end: s.end }, `Resized "${e.title}"`)
  }

  const edit = (e: CalendarEvent, changes: { title?: string; span: Span }) =>
    patch(e, { ...(changes.title ? { title: changes.title } : {}), date: changes.span.date, start: changes.span.start, end: changes.span.end }, `Updated "${changes.title ?? e.title}"`)

  const remove = async (e: CalendarEvent) => {
    if (e.id == null || isGoogleEvent(e) || !blockMeta(e)) return
    const prev = { ...e }
    await db.calendar.delete(e.id)
    toast({ message: `Removed "${e.title}"`, undo: () => db.calendar.put(prev).then(() => undefined) })
  }

  const drop = (task: Task, date: ISODate, startMin: number) => create({ kind: 'task', task, span: makeSpan(date, startMin) })

  return { create, move, resize, edit, remove, drop }
}
