// Pure: turns this week's real figures into the Life map city. Five districts that read as places (bank towers, a gym with a
// path to goal weight, library and lab, offices, a park with one tree per person), plus roads, traffic lights and quiet outskirts.
// Heights, glow and counts come from real data; poppy beacons only for behind or overdue; gold only for an earned milestone.
import type { ISODate } from '../../db'
import { daysBetween, startOfWeek } from '../../lib/dates'
import { inputLine, type AreaWeek } from '../game/areas'
import type { SkillId } from '../game/types'
import { boundsOf, project, type Bounds, type Pt } from './iso'

export interface PersonTree { id: number; name: string; /** 0..1 ring left before due; null = no cadence */ ring: number | null; overdue: boolean }
export interface WeightPath { start: number; current: number; goal: number }

export interface LifeInput {
  areas: AreaWeek[]
  /** Active days wanted per week. */
  target: number
  today: ISODate
  /** Latest net worth, null when no balances are recorded. */
  netWorth: number | null
  budgetsOver: number
  peopleTotal: number
  peopleOverdue: number
  planLeft: number
  planTotal: number
  /** Areas with a milestone logged this week (gold marker). */
  milestones: SkillId[]
  /** Portfolio value by ticker (holdings with a price). */
  holdings?: { ticker: string; value: number }[]
  weight?: WeightPath | null
  people?: PersonTree[]
  /** Active career goals (projects). */
  projects?: number
}

export type Roof = 'flat' | 'spire' | 'pyramid' | 'crown'
export interface Building {
  /** Back corner in world tiles, footprint in tiles, height in px. */
  x: number; y: number; w: number; d: number; h: number
  lit: boolean
  /** 0..1 emission: edge glow and face tint. */
  e: number
  roof: Roof
  /** Px between window bands; 0 = none. */
  bands: number
  /** Vertical mullions per face (office look). */
  mullions: number
}
export interface Tree { x: number; y: number; id: number; name: string; ring: number | null; overdue: boolean; placeholder?: boolean }
export interface PathStep { x: number; y: number; lit: boolean }
export interface Fact { label: string; value: string }
export interface District {
  id: SkillId
  label: string
  to: string
  /** Back corner of the plinth in world tiles. */
  origin: Pt
  size: number
  buildings: Building[]
  trees: Tree[]
  path: PathStep[]
  /** Body: goal reached (gold flag, earned). */
  pathDone: boolean
  /** 0..1 share of the weekly day target. */
  glow: number
  days: number
  beacon: string | null
  gold: boolean
  facts: Fact[]
  /** One short line for labels. */
  short: string
  /** Screen-space anchor of the district centre at ground and above its tallest building. */
  centre: Pt
  top: Pt
}

export interface Road { x1: number; y1: number; x2: number; y2: number; w: number; main: boolean }
export interface Car { a: Pt; b: Pt; dur: number; delay: number }
export interface Overview { netWorth: string; activeDays: string; toContact: string; planLeft: string }
/** Civic places with no area ring: the town hall (Plan) and home base (You). Quiet, drawn like districts. */
export type CivicId = 'plan' | 'you'
export interface Civic { id: CivicId; label: string; to: string; origin: Pt; size: number; buildings: Building[]; centre: Pt; top: Pt }
export interface LifeMap {
  districts: District[]
  civic: Civic[]
  roads: Road[]
  cars: Car[]
  /** Dim ambient blocks in the outskirts (no data meaning). */
  outskirts: Building[]
  overview: Overview
  empty: boolean
  /** Bounds of the five districts (fit target). */
  bounds: Bounds
  /** Bounds of every place, civic ones included (mini-map and backdrop). */
  cityBounds: Bounds
}

export const PAGES: Record<SkillId, string> = { body: '/body', money: '/finance', mind: '/mind', career: '/career', people: '/people' }
export const MIN_H = 10
export const MAX_H = 200
/** Outskirts and ground extent in tiles. */
export const GROUND = 15
export const MAX_TREES = 12
export const MAX_CARS = 8
export const MAX_OUTSKIRTS = 20
const PATH_STEPS = 9

