// A key that changes each time a number goes UP after the first render, so a CSS pop animation (.tick-pop) replays
// only on a real gain (a task finished, a circle warmer) and never on load.
import { useRef } from 'react'

export function usePopKey(n: number | null): number {
  const prev = useRef(n)
  const key = useRef(0)
  if (n != null && prev.current != null && n > prev.current) key.current++
  prev.current = n
  return key.current
}
