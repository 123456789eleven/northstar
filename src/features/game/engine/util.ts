import type { Area, ISODate } from '../../../db'
import { toISODate } from '../../../lib/dates'
import type { SkillId, XpGain } from '../types'
import type { XpKind } from './xpTable'

/** An XpGain plus the local day and kind it belongs to (the id is also `${kind}:...`). */
export interface DatedGain extends XpGain {
  date: ISODate
  kind: XpKind
}

/** Local YYYY-MM-DD for a date string or ISO timestamp; '' when invalid. */
export function localDate(v?: string): ISODate {
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '' : toISODate(d)
}

export function groupByDay(gains: DatedGain[]): Map<ISODate, DatedGain[]> {
  const m = new Map<ISODate, DatedGain[]>()
  for (const g of gains) {
    const a = m.get(g.date)
    if (a) a.push(g)
    else m.set(g.date, [g])
  }
  return m
}

const AREA_SKILL: Record<Area, SkillId> = {
  career: 'career', health: 'body', finance: 'money', learning: 'mind', relationships: 'people', personal: 'mind',
}
export const skillForArea = (a: Area | undefined, fallback: SkillId = 'mind'): SkillId => (a ? AREA_SKILL[a] ?? fallback : fallback)

const ORDER: SkillId[] = ['body', 'money', 'mind', 'career', 'people']
/** Skill with the most XP in these gains (ties: Body, Money, Mind, Career, People). */
export function topSkill(gains: XpGain[]): SkillId {
  const t: Record<string, number> = {}
  for (const g of gains) t[g.skill] = (t[g.skill] ?? 0) + g.xp
  let best: SkillId = 'mind'
  let bv = -1
  for (const s of ORDER) if ((t[s] ?? 0) > bv) { best = s; bv = t[s] ?? 0 }
  return best
}
