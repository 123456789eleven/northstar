import { describe, expect, it, vi } from 'vitest'
import { db } from '../../db'
import { searchFoods, FOODS } from '../../data/foods'
import { commitCalendar, commitContacts, getDataImports, undoDataImport } from './dataActions'
import { mapProduct, searchOpenFoodFacts } from './offSearch'

const e = (uid: string, date: string) => ({ title: 'T', date, allDay: true, uid })

describe('calendar import', () => {
  it('dedupes by uid+date, logs one event, and undo removes rows and event', async () => {
    await db.calendar.add({ title: 'old', date: '2026-01-01', allDay: true, uid: 'a' })
    const r = await commitCalendar('x.ics', [e('a', '2026-01-01'), e('a', '2026-01-02'), e('a', '2026-01-02'), e('b', '2026-01-01')])
    expect(r).toMatchObject({ added: 2, skipped: 2 })
    expect(await db.calendar.count()).toBe(3)
    const evs = await db.events.toArray()
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ area: 'personal', kind: 'data.import', refKey: r.batch })
    expect(await undoDataImport(r.batch)).toBe(2)
    expect(await db.calendar.count()).toBe(1)
    expect(await db.events.count()).toBe(0)
    expect(await getDataImports()).toEqual([])
  })
})

describe('contacts import', () => {
  it('dedupes by case-insensitive name, sets cadence 0, and undo removes only its rows', async () => {
    await db.people.add({ name: 'Ada Lovelace', relation: '', cadenceDays: 7 })
    const r = await commitContacts('c.vcf', [{ name: 'ada lovelace', relation: '' }, { name: 'Bo', relation: 'Friend', birthday: '02-29' }, { name: 'BO', relation: '' }])
    expect(r).toMatchObject({ added: 1, skipped: 2 })
    const bo = (await db.people.toArray()).find((p) => p.name === 'Bo')!
    expect(bo).toMatchObject({ cadenceDays: 0, birthday: '02-29' })
    expect(await undoDataImport(r.batch)).toBe(1)
    expect((await db.people.toArray()).map((p) => p.name)).toEqual(['Ada Lovelace'])
    expect(await db.events.count()).toBe(0)
  })
})

describe('food search', () => {
  it('bundles roughly 150 foods with sane values', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(140)
    for (const f of FOODS) {
      expect(f.kcal).toBeGreaterThanOrEqual(0)
      expect(f.protein).toBeGreaterThanOrEqual(0)
    }
  })
  it('ranks exact, then prefix, then word matches; ignores short queries', () => {
    expect(searchFoods('banana')[0].name).toBe('Banana')
    expect(searchFoods('egg')[0].name).toBe('Egg, large')
    expect(searchFoods('greek')[0].name).toMatch(/^Greek yogurt/)
    expect(searchFoods('rice').some((f) => f.name === 'Brown rice, cooked')).toBe(true)
    expect(searchFoods('b')).toEqual([])
    expect(searchFoods('zzzzqq')).toEqual([])
  })
})

describe('Open Food Facts lookup', () => {
  const ok = (body: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response)
  it('sends only the query string and maps results', async () => {
    const f = ok({ products: [{ product_name: 'Oat Bar', brands: 'Acme, Co', nutriments: { 'energy-kcal_100g': 410.4, proteins_100g: 8 } }, { product_name: '' }, { product_name: 'Empty' }] })
    const out = await searchOpenFoodFacts('oat bar', { fetchImpl: f as unknown as typeof fetch })
    expect(out).toEqual([{ name: 'Oat Bar', brand: 'Acme', per: '100 g', kcal: 410, protein: 8 }])
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/^https:\/\/world\.openfoodfacts\.org\/cgi\/search\.pl\?search_terms=oat%20bar&/)
    expect(init.credentials).toBe('omit')
    expect(init.body).toBeUndefined()
  })
  it('prefers per-serving values when available', () => {
    expect(mapProduct({ product_name: 'X', serving_size: '30 g', nutriments: { 'energy-kcal_serving': 120, proteins_serving: 3, 'energy-kcal_100g': 400 } })).toMatchObject({ kcal: 120, protein: 3, per: 'serving (30 g)' })
  })
  it('reports HTTP errors and network failures', async () => {
    const bad = vi.fn(async () => ({ ok: false, status: 503 }) as Response)
    await expect(searchOpenFoodFacts('milk', { fetchImpl: bad as unknown as typeof fetch })).rejects.toThrow(/503/)
    const down = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    await expect(searchOpenFoodFacts('milk', { fetchImpl: down as unknown as typeof fetch })).rejects.toThrow(/offline/)
  })
  it('times out', async () => {
    const hang = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_, rej) => init.signal!.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })))))
    await expect(searchOpenFoodFacts('milk', { fetchImpl: hang as unknown as typeof fetch, timeoutMs: 10 })).rejects.toThrow(/timed out/)
  })
  it('does not call fetch for tiny queries', async () => {
    const f = ok({})
    expect(await searchOpenFoodFacts(' a ', { fetchImpl: f as unknown as typeof fetch })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
})
