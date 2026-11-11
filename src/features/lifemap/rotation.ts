// The city's view direction (quarter turns), shared by Home, the mini-map and the backdrop. A per-device convenience kept in
// localStorage (never synced, never exported); missing storage just means the default view.
import { useSyncExternalStore } from 'react'
import { quarter } from './iso'

const KEY = 'city.rotation'
const subs = new Set<() => void>()
let rot = (() => { try { return quarter(Number(localStorage.getItem(KEY) ?? 0) || 0) } catch { return 0 } })()

export function setCityRotation(r: number) {
  const q = quarter(r)
  if (q === rot) return
  rot = q
  try { localStorage.setItem(KEY, String(q)) } catch { /* ignore */ }
  subs.forEach((f) => f())
}
export const getCityRotation = () => rot
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

export function useCityRotation(): number {
  return useSyncExternalStore(subscribe, getCityRotation, () => 0)
}
