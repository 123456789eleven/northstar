// Career workspace persistence. Wins are timeline events; projects and prefs are synced settings; 1:1 notes are journal entries.
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getSetting, logEvent, setSetting, type LifeEvent } from '../../db'
import { toISODate, today } from '../../lib/dates'
import { saveEntry } from '../journal/journalData'
import { extractTags } from '../journal/stats'
import { WIN_TAGS, parseWinInput, type Impact, type WinTag } from './impact'
import type { Win } from './leadership'
import { composeOneOnOne, parseOneOnOnes, type OneOnOneDraft, type ParsedNote } from './oneOnOne'
import { PROJECTS_KEY, parseProjects, serializeProjects, type Project } from './projects'

export const WIN_KIND = 'career.win'

export function winFromEvent(e: LifeEvent): Win | null {
  const legacy = e.kind === 'win' && e.area === 'career'
  if (e.kind !== WIN_KIND && !legacy) return null
  let tags: WinTag[] = []
  let impact: Impact | undefined
  if (e.meta) {
    try {
      const m = JSON.parse(e.meta) as { tags?: unknown; impact?: Partial<Impact> }
      if (Array.isArray(m.tags)) tags = m.tags.filter((t): t is WinTag => (WIN_TAGS as readonly string[]).includes(t as string))
      if (m.impact && typeof m.impact.value === 'number') impact = { value: m.impact.value, unit: typeof m.impact.unit === 'string' ? m.impact.unit : '' }
    } catch { /* ignore bad meta */ }
  }
  return { id: e.id!, date: toISODate(new Date(e.at)), title: e.title, tags, impact }
}

export function useWins(): Win[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.events.filter((e) => e.kind === WIN_KIND || (e.kind === 'win' && e.area === 'career')).toArray()
    return rows.map(winFromEvent).filter((w): w is Win => !!w).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
  }, [])
}

/** Logs one win. `input` may carry inline #tags and "#impact 3h/week"; chip tags are merged in. */
export async function addWin(input: string, chipTags: WinTag[] = []): Promise<{ id: number; undo: () => Promise<void> } | null> {
  const p = parseWinInput(input)
  if (!p.title) return null
  const tags = [...new Set([...chipTags, ...p.tags])]
  const meta = tags.length || p.impact ? JSON.stringify({ v: 1, tags, impact: p.impact }) : undefined
  const id = (await logEvent({ area: 'career', kind: WIN_KIND, title: p.title, milestone: true, meta })) as number
  return { id, undo: async () => { await db.events.delete(id) } }
}

/** Deletes a win; the returned function puts it back exactly as it was. */
export async function removeWin(id: number): Promise<(() => Promise<void>) | null> {
  const row = await db.events.get(id)
  if (!row) return null
  await db.events.delete(id)
  return async () => { await db.events.put(row) }
}

// Projects
export function useProjects(): Project[] | undefined {
  return useLiveQuery(async () => parseProjects((await db.settings.get(PROJECTS_KEY))?.value), [])
}
export async function saveProjects(items: Project[]) {
  await setSetting(PROJECTS_KEY, serializeProjects(items))
}

// Prefs (target role, next 1:1 date) and commitments already handled
export interface Prefs { role: string; nextOneOnOne: string }
const PREFS_KEY = 'career.prefs'
const CLOSED_KEY = 'career.commitments'
const MAX_CLOSED = 400

export function usePrefs(): Prefs | undefined {
  return useLiveQuery(async () => {
    const v = (await db.settings.get(PREFS_KEY))?.value as Partial<Prefs> | undefined
    return { role: typeof v?.role === 'string' ? v.role : '', nextOneOnOne: typeof v?.nextOneOnOne === 'string' ? v.nextOneOnOne : '' }
  }, [])
}
export async function savePrefs(p: Prefs) {
  await setSetting(PREFS_KEY, { v: 1, ...p })
}

export function useClosed(): Set<string> | undefined {
  return useLiveQuery(async () => new Set(await readClosed()), [])
}
async function readClosed(): Promise<string[]> {
  const v = await getSetting<unknown>(CLOSED_KEY, null)
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
async function setClosed(keys: string[]) {
  await setSetting(CLOSED_KEY, keys.slice(-MAX_CLOSED))
}
export async function closeCommitment(key: string): Promise<() => Promise<void>> {
  const cur = await readClosed()
  if (!cur.includes(key)) await setClosed([...cur, key])
  return async () => setClosed((await readClosed()).filter((k) => k !== key))
}

/** Adds the commitment as an open task (priority 2) and marks it handled. Undo removes both. */
export async function makeTaskFromCommitment(key: string, text: string): Promise<() => Promise<void>> {
  const id = (await db.tasks.add({ title: text, priority: 2, status: 'open', recurrence: 'none', createdAt: new Date().toISOString() })) as number
  const reopen = await closeCommitment(key)
  return async () => {
    await db.tasks.delete(id)
    await reopen()
  }
}

// 1:1 notes live in the journal (one entry per date), so they show up in Journal search.
export async function saveOneOnOne(date: string, d: OneOnOneDraft): Promise<(() => Promise<void>) | null> {
  const block = composeOneOnOne(d)
  if (block === '1:1 with manager #1on1') return null
  const prev = await db.journal.where('date').equals(date).first()
  const before = prev?.text ?? ''
  await saveEntry(date, { text: before.trim() ? `${before.replace(/\s+$/, '')}\n\n${block}` : block })
  return async () => {
    const cur = await db.journal.where('date').equals(date).first()
    if (cur?.id == null) return
    if (!before.trim() && cur.mood == null && cur.energy == null) {
      await db.transaction('rw', db.journal, db.events, async () => {
        await db.journal.delete(cur.id!)
        await db.events.where('area').equals('personal').filter((e) => e.kind === 'journal.entry' && e.refKey === date).delete()
      })
    } else await db.journal.update(cur.id, { text: before, tags: extractTags(before) })
  }
}

export function useOneOnOnes(): ParsedNote[] | undefined {
  return useLiveQuery(async () => {
    const rows = await db.journal.filter((j) => (j.tags ?? []).includes('1on1')).toArray()
    return rows.flatMap((j) => parseOneOnOnes(j.date, j.text)).sort((a, b) => b.date.localeCompare(a.date))
  }, [])
}

export const monthNow = () => today().slice(0, 7)
