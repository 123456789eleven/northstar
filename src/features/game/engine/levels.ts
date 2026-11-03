// Level curve. Finishing level n takes 100*n XP, so reaching level n+1 needs 100*n(n+1)/2 cumulative XP
// (design doc). Level 1 starts at 0 XP.
import type { LevelInfo } from '../types'

/** Cumulative XP at which `level` begins (level 1 = 0, level 2 = 100, level 3 = 300 ...). */
export function xpToReach(level: number): number {
  const n = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1))
  return (100 * (n - 1) * n) / 2
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Number.isFinite(totalXp) && totalXp > 0 ? Math.floor(totalXp) : 0
  let level = Math.max(1, Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2))
  while (xpToReach(level) > xp) level--
  while (xpToReach(level + 1) <= xp) level++
  return { level, xp, xpIntoLevel: xp - xpToReach(level), xpForNext: 100 * level }
}
