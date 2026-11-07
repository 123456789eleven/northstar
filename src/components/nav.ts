// Information architecture v3 ("Constellation", docs/design/game-direction.md): 18 pages grouped into 4 hubs + Today.
// Every old URL stays a real route; hubs add landing pages (/plan, /skills, /mind, /you) and a tab strip across their pages.
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
  { to: '/', label: 'Today', icon: 'today', group: 'Today', hub: 'today' },
  { to: '/plan', label: 'Plan', icon: 'planner', group: 'Plan', hub: 'plan', aka: 'Overview' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks', group: 'Plan', hub: 'plan' },
  { to: '/planner', label: 'Planner', icon: 'calendar', group: 'Plan', hub: 'plan', aka: 'Calendar' },
  { to: '/goals', label: 'Goals', icon: 'goals', group: 'Plan', hub: 'plan', aka: 'Quest log' },
  { to: '/habits', label: 'Habits', icon: 'habits', group: 'Plan', hub: 'plan', aka: 'Routines' },
  { to: '/skills', label: 'Areas', icon: 'star', group: 'Areas', hub: 'skills', aka: 'Skills Constellation' },
  { to: '/body', label: 'Body', icon: 'body', group: 'Areas', hub: 'skills', skill: 'body', aka: 'Weight' },
  { to: '/food', label: 'Food', icon: 'food', group: 'Areas', hub: 'skills', skill: 'body', aka: 'Meals' },
  { to: '/finance', label: 'Money', icon: 'finance', group: 'Money', hub: 'money', skill: 'money', aka: 'Finance' },
  { to: '/mind', label: 'Mind', icon: 'mind', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/journal', label: 'Journal', icon: 'journal', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/learning', label: 'Learning', icon: 'learning', group: 'Areas', hub: 'skills', skill: 'mind' },
  { to: '/career', label: 'Career', icon: 'career', group: 'Areas', hub: 'skills', skill: 'career', aka: 'Wins' },
  { to: '/people', label: 'People', icon: 'people', group: 'Areas', hub: 'skills', skill: 'people' },
  { to: '/you', label: 'You', icon: 'user', group: 'You', hub: 'you', aka: 'Overview' },
  { to: '/history', label: 'Milestones', icon: 'trophy', group: 'You', hub: 'you', aka: 'Trophies History' },
  { to: '/review', label: 'Season', icon: 'review', group: 'You', hub: 'you', aka: 'Weekly review' },
  { to: '/ops', label: 'Intel', icon: 'command', group: 'You', hub: 'you', aka: 'Command' },
  { to: '/settings', label: 'Settings', icon: 'settings', group: 'You', hub: 'you' },
  { to: '/data', label: 'Data', icon: 'data', group: 'You', hub: 'you' },
  { to: '/ontology', label: 'Ontology', icon: 'ontology', group: 'You', hub: 'you' },
]

/** Kept for older imports: the rail/palette section order. */
export const NAV_GROUPS = ['Today', 'Plan', 'Money', 'Areas', 'You'] as const

export interface HubTab { to: string; label: string; /** Other paths that light this tab (sub-pages). */ also?: string[] }
export interface HubDef { id: Exclude<HubId, 'today'>; label: string; to: string; icon: IconName; tabs: HubTab[] }

export const HUBS: Record<Exclude<HubId, 'today'>, HubDef> = {
  plan: {
    id: 'plan', label: 'Plan', to: '/plan', icon: 'planner',
    tabs: [{ to: '/plan', label: 'Overview' }, { to: '/tasks', label: 'Tasks' }, { to: '/planner', label: 'Planner' }, { to: '/goals', label: 'Goals' }, { to: '/habits', label: 'Habits' }],
  },
  money: { id: 'money', label: 'Money', to: '/finance', icon: 'finance', tabs: [{ to: '/finance', label: 'Money' }] },
  skills: {
    id: 'skills', label: 'Areas', to: '/skills', icon: 'star',
    tabs: [
      { to: '/skills', label: 'Overview' },
      { to: '/body', label: 'Body', also: ['/food'] },
      { to: '/mind', label: 'Mind', also: ['/journal', '/learning'] },
      { to: '/career', label: 'Career' },
      { to: '/people', label: 'People' },
    ],
  },
  you: {
    id: 'you', label: 'You', to: '/you', icon: 'user',
    tabs: [
      { to: '/you', label: 'Overview' }, { to: '/history', label: 'Milestones' }, { to: '/review', label: 'Season' }, { to: '/ops', label: 'Intel' },
      { to: '/settings', label: 'Settings' }, { to: '/data', label: 'Data' }, { to: '/ontology', label: 'Ontology' },
    ],
  },
}

/** Second-level tabs inside a skill (Body: Weight | Food; Mind: Overview | Journal | Learning). */
export const SUBTABS: Array<{ label: string; tabs: HubTab[] }> = [
  { label: 'Body', tabs: [{ to: '/body', label: 'Weight' }, { to: '/food', label: 'Food' }] },
  { label: 'Mind', tabs: [{ to: '/mind', label: 'Overview' }, { to: '/journal', label: 'Journal' }, { to: '/learning', label: 'Learning' }] },
]

const matches = (to: string, pathname: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'))

/** The nav item that owns a router pathname. */
export function navItemFor(pathname: string): NavItem | undefined {
  return NAV.find((n) => matches(n.to, pathname))
}

/** Which hub a pathname belongs to (unknown paths count as Today). */
export function hubForPath(pathname: string): HubId {
  return navItemFor(pathname)?.hub ?? 'today'
}

/** True when a hub tab is the current page or one of its sub-pages. */
export function tabActive(tab: HubTab, pathname: string): boolean {
  return matches(tab.to, pathname) || !!tab.also?.some((p) => matches(p, pathname))
}

/** Browser tab title for a router pathname: "Tasks | Northstar", bare "Northstar" when unknown. */
export function routeTitle(pathname: string): string {
  const item = navItemFor(pathname)
  return item ? `${item.label} | Northstar` : 'Northstar'
}
