// On-device global search. Reads Dexie tables with capped scans; nothing is sent anywhere or logged.
// Ranking: prefix > word-start > substring (and a one-character typo fallback for longer words), recency breaks ties.
import type { EntityTable } from 'dexie'
import { db } from '../db'

export type SearchGroup =
  | 'Tasks' | 'Goals' | 'Habits' | 'People' | 'Journal' | 'Food' | 'Learning'
  | 'Finance' | 'Calendar' | 'History'

export interface SearchHit {
  /** Stable key, unique across groups. */
  id: string
  group: SearchGroup
  label: string
  secondary: string
  /** Existing route to open (no page supports deep links yet). */
  to: string
  score: number
}

export interface SearchGroupResult { group: SearchGroup; hits: SearchHit[] }

export const PER_GROUP = 5
export const TOTAL_CAP = 30
/** Max rows scanned per table (newest first). */
export const SCAN_CAP = 2000

const norm = (s: string) => s.toLowerCase()

/** Levenshtein distance <= 1 (substitution, insertion, deletion). */
function withinOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (a.length < b.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

/** Score one token against one text: 100 prefix, 70 word start, 40 substring, 20 one-typo word, 0 none. */
function tokenScore(text: string, tok: string): number {
  if (text.startsWith(tok)) return 100
  const words = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  if (words.some((w) => w.startsWith(tok))) return 70
  if (text.includes(tok)) return 40
  if (tok.length >= 4 && words.some((w) => withinOne(w.slice(0, tok.length), tok) || withinOne(w, tok))) return 20
  return 0
}

/** Score a query (all whitespace-separated tokens must match) against several fields; best field wins. 0 = no match. */
export function scoreFields(fields: Array<string | undefined>, query: string): number {
  const toks = norm(query).split(/\s+/).filter(Boolean)
  if (!toks.length) return 0
  let best = 0
  const hay = fields.filter((f): f is string => !!f).map(norm)
  // Every token must match somewhere; the field with the strongest whole match decides the score.
  const perTok = toks.map((t) => Math.max(0, ...hay.map((h) => tokenScore(h, t))))
  if (perTok.some((s) => s === 0)) return 0
  const floor = Math.min(...perTok)
  for (const h of hay) {
    const s = Math.min(...toks.map((t) => tokenScore(h, t)))
    if (s > best) best = s
  }
  return best || floor
}

/** A short window of `text` around the first match of the query's first token (for private journal text). */
export function snippet(text: string, query: string, radius = 36): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  const tok = norm(query).split(/\s+/).filter(Boolean)[0] ?? ''
  const at = tok ? norm(flat).indexOf(tok) : -1
  if (at < 0) return flat.length > radius * 2 ? flat.slice(0, radius * 2) + '…' : flat
  const start = Math.max(0, at - radius)
  const end = Math.min(flat.length, at + tok.length + radius)
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '')
}

type Row = { hit: Omit<SearchHit, 'score'>; fields: Array<string | undefined>; recency: string }

