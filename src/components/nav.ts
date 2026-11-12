// Home (/) is the Life map; Today (/today) is the day's plan. /map stays as an alias of Home.
// Page list for titles and the Ctrl+K palette. Which district and tab a route sits in: districts.ts (the city shell).
import type { IconName } from './Icons'
import type { SkillId } from '../features/game/types'

export type HubId = 'today' | 'plan' | 'money' | 'skills' | 'you'

export interface NavItem {
  to: string
  label: string
  icon: IconName
  /** Rail / palette section label. */
  group: string
  hub: HubId
  /** Life skill this page levels (rail level pip). */
  skill?: SkillId
  /** Old name or synonyms: palette search + secondary line ("You · History"). */
  aka?: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: 'home', group: 'Home', hub: 'today', aka: 'Life map City Overview' },
  { to: '/today', label: 'Today', icon: 'today', group: 'Today', hub: 'today', aka: "Today's plan Agenda Focus Overview Plan" },
  { to: '/tasks', label: 'Tasks', icon: 'tasks', group: 'Plan', hub: 'plan' },
  { to: '/planner', label: 'Planner', icon: 'calendar', group: 'Plan', hub: 'plan', aka: 'Calendar' },
  { to: '/goals', label: 'Goals', icon: 'goals', group: 'Plan', hub: 'plan', aka: 'Season goals' },
  { to: '/habits', label: 'Habits', icon: 'habits', group: 'Plan', hub: 'plan', aka: 'Routines' },
  { to: '/body', label: 'Body', icon: 'body', group: 'Areas', hub: 'skills', skill: 'body', aka: 'Weight Weigh-in Gym' },
  { to: '/food', label: 'Food', icon: 'food', group: 'Areas', hub: 'skills', skill: 'body', aka: 'Meals Kitchen' },
  { to: '/training', label: 'Training', icon: 'body', group: 'Areas', hub: 'skills', skill: 'body', aka: 'Lift Workout Sessions' },
  { to: '/finance', label: 'Money', icon: 'finance', group: 'Money', hub: 'money', skill: 'money', aka: 'Finance' },
  { to: '/mind', label: 'Mind', icon: 'mind', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/journal', label: 'Journal', icon: 'journal', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/learning', label: 'Learning', icon: 'learning', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/career', label: 'Career', icon: 'career', group: 'Areas', hub: 'skills', skill: 'career', aka: 'Wins' },
  { to: '/people', label: 'People', icon: 'people', group: 'Areas', hub: 'skills', skill: 'people', aka: 'Tree Friends' },
  { to: '/reach-out', label: 'Reach out', icon: 'capture', group: 'Areas', hub: 'skills', skill: 'people', aka: 'Contact Warmth Birthdays' },
  { to: '/score', label: 'Scoreboard', icon: 'trophy', group: 'You', hub: 'you', aka: 'You Overview Records Standing Highlights Ghost' },
  { to: '/history', label: 'Milestones', icon: 'trophy', group: 'You', hub: 'you', aka: 'Trophies History' },
  { to: '/review', label: 'Season', icon: 'review', group: 'You', hub: 'you', aka: 'Weekly review' },
  { to: '/ops', label: 'Intel', icon: 'command', group: 'You', hub: 'you', aka: 'Briefings' },
  { to: '/settings', label: 'Settings', icon: 'settings', group: 'You', hub: 'you' },
  { to: '/data', label: 'Data', icon: 'data', group: 'You', hub: 'you' },
  { to: '/ontology', label: 'Ontology', icon: 'ontology', group: 'You', hub: 'you' },
]

/** Kept for older imports: the rail/palette section order. */
export const NAV_GROUPS = ['Today', 'Plan', 'Money', 'Areas', 'You'] as const

const matches = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'))

/** The nav item that owns a router pathname. */
export function navItemFor(pathname: string): NavItem | undefined {
  const p = pathname === '/map' ? '/' : pathname
  return NAV.find((n) => matches(n.to, p))
}

/** Browser tab title for a router pathname: "Tasks | Northstar", bare "Northstar" when unknown. */
export function routeTitle(pathname: string): string {
  const item = navItemFor(pathname)
  return item ? `${item.label} | Northstar` : 'Northstar'
}
