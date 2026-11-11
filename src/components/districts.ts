// City shell (docs/redesign/CITY_SHELL_PLAN.md, BUILDINGS_PLAN.md): every page lives on one floor of one building (district).
// This file is the single source of truth for which building and which floor a route belongs to. Pure: no React, no DB.
import type { IconName } from './Icons'
import type { SkillId } from '../features/game/types'

export type DistrictId = 'home' | 'plan' | 'money' | 'body' | 'mind' | 'career' | 'people' | 'you'

/** One floor of a building: one job, one route. */
export interface Floor {
  /** Stable id (tests, the floor slide). */
  id: string
  /** Under 4 words. */
  label: string
  icon?: IconName
  /** Route the floor opens (may carry a query, e.g. `/finance?tab=markets`). */
  to: string
  /** Other paths that light this floor (sub-pages). */
  also?: string[]
  /** Money only: the in-page tab (`?tab=`) this entry stands for. */
  tab?: string
}
/** Kept for older imports: a floor used to be called a tab. */
export type DistrictTab = Floor

export interface DistrictDef {
  id: DistrictId
  /** Strip label (the area). */
  label: string
  /** The building's name in the city (head of the frame). */
  building: string
  /** Where the district opens when you arrive from elsewhere for the first time. */
  to: string
  icon: IconName
  /** The Life map district this one is drawn as (the five areas). */
  skill?: SkillId
  /** Route prefixes owned by this district. */
  routes: string[]
  /** Floors, top to bottom. */
  floors: Floor[]
  /** False while the building still switches floors inside its page (Money until B3): no elevator in the frame. */
  elevator?: boolean
}

/** Money's in-page groups and their sub-tabs (Finance.tsx). The URL carries the sub-tab id (`?tab=`); the group follows. */
export const MONEY_GROUPS: (Floor & { subs: Floor[] })[] = [
  { id: 'overview', to: '/finance', tab: 'overview', label: 'Overview', subs: [{ id: 'overview', to: '/finance', tab: 'overview', label: 'Overview' }] },
  { id: 'markets', to: '/finance', tab: 'markets', label: 'Markets', subs: [{ id: 'markets', to: '/finance', tab: 'markets', label: 'Markets' }] },
  {
    id: 'cash', to: '/finance', tab: 'cash', label: 'Cash',
    subs: [
      { id: 'transactions', to: '/finance', tab: 'transactions', label: 'Transactions' },
      { id: 'budgets', to: '/finance', tab: 'budgets', label: 'Budgets' },
      { id: 'import', to: '/finance', tab: 'import', label: 'Import' },
    ],
  },
  {
    id: 'wealth', to: '/finance', tab: 'wealth', label: 'Wealth',
    subs: [{ id: 'networth', to: '/finance', tab: 'networth', label: 'Net worth' }, { id: 'investments', to: '/finance', tab: 'investments', label: 'Investments' }],
  },
  {
    id: 'academy', to: '/finance', tab: 'academy', label: 'Academy',
    subs: [{ id: 'practice', to: '/finance', tab: 'practice', label: 'Practice' }, { id: 'learn', to: '/finance', tab: 'learn', label: 'Learn' }],
  },
]

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  home: { id: 'home', label: 'Home', building: 'City', to: '/', icon: 'home', routes: ['/', '/map'], floors: [] },
  plan: {
    id: 'plan', label: 'Plan', building: 'Town hall', to: '/today', icon: 'planner',
    routes: ['/today', '/plan', '/tasks', '/planner', '/goals', '/habits'],
    floors: [
      { id: 'today', to: '/today', label: 'Today', icon: 'today' }, { id: 'overview', to: '/plan', label: 'Overview', icon: 'planner' },
      { id: 'tasks', to: '/tasks', label: 'Tasks', icon: 'tasks' }, { id: 'planner', to: '/planner', label: 'Planner', icon: 'calendar' },
      { id: 'goals', to: '/goals', label: 'Goals', icon: 'goals' }, { id: 'habits', to: '/habits', label: 'Habits', icon: 'habits' },
    ],
  },
  money: { id: 'money', label: 'Money', building: 'Bank', to: '/finance', icon: 'finance', skill: 'money', routes: ['/finance'], floors: MONEY_GROUPS, elevator: false },
  body: {
    id: 'body', label: 'Body', building: 'Gym', to: '/body', icon: 'body', skill: 'body', routes: ['/body', '/food', '/training'],
    floors: [
      { id: 'weigh-in', to: '/body', label: 'Weigh-in', icon: 'weight' },
      { id: 'kitchen', to: '/food', label: 'Kitchen', icon: 'food' },
      { id: 'training', to: '/training', label: 'Training', icon: 'body' },
    ],
  },
  mind: {
    id: 'mind', label: 'Mind', building: 'Library', to: '/mind', icon: 'mind', skill: 'mind', routes: ['/mind', '/journal', '/learning'],
    floors: [
      { id: 'overview', to: '/mind', label: 'Overview', icon: 'mind' }, { id: 'journal', to: '/journal', label: 'Journal', icon: 'journal' },
      { id: 'learning', to: '/learning', label: 'Learning', icon: 'learning' },
    ],
  },
  career: { id: 'career', label: 'Career', building: 'Office', to: '/career', icon: 'career', skill: 'career', routes: ['/career'], floors: [] },
  people: { id: 'people', label: 'People', building: 'Park', to: '/people', icon: 'people', skill: 'people', routes: ['/people'], floors: [] },
  you: {
    id: 'you', label: 'You', building: 'Home base', to: '/you', icon: 'user',
    routes: ['/you', '/history', '/review', '/ops', '/settings', '/data', '/ontology', '/interview', '/skills', '/score', '/style'],
    floors: [
      { id: 'overview', to: '/you', label: 'Overview', icon: 'user' }, { id: 'areas', to: '/skills', label: 'Areas', icon: 'star' },
      { id: 'scoreboard', to: '/score', label: 'Scoreboard', icon: 'trophy' }, { id: 'milestones', to: '/history', label: 'Milestones', icon: 'history' },
      { id: 'season', to: '/review', label: 'Season', icon: 'review' }, { id: 'intel', to: '/ops', label: 'Intel', icon: 'command' },
      { id: 'settings', to: '/settings', label: 'Settings', icon: 'settings' }, { id: 'data', to: '/data', label: 'Data', icon: 'data' },
      { id: 'ontology', to: '/ontology', label: 'Ontology', icon: 'ontology' },
    ],
  },
}