/** District plinths (back corner, size). Money sits in the middle; the others on the four avenues. */
export const PLOTS: Record<SkillId, { o: Pt; s: number }> = {
  money: { o: { x: -3, y: -3 }, s: 6 },
  body: { o: { x: -11.5, y: -2.5 }, s: 5 },
  career: { o: { x: -2.5, y: -11.5 }, s: 5 },
  mind: { o: { x: 6.5, y: -2.5 }, s: 5 },
  people: { o: { x: -2.5, y: 6.5 }, s: 5 },
}

/** Civic plots on the quiet diagonals: the town hall at the back, home base at the front. */
export const CIVIC_PLOTS: Record<CivicId, { o: Pt; s: number }> = {
  plan: { o: { x: -9.5, y: -9.5 }, s: 4 },
  you: { o: { x: 5.5, y: 5.5 }, s: 4 },
}

export const clamp01 = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0))
/** Square-root curve so a small week still reads, and a full one reaches the cap. */
export const heightFor = (v: number) => Math.round(MIN_H + Math.sqrt(clamp01(v)) * (MAX_H - MIN_H))
/** Count to a 0..1 share with a soft cap (4 a week fills it). */
export const share = (count: number, cap = 4) => clamp01(count / cap)

export function blockHeight(count: number, cap = 4): number {
  return heightFor(share(count, cap) * 0.7)
}

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Net worth on a log scale: $100 is a sliver, $2M fills the tower. */
export const worthScore = (nw: number | null) => (nw === null || nw <= 0 ? 0 : clamp01((Math.log10(nw) - 2) / 4.3))

/** Behind pace: past the middle of the week and more than a day short of an even spread over the target. */
export function behindPace(days: number, target: number, today: ISODate): boolean {
  const elapsed = daysBetween(startOfWeek(today), today) + 1
  return elapsed >= 3 && days < (target * elapsed) / 7 - 1
}

/** 0..1 progress from start weight toward goal (either direction). Null without a weigh-in. */
export function weightProgress(w: WeightPath | null | undefined): number | null {
  if (!w) return null
  const span = w.goal - w.start
  if (Math.abs(span) < 0.1) return Math.abs(w.current - w.goal) < 0.1 ? 1 : 0
  return clamp01((w.current - w.start) / span)
}

/** Tiny deterministic PRNG (mulberry32) so the outskirts never jump between renders. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const count = (a: AreaWeek, kind: string) => a.inputs.find((i) => i.kind === kind)?.count ?? 0
const emission = (lit: boolean, glow: number) => (lit ? 0.62 + 0.38 * glow : 0.16)

/** A building; `quiet` is the height it keeps while unlit, so an idle district still reads as a place. */
function b(x: number, y: number, w: number, d: number, h: number, lit: boolean, glow: number, roof: Roof = 'flat', bands = 0, mullions = 0, quiet = 0): Building {
  return { x, y, w, d, h: lit ? h : Math.max(h, quiet), lit, e: emission(lit, glow), roof, bands, mullions }
}

