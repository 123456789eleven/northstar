// Pure: turns this week's real figures into the five districts of the Life map (block heights, glow, beacons, panel facts).
import type { ISODate } from '../../db'
import { daysBetween, startOfWeek } from '../../lib/dates'
import { inputLine, type AreaWeek } from '../game/areas'
import type { SkillId } from '../game/types'
import { boundsOf, project, type Bounds, type Pt } from './iso'

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
}

export interface Block { x: number; y: number; w: number; d: number; h: number; lit: boolean }
export interface Fact { label: string; value: string }
export interface District {
  id: SkillId
  label: string
  to: string
  /** Back corner of the plinth in world tiles. */
  origin: Pt
  size: number
  blocks: Block[]
  /** 0..1 share of the weekly day target. */
  glow: number
  days: number
  beacon: string | null
  gold: boolean
  facts: Fact[]
  /** One short line for tabs and labels. */
  short: string
  /** Screen-space anchor of the district centre at ground and at its tallest block. */
  centre: Pt
  top: Pt
}

export interface Overview { netWorth: string; activeDays: string; toContact: string; planLeft: string }
export interface LifeMap { districts: District[]; overview: Overview; empty: boolean; bounds: Bounds }

export const PAGES: Record<SkillId, string> = { body: '/body', money: '/finance', mind: '/mind', career: '/career', people: '/people' }
export const PLINTH = 4.2
export const MIN_H = 8
export const MAX_H = 96

/** Plinth origins in world tiles. Screen layout: money in the middle, the other four around it. */
const ORIGINS: Record<SkillId, Pt> = {
  money: { x: -2.1, y: -2.1 },
  mind: { x: -6.8, y: 0.8 },
  career: { x: 0.8, y: -6.8 },
  body: { x: -1.8, y: 4.4 },
  people: { x: 4.4, y: -1.8 },
}

/** Slot grid inside a plinth, tallest slot first (centre outwards). */
const SLOTS: [number, number][] = [[1, 1], [0, 1], [1, 0], [2, 1], [1, 2], [2, 2], [0, 0]]

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

export function blockHeight(count: number, cap = 4): number {
  return Math.round(MIN_H + clamp01(count / cap) * (MAX_H * 0.82 - MIN_H))
}

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

function buildBlocks(area: AreaWeek): Block[] {
  const inputs = [...area.inputs].sort((a, b) => b.count - a.count)
  return SLOTS.map(([sx, sy], i) => {
    const count = i === 0 ? 0 : (inputs[i - 1]?.count ?? 0)
    const h = i === 0 ? Math.round(MIN_H + area.value * (MAX_H - MIN_H)) : blockHeight(count)
    return { x: sx * 1.3 + 0.2, y: sy * 1.3 + 0.2, w: 0.95, d: 0.95, h, lit: i === 0 ? area.value > 0 : count > 0 }
  })
}

/** Behind pace: past the middle of the week and more than a day short of an even spread over the target. */
export function behindPace(days: number, target: number, today: ISODate): boolean {
  const elapsed = daysBetween(startOfWeek(today), today) + 1
  return elapsed >= 3 && days < (target * elapsed) / 7 - 1
}

export function buildLifeMap(inp: LifeInput): LifeMap {
  const total = inp.areas.reduce((a, x) => a + x.total, 0)
  const empty = total === 0 && inp.netWorth === null && inp.peopleTotal === 0
  const districts: District[] = inp.areas.map((a) => {
    const o = ORIGINS[a.id]
    const blocks = buildBlocks(a)
    const days = Math.min(a.days, inp.target)
    const tallest = Math.max(...blocks.map((b) => b.h))
    let beacon: string | null = null
    const facts: Fact[] = [{ label: 'Active days', value: `${days} of ${inp.target}` }]
    if (a.id === 'money') {
      facts.unshift({ label: 'Net worth', value: inp.netWorth === null ? 'No balances yet' : money(inp.netWorth) })
      facts.push({ label: 'Budgets over', value: String(inp.budgetsOver) })
      if (inp.budgetsOver > 0) beacon = `${plural(inp.budgetsOver, 'budget')} over this month`
    } else if (a.id === 'people') {
      facts.unshift({ label: 'To contact', value: String(inp.peopleOverdue) }, { label: 'People tracked', value: String(inp.peopleTotal) })
      if (inp.peopleOverdue > 0) beacon = `${plural(inp.peopleOverdue, 'person', 'people')} due for contact`
    }
    if (!beacon && total > 0 && behindPace(a.days, inp.target, inp.today)) beacon = `Behind pace: ${days} of ${inp.target} days`
    facts.push({ label: 'This week', value: inputLine(a, 3) })
    const short = a.id === 'money'
      ? (inp.netWorth === null ? `${days} of ${inp.target} days` : money(inp.netWorth))
      : a.id === 'people' ? `${inp.peopleOverdue} to contact` : `${days} of ${inp.target} days`
    return {
      id: a.id, label: a.label, to: PAGES[a.id], origin: o, size: PLINTH, blocks,
      glow: a.value, days, beacon, gold: inp.milestones.includes(a.id), facts, short,
      centre: project(o.x + PLINTH / 2, o.y + PLINTH / 2, 0),
      top: project(o.x + PLINTH / 2, o.y + PLINTH / 2, tallest),
    }
  })
  const corners = districts.flatMap((d) => [
    project(d.origin.x, d.origin.y), project(d.origin.x + d.size, d.origin.y), project(d.origin.x, d.origin.y + d.size),
    project(d.origin.x + d.size, d.origin.y + d.size), { x: d.centre.x, y: d.top.y - 40 },
  ])
  const active = inp.areas.reduce((a, x) => a + Math.min(x.days, inp.target), 0)
  return {
    districts,
    empty,
    bounds: boundsOf(corners),
    overview: {
      netWorth: inp.netWorth === null ? 'None yet' : money(inp.netWorth),
      activeDays: `${active} of ${inp.target * inp.areas.length}`,
      toContact: String(inp.peopleOverdue),
      planLeft: inp.planTotal ? `${inp.planLeft} of ${inp.planTotal}` : 'None',
    },
  }
}
