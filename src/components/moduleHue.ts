// Aurora module-to-hue mapping (docs/design/system.md, "Module hues"). Max 4 hues; the same module always gets the same hue.
// amber = Operate + System (the brand's own work surfaces), violet = Plan + Reflect + Learning (growth and reflection),
// teal = Finance (money), rose = Food, Body, People (body and relationships).
import type { IconName } from './Icons'
import { NAV } from './nav'

export type Hue = 'amber' | 'violet' | 'teal' | 'rose'

export const MODULE_HUE: Record<string, Hue> = {
  command: 'amber', today: 'amber', planner: 'amber', tasks: 'amber',
  ontology: 'amber', data: 'amber', settings: 'amber',
  goals: 'violet', habits: 'violet', learning: 'violet', journal: 'violet', history: 'violet', review: 'violet',
  finance: 'teal',
  food: 'rose', body: 'rose', people: 'rose',
}

export const hueFor = (icon: string): Hue => MODULE_HUE[icon] ?? 'amber'

/** The nav module (icon) that owns a router pathname, or undefined for unknown routes. */
export function moduleForPath(pathname: string): IconName | undefined {
  const item = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname === n.to || pathname.startsWith(n.to + '/')))
  return item?.icon
}

/** Ontology object type -> owning module icon (Command page facets). */
export const TYPE_MODULE: Record<string, IconName> = {
  Task: 'tasks', Goal: 'goals', Person: 'people', Transaction: 'finance', Meal: 'food', LearningItem: 'learning',
  Interaction: 'people', LifeEvent: 'history', Review: 'review', Budget: 'finance', Habit: 'habits', HabitLog: 'habits',
  JournalEntry: 'journal', CalendarEvent: 'planner',
}
