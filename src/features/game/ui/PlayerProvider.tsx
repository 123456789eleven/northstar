import { useEffect, type ReactNode } from 'react'
import { usePlayer } from '../usePlayer'
import { useGameSettings } from '../gameSettings'
import { setHapticsEnabled } from '../../../lib/haptics'
import { setSoundEnabled } from '../../../lib/sound'
import { PlayerContext } from './playerContext'

/** Runs the engine once for the app and mirrors the device-local game settings into the feedback helpers and <html>. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const player = usePlayer()
  const g = useGameSettings()
  useEffect(() => { setHapticsEnabled(g.haptics) }, [g.haptics])
  useEffect(() => { setSoundEnabled(g.sound) }, [g.sound])
  useEffect(() => {
    const root = document.documentElement
    if (g.motion === 'reduced') root.dataset.motion = 'reduced'
    else delete root.dataset.motion
  }, [g.motion])
  useEffect(() => {
    const root = document.documentElement
    if (g.calm) root.dataset.calm = 'on'
    else delete root.dataset.calm
  }, [g.calm])
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
}
