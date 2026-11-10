// Pure maths for the People tree: grouping by relation, contact-health ring fraction, branch layout and keyboard
// navigation. No React, no DB. Poppy is only ever for overdue; people without a cadence get a neutral ring.
import type { ISODate, Person } from '../../db'
import { personStatus, sortPeople } from './people'

export interface BranchDef { key: string; label: string; /** value pre-filled when adding to this branch */ relation: string }
export interface Branch extends BranchDef { people: Person[] }

const CANON: { key: string; label: string; relation: string; words: string[] }[] = [
  { key: 'family', label: 'Family', relation: 'Family', words: ['family', 'mom', 'mother', 'dad', 'father', 'parent', 'parents', 'sister', 'brother', 'sibling', 'cousin', 'aunt', 'uncle', 'grandma', 'grandmother', 'grandpa', 'grandfather', 'grandparent', 'son', 'daughter', 'child', 'kid', 'niece', 'nephew', 'in-law', 'relative'] },
  { key: 'partner', label: 'Partner', relation: 'Partner', words: ['partner', 'spouse', 'wife', 'husband', 'girlfriend', 'boyfriend', 'fiance', 'fiancee'] },
  { key: 'friends', label: 'Friends', relation: 'Friend', words: ['friend', 'friends', 'roommate', 'neighbor', 'neighbour'] },
  { key: 'colleagues', label: 'Colleagues', relation: 'Colleague', words: ['colleague', 'colleagues', 'coworker', 'co-worker', 'coworkers', 'work', 'boss', 'manager', 'teammate', 'client'] },
  { key: 'mentors', label: 'Mentors', relation: 'Mentor', words: ['mentor', 'mentors', 'coach', 'teacher', 'advisor', 'adviser', 'mentee'] },
]
export const OTHER: BranchDef = { key: 'other', label: 'Other', relation: '' }
export const MAX_BRANCHES = 7

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

/** Map a free-text relation to a branch. Known words (and "my sister", "close friend") fold into the standard branches; anything else keeps its own name; blank = Other. */
export function branchFor(relation: string): BranchDef {
  const r = norm(relation)
  if (!r) return OTHER
  for (const c of CANON) {
    if (c.words.includes(r) || r.split(/[\s/,&]+/).some((w) => c.words.includes(w))) return { key: c.key, label: c.label, relation: c.relation }
  }
  const label = r.charAt(0).toUpperCase() + r.slice(1)
  return { key: `x:${r}`, label, relation: relation.trim() }
}

/**
 * Group people into branches. Standard branches come first in a fixed order, custom ones by size then name; when there are
 * more than `max` branches the smallest custom ones are merged into Other. People inside a branch are sorted by name.
 */
export function groupByRelation(people: Person[], max = MAX_BRANCHES): Branch[] {
  const map = new Map<string, Branch>()
  for (const p of people) {
    const b = branchFor(p.relation)
    const cur = map.get(b.key)
    if (cur) cur.people.push(p)
    else map.set(b.key, { ...b, people: [p] })
  }
  const order = (b: Branch) => { const i = CANON.findIndex((c) => c.key === b.key); return i >= 0 ? i : 100 }
  const rest = [...map.values()].filter((b) => b.key !== 'other').sort((a, b) => order(a) - order(b) || b.people.length - a.people.length || a.label.localeCompare(b.label))
  let other = map.get('other')
  let keep = rest
  if (rest.length + (other ? 1 : 0) > max) {
    keep = rest.slice(0, max - 1)
    const spill = rest.slice(max - 1).flatMap((b) => b.people)
    other = { ...OTHER, people: [...(other?.people ?? []), ...spill] }
  }
  const list = other ? [...keep, other] : keep
  for (const b of list) b.people.sort((a, c) => a.name.localeCompare(c.name))
  return list
}

export interface Ring { /** 0..1 of the ring that is full; null = no cadence (neutral) */ fraction: number | null; overdue: boolean }

