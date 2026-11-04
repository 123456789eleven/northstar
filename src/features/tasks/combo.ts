// Combo chip: completing 3+ tasks within 10 minutes shows a brief "x3". Visual only: no XP, nothing stored.
import { useSyncExternalStore } from 'react'

export const COMBO_WINDOW_MS = 10 * 60_000
export const COMBO_MIN = 3
export const COMBO_SHOW_MS = 4000

/** Number of completions inside the window ending at `now` (including `now`). */
export function comboCount(times: number[], now: number): number {
  return times.filter((t) => t <= now && now - t <= COMBO_WINDOW_MS).length
}

let times: number[] = []
let shown: { n: number; at: number } | null = null
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

/** Call when a task is completed. Returns the combo size (>= COMBO_MIN means the chip shows). */
export function recordCompletion(now = Date.now()): number {
  times = [...times.filter((t) => now - t <= COMBO_WINDOW_MS), now]
  const n = comboCount(times, now)
  if (n >= COMBO_MIN) {
    shown = { n, at: now }
    emit()
    window.setTimeout(() => { if (shown && shown.at === now) { shown = null; emit() } }, COMBO_SHOW_MS)
  }
  return n
}

/** An undone completion no longer counts. */
export function forgetCompletion() {
  times = times.slice(0, -1)
}

export function useCombo(): number | null {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f) } },
    () => shown,
    () => null,
  )?.n ?? null
}

export function resetCombo() {
  times = []
  shown = null
  emit()
}