function moneyBuildings(a: AreaWeek, inp: LifeInput): Building[] {
  const { x: ox, y: oy } = PLOTS.money.o
  const g = a.value
  const worth = worthScore(inp.netWorth)
  const mainV = Math.max(worth * 0.75 + g * 0.25, g * 0.6)
  const main = heightFor(mainV)
  const out: Building[] = [b(ox + 2.3, oy + 2.3, 1.5, 1.5, main, mainV > 0, g, 'spire', 11, 0, 64)]
  const slots: [number, number][] = [[0.6, 2.4], [2.4, 0.6], [4.0, 2.4], [2.4, 4.0]]
  const hs = (inp.holdings ?? []).filter((h) => h.value > 0).sort((p, q) => q.value - p.value).slice(0, 4)
  const total = hs.reduce((s, h) => s + h.value, 0)
  slots.forEach(([sx, sy], i) => {
    let v: number
    if (hs.length) v = hs[i] ? Math.max(0.18, (hs[i].value / total) * 0.9) * Math.max(mainV, 0.35) : 0
    else {
      const ins = [...a.inputs].sort((p, q) => q.count - p.count)
      v = share(ins[i]?.count ?? 0) * 0.6
    }
    out.push(b(ox + sx, oy + sy, 1.1, 1.1, heightFor(v * 0.85), v > 0, g, i % 2 ? 'flat' : 'crown', 9, 0, 30 + i * 6))
  })
  // Low podiums on the corners: the bank's base.
  out.push(b(ox + 0.5, oy + 0.5, 1.5, 1.5, 14, worth > 0, g * 0.6, 'flat', 0))
  out.push(b(ox + 4.0, oy + 4.0, 1.5, 1.5, 12, worth > 0, g * 0.6, 'flat', 0))
  return out
}

function bodyBuildings(a: AreaWeek): Building[] {
  const { x: ox, y: oy } = PLOTS.body.o
  const g = a.value
  return [
    b(ox + 0.5, oy + 0.5, 1.7, 1.7, heightFor(g), g > 0, g, 'crown', 10, 0, 56),
    b(ox + 2.6, oy + 0.6, 1.4, 1.0, blockHeight(count(a, 'workout') + count(a, 'weigh-in')), count(a, 'workout') + count(a, 'weigh-in') > 0, g, 'flat', 8, 0, 22),
    b(ox + 0.6, oy + 2.6, 1.0, 1.3, blockHeight(count(a, 'meal') + count(a, 'calories-met') + count(a, 'protein-met')), count(a, 'meal') > 0, g, 'flat', 8, 0, 18),
  ]
}

/** Path from the gym door toward goal weight: an L along the plinth, lit up to the share already covered. */
function bodyPath(w: WeightPath | null | undefined): { steps: PathStep[]; done: boolean } {
  const { x: ox, y: oy } = PLOTS.body.o
  const p = weightProgress(w)
  const lit = p === null ? 0 : Math.round(p * PATH_STEPS)
  const pts: Pt[] = []
  for (let i = 0; i < PATH_STEPS; i++) {
    pts.push(i < 5 ? { x: ox + 2.4 + i * 0.52, y: oy + 2.7 } : { x: ox + 2.4 + 4 * 0.52, y: oy + 2.7 + (i - 4) * 0.52 })
  }
  return { steps: pts.map((q, i) => ({ ...q, lit: i < lit })), done: p !== null && p >= 1 }
}

function mindBuildings(a: AreaWeek): Building[] {
  const { x: ox, y: oy } = PLOTS.mind.o
  const g = a.value
  const j = count(a, 'journal'), l = count(a, 'learning'), f = count(a, 'focus')
  return [
    // Library: wide, low, many floors.
    b(ox + 0.5, oy + 0.5, 2.4, 1.3, blockHeight(j), j > 0, g, 'flat', 7, 0, 26),
    b(ox + 0.5, oy + 2.1, 1.3, 2.2, blockHeight(Math.max(0, j - 2)), j > 2, g, 'flat', 7, 0, 20),
    // Lab: taller blocks with pitched roofs.
    b(ox + 3.2, oy + 0.6, 1.2, 1.2, blockHeight(l), l > 0, g, 'pyramid', 10, 0, 34),
    b(ox + 2.3, oy + 2.7, 1.1, 1.1, blockHeight(f + Math.max(0, l - 2)), f > 0, g, 'pyramid', 10, 0, 24),
  ]
}