/** Full right after contact, draining to empty on the due date. Overdue = empty fraction, poppy. No cadence = neutral. */
export function ringFraction(p: Pick<Person, 'cadenceDays' | 'lastContact'>, now: ISODate): Ring {
  const s = personStatus(p as Person, now)
  if (s.dueIn === null) return { fraction: null, overdue: false }
  if (s.dueIn <= 0) return { fraction: 0, overdue: true }
  return { fraction: Math.min(1, Math.max(0, s.dueIn / p.cadenceDays)), overdue: false }
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

/** Who to reach out to: overdue first (most overdue first), then due within a week; at most `max`. */
export function reachSoon(people: Person[], now: ISODate, max = 5) {
  return sortPeople(people.filter((p) => p.cadenceDays > 0), now).filter((x) => x.s.dueIn !== null && x.s.dueIn <= 7).slice(0, max)
}

export interface LayoutOpts { perRow?: number; colW?: number; rowH?: number; trunk?: number; twig?: number; gap?: number }
export interface TNode { key: string; kind: 'root' | 'branch' | 'person' | 'add'; x: number; y: number; branch?: string; personId?: number; path?: string }
export interface TreeLayout { nodes: TNode[]; bounds: { x: number; y: number; w: number; h: number } }

const curve = (ax: number, ay: number, bx: number, by: number) => {
  const dx = Math.max(24, (bx - ax) * 0.55)
  return `M${ax} ${ay}C${ax + dx} ${ay} ${bx - dx} ${by} ${bx} ${by}`
}

/** Left-to-right tree: root, one branch node per relation, leaves in rows of `perRow` (the last slot of an open branch is the add node). */
export function layoutTree(branches: Branch[], collapsed: ReadonlySet<string>, o: LayoutOpts = {}): TreeLayout {
  const perRow = Math.max(1, o.perRow ?? 6), colW = o.colW ?? 84, rowH = o.rowH ?? 92, trunk = o.trunk ?? 130, twig = o.twig ?? 110, gap = o.gap ?? 34
  const nodes: TNode[] = []
  const bx = trunk
  let top = 0
  const blocks: { b: Branch; top: number; h: number }[] = []
  for (const b of branches) {
    const slots = collapsed.has(b.key) ? 0 : b.people.length + 1
    const h = Math.max(1, Math.ceil(slots / perRow)) * rowH
    blocks.push({ b, top, h })
    top += h + gap
  }
  const total = Math.max(0, top - gap)
  const off = -total / 2
  nodes.push({ key: 'root', kind: 'root', x: 0, y: 0 })
  let maxX = bx
  for (const { b, top: t, h } of blocks) {
    const by = off + t + Math.min(h, rowH) / 2
    nodes.push({ key: `b:${b.key}`, kind: 'branch', x: bx, y: by, branch: b.key, path: curve(0, 0, bx, by) })
    if (collapsed.has(b.key)) continue
    const items: { key: string; kind: 'person' | 'add'; id?: number }[] = [...b.people.map((p) => ({ key: `p:${p.id}`, kind: 'person' as const, id: p.id })), { key: `a:${b.key}`, kind: 'add' as const }]
    items.forEach((it, i) => {
      const col = i % perRow, row = Math.floor(i / perRow)
      const x = bx + twig + col * colW, y = off + t + row * rowH + rowH / 2
      const px = col === 0 ? bx : x - colW
      const py = col === 0 ? by : y
      maxX = Math.max(maxX, x)
      nodes.push({ key: it.key, kind: it.kind, x, y, branch: b.key, personId: it.id, path: curve(px, py, x, y) })
    })
  }
  const pad = 56
  return { nodes, bounds: { x: -pad, y: off - pad, w: maxX + pad * 2 + 20, h: total + pad * 2 } }
}

export type Dir = 'left' | 'right' | 'up' | 'down'

/** Next focusable node in an arrow direction (nearest along the axis, penalising sideways drift). Stays put at an edge. */
export function navigate(nodes: Pick<TNode, 'key' | 'x' | 'y' | 'kind'>[], from: string, dir: Dir): string {
  const cur = nodes.find((n) => n.key === from)
  if (!cur) return from
  let best = from, bestScore = Infinity
  for (const n of nodes) {
    if (n.key === from || n.kind === 'root') continue
    const dx = n.x - cur.x, dy = n.y - cur.y
    const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : -dy
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (along < 8) continue
    const score = along + across * 2.5
    if (score < bestScore) { best = n.key; bestScore = score }
  }
  return best
}

/** Scale and offset to fit `bounds` in a viewport; scale is clamped so a long tree stays legible (then it aligns to the top-left and pans). */
export function fitView(bounds: TreeLayout['bounds'], vw: number, vh: number, minScale = 0.55, maxScale = 1.35) {
  const raw = Math.min(vw / bounds.w, vh / bounds.h)
  const k = Math.min(maxScale, Math.max(minScale, raw))
  const fitsX = bounds.w * k <= vw, fitsY = bounds.h * k <= vh
  const x = fitsX ? (vw - bounds.w * k) / 2 - bounds.x * k : -bounds.x * k
  const y = fitsY ? (vh - bounds.h * k) / 2 - bounds.y * k : -bounds.y * k
  return { k, x, y }
}
