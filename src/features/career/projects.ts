// Improvement project tracker (pure). Stored as a versioned envelope in the settings key below.
import { formatUnit } from './impact'

export const PROJECTS_KEY = 'career.projects'
export const MAX_PROJECTS = 20
export const STATUSES = ['idea', 'baselining', 'piloting', 'measuring', 'done'] as const
export type ProjectStatus = (typeof STATUSES)[number]

export interface Metric { value: number; unit: string; date: string }
export interface Project {
  id: string
  name: string
  problem: string
  /** 'lower' when a smaller number is the improvement (errors, hours), 'higher' otherwise. */
  better: 'lower' | 'higher'
  baseline?: Metric
  change: string
  result?: Metric
  status: ProjectStatus
  next: string
  featured: boolean
}

const str = (v: unknown) => (typeof v === 'string' ? v : '')
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

function parseMetric(m: unknown): Metric | undefined {
  const o = m as Partial<Metric> | null
  if (!o || typeof o.value !== 'number' || !Number.isFinite(o.value) || !isDate(o.date)) return undefined
  return { value: o.value, unit: str(o.unit), date: o.date }
}

/** Tolerant parse so a bad synced value never breaks the page. */
export function parseProjects(raw: unknown): Project[] {
  const o = raw as { v?: number; items?: unknown } | null
  if (!o || o.v !== 1 || !Array.isArray(o.items)) return []
  const out: Project[] = []
  for (const p of o.items as Partial<Project>[]) {
    if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') continue
    out.push({
      id: p.id,
      name: p.name,
      problem: str(p.problem),
      better: p.better === 'higher' ? 'higher' : 'lower',
      baseline: parseMetric(p.baseline),
      change: str(p.change),
      result: parseMetric(p.result),
      status: (STATUSES as readonly string[]).includes(p.status as string) ? (p.status as ProjectStatus) : 'idea',
      next: str(p.next),
      featured: p.featured === true,
    })
  }
  const items = out.slice(0, MAX_PROJECTS)
  // At most one featured project; the first flagged one wins.
  const first = items.findIndex((p) => p.featured)
  return items.map((p, i) => ({ ...p, featured: i === first }))
}
export const serializeProjects = (items: Project[]) => ({ v: 1, items: items.slice(0, MAX_PROJECTS) })

/** Percent improvement, whole number. Null when there is no baseline, no result, or the baseline is zero. */
export function improvementPct(p: Pick<Project, 'baseline' | 'result' | 'better'>): number | null {
  if (!p.baseline || !p.result || p.baseline.value === 0) return null
  const delta = p.better === 'lower' ? p.baseline.value - p.result.value : p.result.value - p.baseline.value
  return Math.round((delta / Math.abs(p.baseline.value)) * 100)
}

const fmt = (m: Metric) => formatUnit(m.value, m.unit)

/** "Reduced X from A to B (N%)". Empty string until both metrics exist. */
export function resultSentence(p: Project): string {
  if (!p.baseline || !p.result) return ''
  const pct = improvementPct(p)
  const name = p.name.trim() || 'the metric'
  const worse = pct != null && pct < 0
  const verb = p.better === 'lower' ? (worse ? 'Increased' : 'Reduced') : worse ? 'Reduced' : 'Increased'
  const tail = pct == null ? '' : ` (${Math.abs(pct)}%)`
  return `${verb} ${name} from ${fmt(p.baseline)} to ${fmt(p.result)}${tail}`
}

/** Bar widths 0-100 on one shared scale, for the before/after mini chart. */
export function barWidths(p: Pick<Project, 'baseline' | 'result'>): { before: number; after: number } | null {
  if (!p.baseline || !p.result) return null
  const max = Math.max(Math.abs(p.baseline.value), Math.abs(p.result.value))
  if (max === 0) return { before: 0, after: 0 }
  return { before: (Math.abs(p.baseline.value) / max) * 100, after: (Math.abs(p.result.value) / max) * 100 }
}
