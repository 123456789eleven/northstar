// One usePlayer() for the whole shell: the rail pips, mission rail, phone strip, Today board and moments all read this
// context instead of each running the snapshot query. Falls back to an empty, loading state outside the provider.
import { createContext, useContext } from 'react'
import type { PlayerState } from '../types'
import { SKILLS } from '../types'

const EMPTY_LEVEL = { level: 1, xp: 0, xpIntoLevel: 0, xpForNext: 100 }

export const EMPTY_PLAYER: PlayerState = {
  loading: true, calm: false, ...EMPTY_LEVEL,
  skills: SKILLS.map((s) => ({ ...s, ...EMPTY_LEVEL, todayXp: 0 })),
  quests: [], questsDone: 0, cleared: false,
  streak: { target: 5, daysThisWeek: 0, weekDots: [false, false, false, false, false, false, false], restTokens: 0, weeksInRow: 0 },
  todayXp: 0, recent: [],
}

export const PlayerContext = createContext<PlayerState>(EMPTY_PLAYER)

export const usePlayerState = (): PlayerState => useContext(PlayerContext)