function careerBuildings(a: AreaWeek, projects: number): Building[] {
  const { x: ox, y: oy } = PLOTS.career.o
  const g = a.value
  const wins = count(a, 'win')
  const other = a.total - wins
  const out: Building[] = []
  const grid: [number, number][] = [[0.5, 0.5], [1.9, 0.5], [3.3, 0.5], [0.5, 1.9], [1.9, 1.9], [3.3, 1.9], [0.5, 3.3], [1.9, 3.3]]
  grid.forEach(([sx, sy], i) => {
    let v = 0, lit = false
    if (i < Math.min(4, wins)) { v = 0.35 + 0.15 * Math.min(4, wins); lit = true }
    else if (i >= 4 && i < 4 + Math.min(2, projects)) { v = 0.3; lit = true }
    else if (i === 6 && other > 0) { v = share(other) * 0.5; lit = true }
    out.push(b(ox + sx, oy + sy, 1.05, 1.05, heightFor(v * (1 - i * 0.04)), lit, g, i === 0 && lit ? 'spire' : 'flat', 0, lit ? 3 : 2, [44, 30, 22, 36, 26, 18, 24, 16][i]))
  })
  return out
}

function parkTrees(people: PersonTree[] | undefined): Tree[] {
  const { x: ox, y: oy } = PLOTS.people.o
  const list = (people ?? []).slice(0, MAX_TREES)
  const r = rng(7)
  const cols = 4
  if (!list.length) {
    return [[1.4, 1.6], [3.0, 2.4], [2.0, 3.6]].map(([x, y], i) => ({ x: ox + x, y: oy + y, id: -1 - i, name: '', ring: null, overdue: false, placeholder: true }))
  }
  return list.map((p, i) => {
    const cx = i % cols, cy = Math.floor(i / cols)
    return { x: ox + 0.85 + cx * 1.12 + (r() - 0.5) * 0.3, y: oy + 0.9 + cy * 1.35 + (r() - 0.5) * 0.3, id: p.id, name: p.name, ring: p.ring, overdue: p.overdue }
  })
}

/** Avenues: ring around Money, four spokes to the districts, and outer streets that run off into the fog. */
export function buildRoads(): Road[] {
  const R = 4, E = GROUND - 0.5, w = 0.7
  return [
    { x1: -R, y1: -R, x2: R, y2: -R, w, main: true }, { x1: -R, y1: R, x2: R, y2: R, w, main: true },
    { x1: -R, y1: -R, x2: -R, y2: R, w, main: true }, { x1: R, y1: -R, x2: R, y2: R, w, main: true },
    { x1: R, y1: 0, x2: 6.5, y2: 0, w, main: true }, { x1: -R, y1: 0, x2: -6.5, y2: 0, w, main: true },
    { x1: 0, y1: R, x2: 0, y2: 6.5, w, main: true }, { x1: 0, y1: -R, x2: 0, y2: -6.5, w, main: true },
    { x1: R, y1: R, x2: E, y2: R, w: 0.5, main: false }, { x1: -R, y1: -R, x2: -E, y2: -R, w: 0.5, main: false },
    { x1: R, y1: R, x2: R, y2: E, w: 0.5, main: false }, { x1: -R, y1: -R, x2: -R, y2: -E, w: 0.5, main: false },
    { x1: R, y1: -R, x2: E, y2: -R, w: 0.5, main: false }, { x1: -R, y1: R, x2: -R, y2: E, w: 0.5, main: false },
    { x1: R, y1: -R, x2: R, y2: -E, w: 0.5, main: false }, { x1: -R, y1: R, x2: -E, y2: R, w: 0.5, main: false },
  ]
}

/** A few slow lights on the main avenues; more traffic when more happened this week. */
export function buildCars(roads: Road[], activity: number): Car[] {
  const main = roads.filter((r) => r.main)
  const n = Math.min(MAX_CARS, 3 + Math.round(clamp01(activity) * 5))
  return Array.from({ length: n }, (_, i) => {
    const r = main[(i * 3) % main.length]
    const fwd = i % 2 === 0
    const a = project(fwd ? r.x1 : r.x2, fwd ? r.y1 : r.y2), z = project(fwd ? r.x2 : r.x1, fwd ? r.y2 : r.y1)
    const len = Math.hypot(z.x - a.x, z.y - a.y)
    return { a, b: z, dur: Math.round(Math.max(6, len / 22) * 10) / 10, delay: -((i * 2.3) % 9) }
  })
}

