// Which buildings and trees just grew, so Home can raise them with a short animation. Pure diff plus a small session memory
// (module level, so returning to Home after adding a holding still shows the rise). Nothing is stored on disk.
import { useEffect, useMemo } from 'react'
import type { LifeMap } from './model'

export type Heights = ReadonlyMap<string, number>

/** Building heights by `district:index`, trees by `district:tId` (placeholders left out). */
export function heightsOf(map: LifeMap): Map<string, number> {
  const out = new Map<string, number>()
  for (const d of map.districts) {
    d.buildings.forEach((b, i) => out.set(`${d.id}:${i}`, b.h))
    for (const t of d.trees) if (!t.placeholder) out.set(`${d.id}:t${t.id}`, 1)
  }
  return out
}

/** Keys that rose by more than 2 px, or trees that are new. Nothing rises on the first look (prev null). */
export function grownKeys(prev: Heights | null, next: Heights): Set<string> {
  const out = new Set<string>()
  if (!prev) return out
  for (const [k, h] of next) {
    const was = prev.get(k)
    if (was === undefined ? k.includes(':t') : h > was + 2) out.add(k)
  }
  return out
}

let last: Heights | null = null

/** Keys that grew since Home last drew the city in this session. */
export function useRising(map: LifeMap): ReadonlySet<string> {
  const next = useMemo(() => heightsOf(map), [map])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rising = useMemo(() => grownKeys(last, next), [next])
  useEffect(() => { last = next }, [next])
  return rising
}
