// The player state behind the game layer: derived from existing tables on every change, nothing persisted.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { toISODate } from '../../lib/dates'
import { buildPlayer } from './engine/player'
import { emptySnapshot, loadSnapshot } from './engine/snapshot'
import type { PlayerState } from './types'

const EMPTY = emptySnapshot()

export function usePlayer(): PlayerState {
  const snap = useLiveQuery(loadSnapshot, [])
  const [day, setDay] = useState(() => toISODate())

  // Roll the day over at local midnight without a reload.
  useEffect(() => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
    const t = setTimeout(() => setDay(toISODate()), next.getTime() - now.getTime())
    return () => clearTimeout(t)
  }, [day])

  return useMemo(() => ({ loading: snap === undefined, ...buildPlayer(snap ?? EMPTY, day) }), [snap, day])
}
