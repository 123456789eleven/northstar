import { lazy, Suspense, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useGameSettings } from '../gameSettings'
import { setHapticsEnabled } from '../../../lib/haptics'
import { setSoundEnabled } from '../../../lib/sound'
import type { PlayerState } from '../types'
import { PlayerContext, EMPTY_PLAYER } from './playerContext'
import { engineWanted, subscribeEngine } from './engineGate'

const EngineHost = lazy(() => import('./EngineHost'))

type Idle = (cb: () => void, opts?: { timeout: number }) => number
function whenIdle(cb: () => void): () => void {
  const w = window as unknown as { requestIdleCallback?: Idle; cancelIdleCallback?: (h: number) => void }
  if (w.requestIdleCallback) {
    const h = w.requestIdleCallback(cb, { timeout: 2000 })
    return () => w.cancelIdleCallback?.(h)
  }
  const t = window.setTimeout(cb, 200)
  return () => window.clearTimeout(t)
}

/** Renders the app at once; the engine chunk loads when idle (or when the Today board asks), never in Calm mode.
 *  Mirrors the device-local game settings into the feedback helpers and <html>. */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const g = useGameSettings()
  const asked = useSyncExternalStore(subscribeEngine, engineWanted)
  const [idle, setIdle] = useState(false)
  const [live, setLive] = useState<PlayerState | null>(null)
  useEffect(() => whenIdle(() => setIdle(true)), [])

  const run = !g.loading && !g.calm && (idle || asked)
  const player = useMemo<PlayerState>(() => {
    if (!g.loading && g.calm) return { ...EMPTY_PLAYER, loading: false, calm: true, streak: { ...EMPTY_PLAYER.streak, target: g.weekTarget } }
    return run && live ? live : EMPTY_PLAYER
  }, [g.loading, g.calm, g.weekTarget, run, live])

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
  return (
    <PlayerContext.Provider value={player}>
      {children}
      {run && <Suspense fallback={null}><EngineHost onPlayer={setLive} /></Suspense>}
    </PlayerContext.Provider>
  )
}
