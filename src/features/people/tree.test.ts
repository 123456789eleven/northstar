import { describe, expect, it } from 'vitest'
import type { Person } from '../../db'
import { branchFor, fitView, groupByRelation, layoutTree, navigate, reachSoon, ringFraction } from './tree'

const NOW = '2026-11-02'
const P = (id: number, name: string, relation = '', cadenceDays = 0, lastContact?: string): Person => ({ id, name, relation, cadenceDays, lastContact }) as Person

describe('branchFor', () => {
  it('folds known words into standard branches and keeps unknown ones', () => {
    expect(branchFor('Sister').key).toBe('family')
    expect(branchFor('close friend').key).toBe('friends')
    expect(branchFor('Co-worker').key).toBe('colleagues')
    expect(branchFor('').key).toBe('other')
    expect(branchFor('Book club')).toMatchObject({ key: 'x:book club', label: 'Book club' })
  })
})

describe('groupByRelation', () => {
  it('orders standard branches first and sorts people by name', () => {
    const g = groupByRelation([P(1, 'Zed', 'friend'), P(2, 'Amy', 'Friend'), P(3, 'Bo', 'mom'), P(4, 'Cy', '')])
    expect(g.map((b) => b.key)).toEqual(['family', 'friends', 'other'])
    expect(g[1].people.map((p) => p.name)).toEqual(['Amy', 'Zed'])
  })
  it('caps branches by merging the smallest custom ones into Other', () => {
    const people = Array.from({ length: 12 }, (_, i) => P(i + 1, `N${i}`, `group ${i}`))
    const g = groupByRelation(people, 5)
    expect(g).toHaveLength(5)
    expect(g[g.length - 1].key).toBe('other')
    expect(g.reduce((n, b) => n + b.people.length, 0)).toBe(12)
  })
})

describe('ringFraction', () => {
  it('is full after contact, drains to empty at due, poppy only when overdue, neutral without cadence', () => {
    expect(ringFraction(P(1, 'a', '', 10, NOW), NOW)).toEqual({ fraction: 1, overdue: false })
    expect(ringFraction(P(1, 'a', '', 10, '2026-10-28'), NOW).fraction).toBeCloseTo(0.5)
    expect(ringFraction(P(1, 'a', '', 10, '2026-10-23'), NOW)).toEqual({ fraction: 0, overdue: true })
    expect(ringFraction(P(1, 'a', '', 10), NOW)).toEqual({ fraction: 0, overdue: true })
    expect(ringFraction(P(1, 'a', '', 0), NOW)).toEqual({ fraction: null, overdue: false })
  })
})

describe('reachSoon', () => {
  it('lists overdue first, caps at five, skips people without cadence or far from due', () => {
    const ppl = [P(1, 'a', '', 7, '2026-10-01'), P(2, 'b', '', 7, '2026-10-20'), P(3, 'c', '', 90, NOW), P(4, 'd', '', 0), ...[5, 6, 7, 8, 9].map((i) => P(i, `n${i}`, '', 7, '2026-10-10'))]
    const r = reachSoon(ppl, NOW)
    expect(r).toHaveLength(5)
    expect(r[0].p.id).toBe(1)
    expect(r.some((x) => x.p.id === 3 || x.p.id === 4)).toBe(false)
  })
})

describe('layoutTree', () => {
  const branches = groupByRelation([1, 2, 3, 4, 5].map((i) => P(i, `P${i}`, 'friend')).concat([P(9, 'M', 'mentor')]))
  it('places every person and an add node per branch, with no overlapping nodes', () => {
    const l = layoutTree(branches, new Set(), { perRow: 3 })
    expect(l.nodes.filter((n) => n.kind === 'person')).toHaveLength(6)
    expect(l.nodes.filter((n) => n.kind === 'add')).toHaveLength(2)
    const pts = l.nodes.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`)
    expect(new Set(pts).size).toBe(pts.length)
  })
  it('hides leaves of a collapsed branch and shrinks the tree', () => {
    const open = layoutTree(branches, new Set(), { perRow: 3 })
    const shut = layoutTree(branches, new Set(['friends']), { perRow: 3 })
    expect(shut.nodes.filter((n) => n.branch === 'friends' && n.kind !== 'branch')).toHaveLength(0)
    expect(shut.bounds.h).toBeLessThan(open.bounds.h)
  })
  it('handles an 80 person network', () => {
    const big = groupByRelation(Array.from({ length: 80 }, (_, i) => P(i + 1, `P${i}`, ['friend', 'family', 'work', ''][i % 4])))
    const l = layoutTree(big, new Set(), { perRow: 6 })
    expect(l.nodes.filter((n) => n.kind === 'person')).toHaveLength(80)
  })
})

describe('navigate and fitView', () => {
  const l = layoutTree(groupByRelation([P(1, 'A', 'friend'), P(2, 'B', 'friend'), P(3, 'C', 'mom')]), new Set(), { perRow: 2 })
  it('moves right along a row, left back to the branch, and down to the next branch', () => {
    expect(navigate(l.nodes, 'b:family', 'right')).toBe('p:3')
    expect(navigate(l.nodes, 'p:3', 'left')).toBe('b:family')
    expect(navigate(l.nodes, 'p:3', 'down')).toBe('p:1')
    expect(navigate(l.nodes, 'b:family', 'left')).toBe('b:family')
  })
  it('fits small trees centred and clamps long ones', () => {
    expect(fitView({ x: 0, y: 0, w: 400, h: 200 }, 800, 600).k).toBeCloseTo(1.35)
    expect(fitView({ x: 0, y: 0, w: 400, h: 4000 }, 390, 500).k).toBe(0.55)
  })
})
