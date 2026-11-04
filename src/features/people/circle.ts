// Pure maths for the People circle: which orbit a contact belongs to, where each dot sits (no overlaps), and how its
// glow fades with days since contact. Nothing here is red or punitive: the dimmest a dot gets is GLOW_FLOOR.
import type { ISODate, Person } from '../../db'
import { daysBetween } from '../../lib/dates'

export type OrbitKey = 'weekly' | 'monthly' | 'quarterly' | 'other' | 'none'
export const ORBITS: { key: OrbitKey; label: string }[] = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'quarterly', label: 'Quarterly' },
  { key: 'other', label: 'Other' },
  { key: 'none', label: 'No rhythm' },
]

/** Cadence in days to orbit: weekly <= 7, monthly <= 31 (includes every 2 weeks), quarterly <= 100, other beyond, none = 0. */
export function orbitFor(cadenceDays: number): OrbitKey {
  if (!(cadenceDays > 0)) return 'none'
  if (cadenceDays <= 7) return 'weekly'
  if (cadenceDays <= 31) return 'monthly'
  if (cadenceDays <= 100) return 'quarterly'
  return 'other'
}

export const GLOW_FLOOR = 0.3

export interface Glow { glow: number; overdue: boolean; ratio: number | null }

/**
 * Glow 1 on the day of contact, easing down to GLOW_FLOOR when the cadence has elapsed and holding there.
 * overdue = the cadence has elapsed (matches personStatus: due today counts). Never contacted with a cadence = floor + overdue.
 * No cadence = a steady mid glow, never overdue.
 */
export function glowFor(p: Pick<Person, 'cadenceDays' | 'lastContact'>, now: ISODate): Glow {
  if (!(p.cadenceDays > 0)) return { glow: 0.55, overdue: false, ratio: null }
  if (!p.lastContact) return { glow: GLOW_FLOOR, overdue: true, ratio: null }
  const days = Math.max(0, daysBetween(p.lastContact, now))
  const ratio = days / p.cadenceDays
  const t = Math.min(1, ratio)
  const eased = 1 - t * t // monotone and gentle at first
  return { glow: Math.round((GLOW_FLOOR + (1 - GLOW_FLOOR) * Math.max(0, eased)) * 1000) / 1000, overdue: ratio >= 1, ratio }
}

export interface DotItem { id: number; cadenceDays: number }
export interface Dot { id: number; orbit: OrbitKey; x: number; y: number; ring: number }
export interface OrbitInfo { key: OrbitKey; label: string; r: number; count: number }
export interface CircleLayout { dots: Dot[]; orbits: OrbitInfo[]; radius: number; dotR: number }

export interface LayoutOpts { dotR?: number; gap?: number; inner?: number; ringGap?: number }

/**
 * Concentric orbits (weekly innermost). Dots on an orbit are spread evenly on a ring; when a ring is full the rest go on a
 * further ring of the same orbit, so no two dots ever overlap (centre distance >= 2 * dotR + gap along a ring, and
 * >= 2 * dotR + ringGap between rings). Deterministic: sorted by id, with a per-orbit angular offset.
 */
export function layoutCircle(items: DotItem[], o: LayoutOpts = {}): CircleLayout {
  const dotR = o.dotR ?? 6, gap = o.gap ?? 4, inner = o.inner ?? 44, ringGap = o.ringGap ?? 8
  const step = 2 * dotR + ringGap
  const dots: Dot[] = []
  const orbits: OrbitInfo[] = []
  let r = inner
  ORBITS.forEach((orb, oi) => {
    const list = items.filter((i) => orbitFor(i.cadenceDays) === orb.key).sort((a, b) => a.id - b.id)
    const first = r
    let left = list.length, placed = 0, ring = 0
    do {
      const cap = Math.max(1, Math.floor((2 * Math.PI * r) / (2 * dotR + gap)))
      const n = Math.min(left, cap)
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + oi * 0.7 + ring * 0.35 + (k * 2 * Math.PI) / n
        dots.push({ id: list[placed + k].id, orbit: orb.key, x: Math.round(Math.cos(a) * r * 100) / 100, y: Math.round(Math.sin(a) * r * 100) / 100, ring })
      }
      placed += n
      left -= n
      ring++
      if (left > 0) r += step
    } while (left > 0)
    orbits.push({ key: orb.key, label: orb.label, r: first, count: list.length })
    r += step + 6
  })
  return { dots, orbits, radius: r - step - 6 + dotR + 6, dotR }
}

/** The most overdue person with a cadence (largest days past due; never-contacted counts as most overdue), or null. */
export function mostOverdue<T extends Pick<Person, 'cadenceDays' | 'lastContact'>>(people: T[], now: ISODate): T | null {
  let best: T | null = null
  let bestScore = -Infinity
  for (const p of people) {
    const g = glowFor(p, now)
    if (!g.overdue) continue
    const score = g.ratio == null ? Infinity : g.ratio
    if (score > bestScore) { best = p; bestScore = score }
  }
  return best
}