/** Dim filler blocks in the four corner quarters so the five districts sit inside a city, not on an empty board. */
export function buildOutskirts(): Building[] {
  const r = rng(42)
  const out: Building[] = []
  const quads: [number, number][] = [[1, 1], [-1, -1], [1, -1], [-1, 1]]
  for (const [qx, qy] of quads) {
    for (let i = 0; i < MAX_OUTSKIRTS / 4; i++) {
      const gx = 5 + (i % 3) * 2.6 + r() * 0.6
      const gy = 5 + Math.floor(i / 3) * 2.6 + r() * 0.6
      const w = 0.8 + r() * 1.1, d = 0.8 + r() * 1.1
      const x = qx > 0 ? gx : -gx - w
      const y = qy > 0 ? gy : -gy - d
      out.push({ x, y, w, d, h: Math.round(8 + r() * 34), lit: false, e: 0.1 + r() * 0.08, roof: 'flat', bands: 0, mullions: 0 })
    }
  }
  return out
}

/** Town hall (lit by today's plan done share) and home base (a low house, always softly lit). */
export function buildCivic(planDone: number): Civic[] {
  const g = clamp01(planDone)
  const hall = CIVIC_PLOTS.plan, home = CIVIC_PLOTS.you
  const sites: { id: CivicId; label: string; to: string; plot: { o: Pt; s: number }; buildings: Building[] }[] = [
    {
      id: 'plan', label: 'Plan', to: '/today', plot: hall,
      buildings: [
        b(hall.o.x + 0.5, hall.o.y + 0.5, 3, 1.6, 26, g > 0, g, 'flat', 9, 0, 26),
        b(hall.o.x + 1.4, hall.o.y + 1.4, 1.2, 1.2, 58, g > 0, g, 'spire', 12, 0, 58),
        b(hall.o.x + 0.5, hall.o.y + 2.5, 1.4, 1, 18, g >= 1, g, 'pyramid', 0, 0, 18),
      ],
    },
    {
      id: 'you', label: 'You', to: '/you', plot: home,
      buildings: [
        b(home.o.x + 0.8, home.o.y + 0.8, 1.6, 1.4, 22, true, 0.35, 'pyramid', 0, 0, 22),
        b(home.o.x + 2.6, home.o.y + 1.0, 0.9, 1.1, 14, false, 0, 'pyramid', 0, 0, 14),
      ],
    },
  ]
  return sites.map(({ id, label, to, plot, buildings }) => {
    const tallest = Math.max(...buildings.map((x) => x.h + (x.roof === 'spire' ? 26 : x.roof === 'pyramid' ? 14 : 0)))
    const c = { x: plot.o.x + plot.s / 2, y: plot.o.y + plot.s / 2 }
    return { id, label, to, origin: plot.o, size: plot.s, buildings, centre: project(c.x, c.y, 0), top: project(c.x, c.y, tallest) }
  })
}

/** Outskirt blocks that would sit on a civic plot are left out. */
const offCivic = (q: Building) => Object.values(CIVIC_PLOTS).every(({ o, s }) => q.x + q.w < o.x - 0.3 || q.x > o.x + s + 0.3 || q.y + q.d < o.y - 0.3 || q.y > o.y + s + 0.3)

type Place = Pick<District, 'origin' | 'size' | 'centre' | 'top'>
const corners = (d: Place, lift: number) => [
  project(d.origin.x, d.origin.y), project(d.origin.x + d.size, d.origin.y), project(d.origin.x, d.origin.y + d.size),
  project(d.origin.x + d.size, d.origin.y + d.size), { x: d.centre.x, y: d.top.y - lift },
]

/** Fit bounds of the five districts, and of every place (civic ones too). Shared by the model and its rotations. */
export function placeBounds(districts: Place[], civic: Place[]): { bounds: Bounds; cityBounds: Bounds } {
  const ds = districts.flatMap((d) => corners(d, 30))
  return { bounds: boundsOf(ds), cityBounds: boundsOf([...ds, ...civic.flatMap((c) => corners(c, 20))]) }
}

