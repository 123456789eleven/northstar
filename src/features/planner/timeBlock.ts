// Pure time-block math. A block is a local calendar event whose `uid` is "tb:<kind>:<taskId|0>:<nonce>" (no schema change).
// Times are wall-clock HH:MM on a local date, so DST never shifts a block on screen; realMinutes() gives true elapsed time.
import type { CalendarEvent, ISODate } from '../../db'
import { parseISODate } from '../../lib/dates'
import { DAY_MIN, daySegments, toMin } from './layout'

export const SNAP = 15
export const DEFAULT_BLOCK = 45
export const MIN_BLOCK = 15
/** Blocks never cross midnight: the last representable end is 23:59. */
export const LAST_MIN = DAY_MIN - 1

export type BlockKind = 'task' | 'training'

export const snap = (min: number, step = SNAP) => Math.round(min / step) * step

export const hhmm = (min: number): string => {
  const m = Math.max(0, Math.min(LAST_MIN, Math.round(min)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** Nonexistent spring-forward wall times (02:30 on the gap day) resolve to the first real minute after the gap. */
export function normalizeWall(date: ISODate, min: number): number {
  const base = parseISODate(date)
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, min)
  if (d.getDate() !== base.getDate()) return min < 0 ? 0 : LAST_MIN
  return d.getHours() * 60 + d.getMinutes()
}

export interface Span { date: ISODate; start: string; end: string }

/** A block starting at `startMin` for `len` minutes, snapped, moved earlier if it would pass midnight. */
export function makeSpan(date: ISODate, startMin: number, len = DEFAULT_BLOCK): Span {
  const length = Math.max(MIN_BLOCK, snap(len))
  let s = Math.max(0, snap(startMin))
  if (s + length > LAST_MIN) s = Math.max(0, DAY_MIN - length - SNAP)
  s = normalizeWall(date, Math.min(s, LAST_MIN - MIN_BLOCK))
  const e = normalizeWall(date, Math.min(LAST_MIN, s + length))
  return { date, start: hhmm(s), end: hhmm(Math.max(e, Math.min(LAST_MIN, s + MIN_BLOCK))) }
}

/** Move a span to a new start (and date), keeping its wall-clock length. */
export function moveSpan(span: Span, date: ISODate, startMin: number): Span {
  const len = Math.max(MIN_BLOCK, toMin(span.end) - toMin(span.start))
  return makeSpan(date, startMin, len)
}

/** Drag the bottom edge: snapped, at least MIN_BLOCK long, never past 23:59. */
export function resizeSpan(span: Span, endMin: number): Span {
  const s = toMin(span.start)
  const e = Math.min(LAST_MIN, Math.max(s + MIN_BLOCK, snap(endMin)))
  return { ...span, end: hhmm(normalizeWall(span.date, e)) }
}

/** Real elapsed minutes between two wall times on `date` (a spring-forward day has 60 fewer, fall-back 60 more). */
export function realMinutes(date: ISODate, start: string, end: string): number {
  const b = parseISODate(date)
  const at = (min: number) => new Date(b.getFullYear(), b.getMonth(), b.getDate(), 0, min).getTime()
  return Math.round((at(toMin(end)) - at(toMin(start))) / 60_000)
}

/** Pointer y (px from the grid top) to snapped minutes of the day. */
export const minFromY = (y: number, loHour: number, pxPerHour: number) => snap(loHour * 60 + (y / pxPerHour) * 60)

const PREFIX = 'tb:'
export const blockUid = (kind: BlockKind, taskId?: number) => `${PREFIX}${kind}:${taskId ?? 0}:${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
export interface BlockMeta { kind: BlockKind; taskId?: number }
export function blockMeta(e: { uid?: string }): BlockMeta | null {
  const m = /^tb:(task|training):(\d+):/.exec(e.uid ?? '')
  if (!m) return null
  return { kind: m[1] as BlockKind, taskId: Number(m[2]) || undefined }
}
export const isBlock = (e: { uid?: string }) => blockMeta(e) !== null

/** Ids of timed events that overlap another timed event on `date` (Google events count as the other party). */
export function conflictIds(events: CalendarEvent[], date: ISODate): Set<number> {
  const segs = daySegments(events, date)
  const out = new Set<number>()
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[j].start >= segs[i].end) break
      if (segs[i].start < segs[j].end && segs[j].start < segs[i].end) {
        if (segs[i].event.id != null) out.add(segs[i].event.id!)
        if (segs[j].event.id != null) out.add(segs[j].event.id!)
      }
    }
  }
  return out
}
