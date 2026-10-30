import type { IconName } from './Icons'

export interface NavItem { to: string; label: string; icon: IconName; group: string }

export const NAV_GROUPS = ['Operate', 'Plan', 'Life', 'Reflect', 'System'] as const

export const NAV: NavItem[] = [
  { to: '/ops', label: 'Command', icon: 'command', group: 'Operate' },
  { to: '/', label: 'Today', icon: 'today', group: 'Operate' },
  { to: '/planner', label: 'Planner', icon: 'planner', group: 'Operate' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks', group: 'Operate' },
  { to: '/goals', label: 'Goals', icon: 'goals', group: 'Plan' },
  { to: '/habits', label: 'Habits', icon: 'habits', group: 'Plan' },
  { to: '/finance', label: 'Finance', icon: 'finance', group: 'Life' },
  { to: '/food', label: 'Food', icon: 'food', group: 'Life' },
  { to: '/learning', label: 'Learning', icon: 'learning', group: 'Life' },
  { to: '/people', label: 'People', icon: 'people', group: 'Life' },
  { to: '/journal', label: 'Journal', icon: 'journal', group: 'Reflect' },
  { to: '/history', label: 'History', icon: 'history', group: 'Reflect' },
  { to: '/review', label: 'Review', icon: 'review', group: 'Reflect' },
  { to: '/ontology', label: 'Ontology', icon: 'ontology', group: 'System' },
  { to: '/data', label: 'Data', icon: 'data', group: 'System' },
  { to: '/settings', label: 'Settings', icon: 'settings', group: 'System' },
]

export const PRIMARY_TABS = ['/ops', '/', '/planner', '/tasks']