export function buildLifeMap(inp: LifeInput): LifeMap {
  const total = inp.areas.reduce((a, x) => a + x.total, 0)
  const empty = total === 0 && inp.netWorth === null && inp.peopleTotal === 0
  const districts: District[] = inp.areas.map((a) => {
    const { o, s } = PLOTS[a.id]
    const days = Math.min(a.days, inp.target)
    let buildings: Building[] = [], trees: Tree[] = [], path: PathStep[] = [], pathDone = false
    if (a.id === 'money') buildings = moneyBuildings(a, inp)
    else if (a.id === 'body') { buildings = bodyBuildings(a); const p = bodyPath(inp.weight); path = p.steps; pathDone = p.done }
    else if (a.id === 'mind') buildings = mindBuildings(a)
    else if (a.id === 'career') buildings = careerBuildings(a, inp.projects ?? 0)
    else trees = parkTrees(inp.people)
    const tallest = Math.max(trees.length ? 64 : 0, ...buildings.map((x) => x.h + (x.roof === 'spire' ? 26 : x.roof === 'pyramid' ? 14 : 0)))
    let beacon: string | null = null
    const facts: Fact[] = [{ label: 'Active days', value: `${days} of ${inp.target}` }]
    if (a.id === 'money') {
      facts.unshift({ label: 'Net worth', value: inp.netWorth === null ? 'No balances yet' : money(inp.netWorth) })
      facts.push({ label: 'Budgets over', value: String(inp.budgetsOver) })
      if (inp.budgetsOver > 0) beacon = `${plural(inp.budgetsOver, 'budget')} over this month`
    } else if (a.id === 'people') {
      facts.unshift({ label: 'To contact', value: String(inp.peopleOverdue) }, { label: 'People tracked', value: String(inp.peopleTotal) })
      if (inp.peopleOverdue > 0) beacon = `${plural(inp.peopleOverdue, 'person', 'people')} due for contact`
    } else if (a.id === 'body' && inp.weight) {
      facts.unshift({ label: 'Weight', value: `${inp.weight.current} lb, goal ${inp.weight.goal}` })
    }
    if (!beacon && total > 0 && behindPace(a.days, inp.target, inp.today)) beacon = `Behind pace: ${days} of ${inp.target} days`
    facts.push({ label: 'This week', value: inputLine(a, 3) })
    const short = a.id === 'money'
      ? (inp.netWorth === null ? `${days} of ${inp.target} days` : money(inp.netWorth))
      : a.id === 'people' ? `${inp.peopleOverdue} to contact` : `${days} of ${inp.target} days`
    return {
      id: a.id, label: a.label, to: PAGES[a.id], origin: o, size: s, buildings, trees, path, pathDone,
      glow: a.value, days, beacon, gold: inp.milestones.includes(a.id), facts, short,
      centre: project(o.x + s / 2, o.y + s / 2, 0),
      top: project(o.x + s / 2, o.y + s / 2, tallest),
    }
  })
  const active = inp.areas.reduce((a, x) => a + Math.min(x.days, inp.target), 0)
  const roads = buildRoads()
  const activity = inp.areas.length ? inp.areas.reduce((a, x) => a + x.value, 0) / inp.areas.length : 0
  const civic = buildCivic(inp.planTotal ? (inp.planTotal - inp.planLeft) / inp.planTotal : 0)
  return {
    districts,
    civic,
    roads,
    cars: buildCars(roads, activity),
    outskirts: buildOutskirts().filter(offCivic),
    empty,
    ...placeBounds(districts, civic),
    overview: {
      netWorth: inp.netWorth === null ? 'None yet' : money(inp.netWorth),
      activeDays: `${active} of ${inp.target * inp.areas.length}`,
      toContact: String(inp.peopleOverdue),
      planLeft: inp.planTotal ? `${inp.planLeft} of ${inp.planTotal}` : 'None',
    },
  }
}
