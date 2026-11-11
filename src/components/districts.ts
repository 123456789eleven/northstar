// City shell (docs/redesign/CITY_SHELL_PLAN.md): every page lives in one district of the city. This file is the single source
// of truth for which district and which tab a route belongs to. Pure: no React, no DB.
import type { IconName } from './Icons'
import type { SkillId } from '../features/game/types'

export type DistrictId = 'home' | 'plan' | 'money' | 'body' | 'mind' | 'career' | 'people' | 'you'

export interface DistrictTab {
  to: string
  label: string
  /** Other paths that light this tab (sub-pages). */
  also?: string[]
  /** Money only: the in-page tab (`?tab=`) this entry stands for. */
  tab?: string
}

export interface DistrictDef {
  id: DistrictId
  label: string
  /** Where the district opens when you arrive from elsewhere for the first time. */
  to: string
  icon: IconName
  /** The Life map district this one is drawn as (the five areas). */
  skill?: SkillId
  /** Route prefixes owned by this district. */
  routes: string[]
  /** Sub-tabs shown under the district header, in order. */
  tabs: DistrictTab[]
}

/** In-page Money tabs (`/finance?tab=`), in display order. */
export const MONEY_TABS: DistrictTab[] = [
  { to: '/finance', tab: 'overview', label: 'Overview' },
  { to: '/finance', tab: 'markets', label: 'Markets' },
  { to: '/finance', tab: 'practice', label: 'Practice' },
  { to: '/finance', tab: 'learn', label: 'Learn' },
  { to: '/finance', tab: 'transactions', label: 'Transactions' },
  { to: '/finance', tab: 'budgets', label: 'Budgets' },
  { to: '/finance', tab: 'networth', label: 'Net worth' },
  { to: '/finance', tab: 'investments', label: 'Investments' },
  { to: '/finance', tab: 'import', label: 'Import' },
]

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  home: { id: 'home', label: 'Home', to: '/', icon: 'home', routes: ['/', '/map'], tabs: [] },
  plan: {
    id: 'plan', label: 'Plan', to: '/today', icon: 'planner',
    routes: ['/today', '/plan', '/tasks', '/planner', '/goals', '/habits'],
    tabs: [
      { to: '/today', label: 'Today' }, { to: '/plan', label: 'Overview' }, { to: '/tasks', label: 'Tasks' },
      { to: '/planner', label: 'Planner' }, { to: '/goals', label: 'Goals' }, { to: '/habits', label: 'Habits' },
    ],
  },
  money: { id: 'money', label: 'Money', to: '/finance', icon: 'finance', skill: 'money', routes: ['/finance'], tabs: MONEY_TABS },
  body: {
    id: 'body', label: 'Body', to: '/body', icon: 'body', skill: 'body', routes: ['/body', '/food'],
    tabs: [{ to: '/body', label: 'Weight' }, { to: '/food', label: 'Food' }],
  },
  mind: {
    id: 'mind', label: 'Mind', to: '/mind', icon: 'mind', skill: 'mind', routes: ['/mind', '/journal', '/learning'],
    tabs: [{ to: '/mind', label: 'Overview' }, { to: '/journal', label: 'Journal' }, { to: '/learning', label: 'Learning' }],
  },
  career: { id: 'career', label: 'Career', to: '/career', icon: 'career', skill: 'career', routes: ['/career'], tabs: [] },
  people: { id: 'people', label: 'People', to: '/people', icon: 'people', skill: 'people', routes: ['/people'], tabs: [] },
  you: {
    id: 'you', label: 'You', to: '/you', icon: 'user',
    routes: ['/you', '/history', '/review', '/ops', '/settings', '/data', '/ontology', '/interview', '/skills', '/style'],
    tabs: [
      { to: '/you', label: 'Overview' }, { to: '/skills', label: 'Areas' }, { to: '/history', label: 'Milestones' },
      { to: '/review', label: 'Season' }, { to: '/ops', label: 'Intel' }, { to: '/settings', label: 'Settings' },
      { to: '/data', label: 'Data' }, { to: '/ontology', label: 'Ontology' },
    ],
  },
}

/** The bottom strip, left to right. You lives behind the profile control in the top bar. */
export const STRIP: DistrictId[] = ['home', 'plan', 'money', 'body', 'mind', 'career', 'people']
/** Every district in city order (strip plus You). */
export const DISTRICT_ORDER: DistrictId[] = [...STRIP, 'you']

const owns = (route: string, pathname: string) => (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(route + '/'))

/** Which district a router pathname belongs to. Unknown paths count as Home. */
export function districtForPath(pathname: string): DistrictId {
  const p = pathname || '/'
  for (const id of DISTRICT_ORDER) if (DISTRICTS[id].routes.some((r) => owns(r, p))) return id
  return 'home'
}

export interface Location { district: DistrictDef; tab: DistrictTab | null }

/** District and sub-tab for a pathname (plus the query string, which picks the Money tab). */
export function subtabForPath(pathname: string, search = ''): Location {
  const district = DISTRICTS[districtForPath(pathname)]
  if (district.id === 'money') {
    const asked = new URLSearchParams(search).get('tab')
    return { district, tab: MONEY_TABS.find((t) => t.tab === asked) ?? MONEY_TABS[0] }
  }
  const tab = district.tabs.find((t) => owns(t.to, pathname) || !!t.also?.some((a) => owns(a, pathname))) ?? null
  return { district, tab }
}

/** "Money / Markets"; a district without tabs is just its name. */
export function breadcrumb(pathname: string, search = ''): string[] {
  const { district, tab } = subtabForPath(pathname, search)
  return tab ? [district.label, tab.label] : [district.label]
}

/** Remembers the last page per district so the strip returns you where you were. Module state: one per app session. */
const last: Partial<Record<DistrictId, string>> = {}
export function rememberPath(pathname: string, search = '') {
  const id = districtForPath(pathname)
  if (id !== 'home') last[id] = pathname + search
}
/** Strip target: re-tapping the current district goes to its entry; coming from elsewhere returns to the last page. */
export function stripTarget(id: DistrictId, current: DistrictId): string {
  const d = DISTRICTS[id]
  return id === current || id === 'home' ? d.to : (last[id] ?? d.to)
}