/** Other names for a floor and the route they now open (App.tsx turns each into a redirect). */
export const FLOOR_ALIASES: Record<string, string> = {
  '/gym': '/body',
  '/weigh-in': '/body',
  '/weight': '/body',
  '/kitchen': '/food',
  '/meals': '/food',
  '/body/training': '/training',
  '/lift': '/training',
}

/** The bottom strip, left to right. You lives behind the profile control in the top bar. */
export const STRIP: DistrictId[] = ['home', 'plan', 'money', 'body', 'mind', 'career', 'people']
/** Every district in city order (strip plus You). */
export const DISTRICT_ORDER: DistrictId[] = [...STRIP, 'you']

const owns = (route: string, pathname: string) => (route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(route + '/'))
const pathOf = (to: string) => to.split('?')[0]
const resolve = (pathname: string) => FLOOR_ALIASES[pathname] ?? (pathname || '/')

/** Which district a router pathname belongs to. Unknown paths count as Home. */
export function districtForPath(pathname: string): DistrictId {
  const p = resolve(pathname)
  for (const id of DISTRICT_ORDER) if (DISTRICTS[id].routes.some((r) => owns(r, p))) return id
  return 'home'
}

/** Whether the frame shows the floor selector (an elevator) for this building. */
export const hasElevator = (d: DistrictDef) => d.elevator !== false && d.floors.length > 1

export interface Location {
  district: DistrictDef
  floor: Floor | null
  /** Kept for older callers: same as floor. */
  tab: Floor | null
  /** Money: the sub-tab inside a group that has several. */
  sub?: Floor
}

/** Building and floor for a pathname (plus the query string, which picks the Money tab). */
export function floorForPath(pathname: string, search = ''): Location {
  const p = resolve(pathname)
  const district = DISTRICTS[districtForPath(p)]
  if (district.id === 'money') {
    const asked = new URLSearchParams(search).get('tab') ?? 'overview'
    const group = MONEY_GROUPS.find((g) => g.subs.some((s) => s.tab === asked)) ?? MONEY_GROUPS[0]
    const sub = group.subs.find((s) => s.tab === asked) ?? group.subs[0]
    return { district, floor: group, tab: group, sub: group.subs.length > 1 ? sub : undefined }
  }
  const floor = district.floors.find((f) => owns(pathOf(f.to), p) || !!f.also?.some((a) => owns(a, p))) ?? null
  return { district, floor, tab: floor }
}
/** Kept for older imports. */
export const subtabForPath = floorForPath

/** Index of the floor in its building (0 = top), -1 when the route has no floor. */
export function floorIndex(pathname: string, search = ''): number {
  const { district, floor } = floorForPath(pathname, search)
  return floor ? district.floors.indexOf(floor) : -1
}

/** "Bank / Cash / Budgets", "Gym / Kitchen"; a building without floors is just its name. */
export function breadcrumb(pathname: string, search = ''): string[] {
  const { district, floor, sub } = floorForPath(pathname, search)
  return [district.building, ...(floor ? [floor.label] : []), ...(sub ? [sub.label] : [])]
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
