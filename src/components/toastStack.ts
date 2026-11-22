// Toast stack geometry (Toast.tsx): pure, so it is tested without a DOM.
export const MAX_TOASTS = 3
export const TOAST_GAP = 10

/** Bottom offsets of a stack (newest first, index 0 at the bottom): each sits on the previous one plus the gap. Pure. */
export function stackOffsets(heights: number[], gap = TOAST_GAP): number[] {
  const out: number[] = []
  let y = 0
  for (const h of heights) { out.push(y); y += h + gap }
  return out
}

/** Keeps the newest `max` live toasts (newest first) and marks the rest dying. Pure. */
export function trimStack<T extends { dying: boolean }>(list: T[], max = MAX_TOASTS): T[] {
  let live = 0
  return list.map((t) => (t.dying ? t : ++live > max ? { ...t, dying: true } : t))
}
