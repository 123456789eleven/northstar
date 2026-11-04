// Swipe-to-complete state machine (pure). A gesture starts "pending"; after LOCK_PX of travel it locks to horizontal
// ("swiping") or vertical ("scroll", abandoned so native scrolling wins). Release past THRESHOLD completes.
export const THRESHOLD = 72
export const LOCK_PX = 8
export const MAX_PULL = 120

export type SwipeState =
  | { phase: 'idle' }
  | { phase: 'pending'; x: number; y: number }
  | { phase: 'swiping'; x: number; y: number; dx: number; armed: boolean }
  | { phase: 'scroll' }
  | { phase: 'done' }
  | { phase: 'cancelled' }

export type SwipeEvent =
  | { type: 'down'; x: number; y: number }
  | { type: 'move'; x: number; y: number }
  | { type: 'up' }
  | { type: 'cancel' }

export const idle: SwipeState = { phase: 'idle' }

/** Rightward swipes only; the pull is rubber-banded past the threshold so it never runs away. */
export const pull = (dx: number) => (dx <= 0 ? 0 : dx <= THRESHOLD ? dx : Math.min(MAX_PULL, THRESHOLD + (dx - THRESHOLD) * 0.3))

export function swipeReduce(s: SwipeState, e: SwipeEvent): SwipeState {
  if (e.type === 'down') return { phase: 'pending', x: e.x, y: e.y }
  if (e.type === 'cancel') return s.phase === 'idle' ? s : { phase: 'cancelled' }
  if (e.type === 'up') return s.phase === 'swiping' && s.armed ? { phase: 'done' } : s.phase === 'idle' ? s : { phase: 'cancelled' }
  // move
  if (s.phase === 'pending') {
    const dx = e.x - s.x
    const dy = e.y - s.y
    if (Math.abs(dx) < LOCK_PX && Math.abs(dy) < LOCK_PX) return s
    if (Math.abs(dy) >= Math.abs(dx) || dx < 0) return { phase: 'scroll' }
    return { phase: 'swiping', x: s.x, y: s.y, dx, armed: dx >= THRESHOLD }
  }
  if (s.phase === 'swiping') {
    const dx = e.x - s.x
    return { ...s, dx, armed: dx >= THRESHOLD }
  }
  return s
}

/** Is the gesture currently owning the pointer (so the row should translate and the click be swallowed)? */
export const isSwiping = (s: SwipeState): s is Extract<SwipeState, { phase: 'swiping' }> => s.phase === 'swiping'
