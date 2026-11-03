// Module-to-hue mapping, palette v3 (docs/design/system.md, "Module hues"). The same module is always the same hue.
// violet = Today + Plan + Career (the action colour), rose = Body/Food, teal = Money, indigo = Mind (Journal, Learning),
// sky = People, slate = You/system pages, amber = Trophies only (amber is reward-only in v3).
import type { IconName } from './Icons'
import { navItemFor } from './nav'

export type Hue = 'amber' | 'violet' | 'indigo' | 'teal' | 'rose' | 'sky' | 'slate'

export const MODULE_HUE: Record<string, Hue> = {
  today: 'violet', planner: 'violet', calendar: 'violet', tasks: 'violet', goals: 'violet', habits: 'violet', star: 'violet', career: 'violet',
  body: 'rose', food: 'rose',
  finance: 'teal',
  mind: 'indigo', journal: 'indigo', learning: 'indigo',
  people: 'sky',
  user: 'slate', review: 'slate', command: 'slate', settings: 'slate', data: 'slate', ontology: 'slate', history: 'slate',
  trophy: 'amber',
}

export const hueFor = (icon: string): Hue => MODULE_HUE[icon] ?? 'violet'

/** The nav module (icon) that owns a router pathname, or undefined for unknown routes. */
export function moduleForPath(pathname: string): IconName | undefined {
  return navItemFor(pathname)?.icon
}

/** Ontology object type -> owning module icon (Command page facets). */
export const TYPE_MODULE: Record<string, IconName> = {
  Task: 'tasks', Goal: 'goals', Person: 'people', Transaction: 'finance', Meal: 'food', LearningItem: 'learning',
  Interaction: 'people', LifeEvent: 'trophy', Review: 'review', Budget: 'finance', Habit: 'habits', HabitLog: 'habits',
  JournalEntry: 'journal', CalendarEvent: 'calendar',
}
