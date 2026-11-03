// The one XP table. Everything in the engine reads it; Settings shows it ("Why?" transparency).
// Each action maps to exactly one skill. Tune numbers here only.
import type { SkillId } from '../types'

export type XpKind =
  | 'task' | 'habit' | 'weigh-in' | 'calories-met' | 'protein-met' | 'workout' | 'meal'
  | 'journal' | 'learning' | 'focus' | 'win' | 'contact' | 'budget-day' | 'categorize'
  | 'import' | 'net-worth' | 'milestone' | 'goal-done' | 'review' | 'day-clear' | 'week-clear'

export interface XpRule {
  kind: XpKind
  /** A fixed skill, 'goal' (the linked goal's area, else `fallback`), or 'top' (the skill earned most in the period). */
  skill: SkillId | 'goal' | 'top'
  fallback?: SkillId
  /** Base XP per occurrence. */
  xp: number
  /** Max XP of this kind per day. */
  cap: number
  label: string
  /** Plain-language rule, shown in Settings. */
  rule: string
}

export const XP_TABLE: XpRule[] = [
  { kind: 'weigh-in', skill: 'body', xp: 15, cap: 15, label: 'Logged a weigh-in', rule: 'One weigh-in per day' },
  { kind: 'calories-met', skill: 'body', xp: 20, cap: 20, label: 'Hit your calorie target', rule: 'Calories logged reach 95% of your target' },
  { kind: 'protein-met', skill: 'body', xp: 25, cap: 25, label: 'Hit your protein target', rule: 'Protein logged reaches 95% of your target' },
  { kind: 'workout', skill: 'body', xp: 30, cap: 30, label: 'Trained', rule: 'A lift/workout habit check-in or logged workout' },
  { kind: 'meal', skill: 'body', xp: 5, cap: 15, label: 'Logged a meal', rule: 'Up to 3 meals a day' },
  { kind: 'budget-day', skill: 'money', xp: 10, cap: 10, label: 'Stayed on budget', rule: 'A past day with spending logged and every budget still within its limit' },
  { kind: 'categorize', skill: 'money', xp: 5, cap: 15, label: 'Categorized a transaction', rule: 'Up to 3 a day' },
  { kind: 'import', skill: 'money', xp: 15, cap: 15, label: 'Imported transactions', rule: 'One import a day' },
  { kind: 'net-worth', skill: 'money', xp: 10, cap: 10, label: 'Updated net worth', rule: 'Balances recorded for a day' },
  { kind: 'journal', skill: 'mind', xp: 20, cap: 30, label: 'Wrote a journal entry', rule: '+10 for 150 words or more' },
  { kind: 'learning', skill: 'mind', xp: 1, cap: 60, label: 'Studied', rule: '1 XP per 3 minutes of study, up to 60 a day' },
  { kind: 'focus', skill: 'mind', xp: 10, cap: 30, label: 'Finished a focus session', rule: 'Up to 3 a day' },
  { kind: 'win', skill: 'career', xp: 25, cap: 50, label: 'Logged a win', rule: 'Up to 2 a day' },
  { kind: 'review', skill: 'career', xp: 60, cap: 60, label: 'Locked a weekly review', rule: 'When the review is locked' },
  { kind: 'milestone', skill: 'goal', fallback: 'career', xp: 50, cap: 100, label: 'Reached a goal milestone', rule: 'Skill follows the goal area' },
  { kind: 'goal-done', skill: 'goal', fallback: 'career', xp: 150, cap: 300, label: 'Finished a goal', rule: 'Skill follows the goal area' },
  { kind: 'contact', skill: 'people', xp: 12, cap: 36, label: 'Contacted someone', rule: 'One per person per day, up to 3' },
  { kind: 'task', skill: 'goal', fallback: 'mind', xp: 10, cap: 60, label: 'Finished a task', rule: '+5 high priority, +5 linked to a goal; skill follows the goal area, else Mind' },
  { kind: 'habit', skill: 'goal', fallback: 'mind', xp: 8, cap: 40, label: 'Checked in a habit', rule: 'Skill follows the linked goal area, else Mind' },
  { kind: 'day-clear', skill: 'top', xp: 30, cap: 30, label: 'Day cleared', rule: 'All of the day quests done; XP goes to the skill you earned most in' },
  { kind: 'week-clear', skill: 'top', xp: 120, cap: 120, label: 'Week cleared', rule: 'Weekly active-day target met; XP goes to the skill you earned most in' },
]

export const RULES = Object.fromEntries(XP_TABLE.map((r) => [r.kind, r])) as Record<XpKind, XpRule>

export const TASK_PRIORITY_BONUS = 5
export const TASK_GOAL_BONUS = 5
export const JOURNAL_LONG_WORDS = 150
export const JOURNAL_LONG_BONUS = 10
export const TARGET_MET_RATIO = 0.95
export const QUALIFYING_DAY_XP = 20
export const LEARNING_MIN_PER_XP = 3
