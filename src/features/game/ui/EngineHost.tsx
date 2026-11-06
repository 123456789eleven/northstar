// Lazy chunk: runs the snapshot query + engine (usePlayer) and hands the result up to PlayerProvider. Only ever imported
// through React.lazy, so the engine, quest rules and the data modules they read stay out of the entry bundle.
import { useEffect } from 'react'
import { usePlayer } from '../usePlayer'
import type { PlayerState } from '../types'

export default function EngineHost({ onPlayer }: { onPlayer: (p: PlayerState | null) => void }) {
  const player = usePlayer()
  useEffect(() => { onPlayer(player) }, [player, onPlayer])
  useEffect(() => () => onPlayer(null), [onPlayer])
  return null
}
