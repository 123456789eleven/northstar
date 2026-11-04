// A brief (<= 900 ms) pulse when the daily word goal is reached while you write. Never on load, never repeats until the
// count drops below the goal again. Reduced motion: no pulse. Haptic/sound only via celebrate() (both off by default).
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../../components/motion'
import { celebrate } from '../game/ui/feedback'

export function useGoalPulse(words: number, goal: number): boolean {
  const reached = goal > 0 && words >= goal
  const [prev, setPrev] = useState(reached)
  const [playing, setPlaying] = useState(false)
  if (reached !== prev) {
    setPrev(reached)
    setPlaying(reached && !prefersReducedMotion())
  }
  const was = useRef(reached)
  useEffect(() => {
    if (!was.current && reached) celebrate('tick')
    was.current = reached
  }, [reached])
  useEffect(() => {
    if (!playing) return
    const t = window.setTimeout(() => setPlaying(false), 900)
    return () => window.clearTimeout(t)
  }, [playing])
  return playing
}
