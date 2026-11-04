// Module-level focus-run store: the timer keeps counting across route changes while the app stays open.
// No notifications, no sound (celebrate() is gated by the Game > sound setting), nothing persisted.
import { useSyncExternalStore } from 'react'
import { celebrate } from '../game/ui/feedback'
import { elapsedMs, focusReducer, IDLE, minutesByDay, type FocusAction, type FocusRun } from './focusRun'
import { addSession, undoLast } from './learningData'

let state: FocusRun = IDLE
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

export function focusDispatch(a: FocusAction): void {
  const next = focusReducer(state, a)
  if (next !== state) { state = next; emit() }
}
export const getFocusRun = (): FocusRun => state
export function useFocusRun(): FocusRun {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => state, () => IDLE)
}

export interface StopResult { itemId: number; parts: { date: string; minutes: number }[]; undo: () => Promise<void> }

/** Stop the run, log its minutes through addSession (one row per day it touched) and return an undo. Under 30 s logs nothing. */
export async function stopFocusRun(now = Date.now()): Promise<StopResult | null> {
  const s = state
  if (s.phase === 'idle') return null
  const parts = minutesByDay(s, now)
  const itemId = s.itemId
  focusDispatch({ type: 'reset' })
  for (const p of parts) await addSession(itemId, p.minutes, p.date)
  if (parts.length) celebrate('tick')
  return { itemId, parts, undo: async () => { for (const p of parts) await undoLast(itemId, p.minutes, p.date) } }
}

export const focusElapsed = (now: number) => elapsedMs(state, now)
