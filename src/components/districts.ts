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

/** Bank floors (B3), top to bottom. Each is its own route; heavy screens open as a view on their floor (`?view=`). */
export const MONEY_FLOORS: Floor[] = [
  { id: 'lobby', to: '/finance', label: 'Lobby', icon: 'home' },
  { id: 'vault', to: '/finance/vault', label: 'Vault', icon: 'data' },
  { id: 'trading', to: '/finance/trading', label: 'Trading floor', icon: 'finance' },
  { id: 'academy', to: '/finance/academy', label: 'Academy', icon: 'learning' },
  { id: 'archive', to: '/finance/archive', label: 'Archive', icon: 'history' },
]
/** Old Money `?tab=` ids (and the old group ids) and where they live now. Search deep links keep `focus` and `month`. */
export const MONEY_TABS: Record<string, string> = {
  overview: '/finance', wealth: '/finance',
  budgets: '/finance/vault',
  markets: '/finance/trading', investments: '/finance/trading?view=holdings',
  academy: '/finance/academy', learn: '/finance/academy', practice: '/finance/academy?view=practice',
  cash: '/finance/archive', transactions: '/finance/archive', import: '/finance/archive?view=import', networth: '/finance/archive?view=networth',
}
/** Where an old `/finance?tab=x...` URL goes now (null when it has no known tab): the floor path, its view, the other params kept. */
export function moneyTabTarget(search: string): string | null {
  const q = new URLSearchParams(search)
  const to = MONEY_TABS[q.get('tab') ?? '']
  if (!to) return null
  q.delete('tab')
  const [path, own] = to.split('?')
  const out = new URLSearchParams(own)
  q.forEach((v, k) => { if (!out.has(k)) out.set(k, v) })
  const rest = out.toString()
  return rest ? `${path}?${rest}` : path
}

export const DISTRICTS: Record<DistrictId, DistrictDef> = {
  home: { id: 'home', label: 'Home', building: 'City', to: '/', icon: 'home', routes: ['/', '/map'], floors: [] },
  plan: {
    id: 'plan', label: 'Plan', building: 'Town hall', to: '/today', icon: 'planner',
    routes: ['/today', '/plan', '/tasks', '/planner', '/goals', '/habits'],
    floors: [
      { id: 'today', to: '/today', label: 'Today', icon: 'today' },
      { id: 'tasks', to: '/tasks', label: 'Tasks', icon: 'tasks' }, { id: 'planner', to: '/planner', label: 'Planner', icon: 'calendar' },
      { id: 'goals', to: '/goals', label: 'Goals', icon: 'goals' }, { id: 'habits', to: '/habits', label: 'Habits', icon: 'habits' },
    ],
  },
  money: { id: 'money', label: 'Money', building: 'Bank', to: '/finance', icon: 'finance', skill: 'money', routes: ['/finance'], floors: MONEY_FLOORS, elevator: true },
  body: {
    id: 'body', label: 'Body', building: 'Gym', to: '/body', icon: 'body', skill: 'body', routes: ['/body', '/food', '/training'],
    floors: [
      { id: 'weigh-in', to: '/body', label: 'Weigh-in', icon: 'weight' },
      { id: 'kitchen', to: '/food', label: 'Kitchen', icon: 'food' },
      { id: 'training', to: '/training', label: 'Training', icon: 'body' },
    ],
  },
  mind: {
    id: 'mind', label: 'Mind', building: 'Library', to: '/journal', icon: 'mind', skill: 'mind', routes: ['/journal', '/learning'],
    floors: [
      { id: 'journal', to: '/journal', label: 'Journal', icon: 'journal' },
      { id: 'study', to: '/learning', label: 'Study', icon: 'learning' },
    ],
  },
  career: {
    id: 'career', label: 'Career', building: 'Office', to: '/career', icon: 'career', skill: 'career', routes: ['/career', '/case', '/projects'],
    floors: [
      { id: 'wins', to: '/career', label: 'Wins', icon: 'career' },
      { id: 'case', to: '/case', label: 'Case', icon: 'goals' },
      { id: 'projects', to: '/projects', label: 'Projects', icon: 'tasks' },
    ],
  },
  people: {
    id: 'people', label: 'People', building: 'Park', to: '/people', icon: 'people', skill: 'people', routes: ['/people', '/reach-out'],
    floors: [
      { id: 'tree', to: '/people', label: 'Tree', icon: 'people' },
      { id: 'reach-out', to: '/reach-out', label: 'Reach out', icon: 'capture' },
    ],
  },
  you: {
    id: 'you', label: 'You', building: 'Home base', to: '/score', icon: 'user',
    routes: ['/score', '/history', '/review', '/settings', '/ops', '/data', '/ontology', '/interview', '/style'],
    floors: [
      { id: 'scoreboard', to: '/score', label: 'Scoreboard', icon: 'trophy' },
      { id: 'milestones', to: '/history', label: 'Milestones', icon: 'history' },
      { id: 'season', to: '/review', label: 'Season', icon: 'review' },
      { id: 'settings', to: '/settings', label: 'Settings', icon: 'settings', also: ['/ops', '/data', '/ontology', '/interview', '/style'] },
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
  '/mind': '/journal',
  '/plan': '/today',
  '/bank': '/finance',
  '/money': '/finance',
  '/budgets': '/finance/vault',
  '/markets': '/finance/trading',
  '/transactions': '/finance/archive',
  '/you': '/score',
  '/skills': '/',
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

/** Building and floor for a pathname (plus the query string: an old Money `?tab=` picks its Bank floor). */
export function floorForPath(pathname: string, search = ''): Location {
  let p = resolve(pathname)
  if (p === '/finance') { const to = moneyTabTarget(search); if (to) p = pathOf(to) }
  const district = DISTRICTS[districtForPath(p)]
  // The longest matching floor path wins, so /finance/vault is the Vault, not the Lobby at /finance.
  let floor: Floor | null = null
  let best = -1
  for (const f of district.floors) {
    for (const r of [pathOf(f.to), ...(f.also ?? [])]) if (owns(r, p) && r.length > best) { floor = f; best = r.length }
  }
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