const recent = <T extends { id?: number },>(t: EntityTable<T, 'id'>) => t.toCollection().reverse().limit(SCAN_CAP).toArray()

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`

async function collect(query: string): Promise<Array<Row & { group: SearchGroup }>> {
  const [tasks, goals, habits, people, journal, meals, favs, learning, txns, cal, events] = await Promise.all([
    recent(db.tasks), recent(db.goals), recent(db.habits), recent(db.people), recent(db.journal),
    recent(db.meals), recent(db.favoriteMeals), recent(db.learning), db.transactions.orderBy('date').reverse().limit(SCAN_CAP).toArray(),
    recent(db.calendar), recent(db.events),
  ])
  const rows: Array<Row & { group: SearchGroup }> = []
  const add = (group: SearchGroup, r: Row) => rows.push({ ...r, group })

  for (const t of tasks) {
    add('Tasks', {
      hit: { id: `task:${t.id}`, group: 'Tasks', label: t.title, secondary: t.status === 'done' ? 'Done' : t.due ? `Due ${t.due}` : 'Open', to: '/tasks' },
      fields: [t.title, t.notes], recency: t.due ?? t.createdAt,
    })
  }
  for (const g of goals) {
    add('Goals', {
      hit: { id: `goal:${g.id}`, group: 'Goals', label: g.title, secondary: `${g.horizon} goal, ${g.status}`, to: '/goals' },
      fields: [g.title, g.why], recency: g.createdAt,
    })
    for (const m of g.milestones ?? []) {
      add('Goals', {
        hit: { id: `ms:${g.id}:${m.id}`, group: 'Goals', label: m.title, secondary: `Milestone of ${g.title}`, to: '/goals' },
        fields: [m.title], recency: g.createdAt,
      })
    }
  }
  for (const h of habits) {
    add('Habits', {
      hit: { id: `habit:${h.id}`, group: 'Habits', label: h.name, secondary: h.archived ? 'Archived' : `${h.perWeek}x a week`, to: '/habits' },
      fields: [h.name], recency: h.createdAt,
    })
  }
  for (const p of people) {
    add('People', {
      hit: { id: `person:${p.id}`, group: 'People', label: p.name, secondary: p.relation, to: '/people' },
      fields: [p.name, p.relation], recency: p.lastContact ?? '',
    })
  }
  for (const j of journal) {
    // Private: only a short matching snippet is ever surfaced.
    add('Journal', {
      hit: { id: `journal:${j.id}`, group: 'Journal', label: j.date, secondary: snippet(j.text, query), to: '/journal' },
      fields: [j.text, ...(j.tags ?? [])], recency: j.date,
    })
  }
  for (const m of meals) {
    add('Food', {
      hit: { id: `meal:${m.id}`, group: 'Food', label: m.name, secondary: `${m.slot}, ${m.date}`, to: '/food' },
      fields: [m.name], recency: m.date,
    })
  }
  for (const f of favs) {
    add('Food', {
      hit: { id: `fav:${f.id}`, group: 'Food', label: f.name, secondary: 'Favorite food', to: '/food' },
      fields: [f.name], recency: '',
    })
  }
  for (const l of learning) {
    add('Learning', {
      hit: { id: `learn:${l.id}`, group: 'Learning', label: l.title, secondary: `${l.kind}, ${l.status}`, to: '/learning' },
      fields: [l.title, l.provider], recency: l.createdAt,
    })
  }
  for (const x of txns) {
    add('Finance', {
      hit: { id: `txn:${x.id}`, group: 'Finance', label: x.description, secondary: `${x.date}, ${money(x.amount)}`, to: '/finance' },
      fields: [x.description, x.category], recency: x.date,
    })
  }
  for (const c of cal) {
    add('Calendar', {
      hit: { id: `cal:${c.id}`, group: 'Calendar', label: c.title, secondary: c.allDay || !c.start ? c.date : `${c.date} ${c.start}`, to: '/planner' },
      fields: [c.title, c.location], recency: c.date,
    })
  }
  for (const e of events) {
    add('History', {
      hit: { id: `event:${e.id}`, group: 'History', label: e.title, secondary: e.at.slice(0, 10), to: '/history' },
      fields: [e.title], recency: e.at,
    })
  }
  return rows
}

/** Search every module. Returns groups ordered by their best hit, <= PER_GROUP each and <= TOTAL_CAP overall. */
export async function searchAll(query: string): Promise<SearchGroupResult[]> {
  const q = query.trim()
  if (!q) return []
  const scored: Array<SearchHit & { recency: string }> = []
  for (const r of await collect(q)) {
    const score = scoreFields(r.fields, q)
    if (score > 0) scored.push({ ...r.hit, score, recency: r.recency })
  }
  scored.sort((a, b) => b.score - a.score || (a.recency < b.recency ? 1 : a.recency > b.recency ? -1 : 0))

  const byGroup = new Map<SearchGroup, SearchHit[]>()
  for (const { recency: _r, ...hit } of scored) {
    const list = byGroup.get(hit.group) ?? []
    if (list.length < PER_GROUP) list.push(hit)
    byGroup.set(hit.group, list)
  }
  // Map preserves first-insertion order, i.e. groups ordered by their best hit.
  const out: SearchGroupResult[] = []
  let total = 0
  for (const [group, hits] of byGroup) {
    if (total >= TOTAL_CAP) break
    const room = hits.slice(0, TOTAL_CAP - total)
    total += room.length
    out.push({ group, hits: room })
  }
  return out
}
