// Live per-area week for the Areas hub: the engine's dated actions, regrouped by area. Read-only.
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { startOfWeek, today } from '../../lib/dates'
import { areaWeek, type AreaWeek } from './areas'
import { deriveGains } from './engine/derive'
import { loadSnapshot } from './engine/snapshot'

/** Undefined while loading. */
export function useAreaWeek(target: number): AreaWeek[] | undefined {
  const snap = useLiveQuery(loadSnapshot, [])
  const d = today()
  return useMemo(() => (snap ? areaWeek(deriveGains(snap, d), startOfWeek(d), target) : undefined), [snap, d, target])
}
