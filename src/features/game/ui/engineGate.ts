// When the game engine should load. The provider loads it once the browser is idle, or sooner when a game surface that
// needs real numbers (the Today board) mounts. Calm mode never asks, and the provider ignores asks while Calm is on.
import { useEffect } from 'react'

let wanted = false
const subs = new Set<() => void>()

export const engineWanted = () => wanted
export function subscribeEngine(fn: () => void) {
  subs.add(fn)
  return () => { subs.delete(fn) }
}
export function requestEngine() {
  if (wanted) return
  wanted = true
  subs.forEach((fn) => fn())
}
/** Call from a game component that is useless without the engine. */
export function useEngineOnMount() {
  useEffect(() => { requestEngine() }, [])
}
