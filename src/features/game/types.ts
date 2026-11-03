// Contract between the game engine (src/features/game/engine/*) and the UI (shell, hubs, quest cards, constellation).
// The engine derives everything from existing tables; nothing here is persisted. See docs/design/game-direction.md.

export type SkillId = 'body' | 'money' | 'mind' | 'career' | 'people'

export const SKILLS: { id: SkillId; label: string }[] = [
  { id: 'body', label: 'Body' },
  { id: 'money', label: 'Money' },
  { id: 'mind', label: 'Mind' },
  { id: 'career', label: 'Career' },
  { id: 'people', label: 'People' },
]

export interface LevelInfo {
  level: number
  /** Total XP earned (never decreases). */
  xp: number
  /** XP earned inside the current level. */
  xpIntoLevel: number
  /** XP needed to finish the current level (size of this level). */
  xpForNext: number
}

export interface SkillState extends LevelInfo {
  id: SkillId
  label: string
  todayXp: number
}

export type QuestKind =
  | 'weigh-in' | 'protein' | 'calories' | 'workout' | 'journal' | 'win'
  | 'contact' | 'task' | 'habit' | 'money' | 'learning' | 'review'

export interface Quest {
  /** Stable for the day, e.g. `2026-11-02:weigh-in`. */
  id: string
  kind: QuestKind
  skill: SkillId
  title: string
  hint?: string
  xp: number
  done: boolean
  /** When the quest is measurable (e.g. 120 of 140 g protein). */
  progress?: { value: number; target: number; unit?: string }
  /** Where tapping the quest goes (hash route, may carry ?focus=). */
  href?: string
  /** True when the quest completes by itself from real data. */
  auto: boolean
}

export interface XpGain {
  id: string
  /** ISO time of the underlying action. */
  at: string
  skill: SkillId
  xp: number
  /** Plain-language "Why?" line: "Logged a weigh-in (+15)". */
  reason: string
}

export interface StreakState {
  /** Active days needed this week. */
  target: number
  daysThisWeek: number
  /** Mon..Sun, true when the day counted (or was covered by a rest token). */
  weekDots: boolean[]
  restTokens: number
  weeksInRow: number
}

export interface PlayerState extends LevelInfo {
  loading: boolean
  /** Calm mode: UI should hide levels, quests and XP. */
  calm: boolean
  skills: SkillState[]
  quests: Quest[]
  questsDone: number
  /** All of today's quests are done. */
  cleared: boolean
  streak: StreakState
  todayXp: number
  /** Newest first, last 20 gains. */
  recent: XpGain[]
}
