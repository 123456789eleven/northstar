// Opt-in Open Food Facts lookup. The ONLY thing sent is the search text, as a URL query string.
export const OFF_OPTIN_KEY = 'food.lookup.optin'
export const OFF_HOST = 'https://world.openfoodfacts.org'

export interface OffFood {
  name: string
  brand?: string
  /** What the numbers refer to, e.g. "100 g" or "1 serving". */
  per: string
  kcal?: number
  protein?: number
}

interface OffProduct {
  product_name?: string
  brands?: string
  serving_size?: string
  nutriments?: Record<string, number | string | undefined>
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : undefined
}

export function mapProduct(p: OffProduct): OffFood | null {
  const name = p.product_name?.trim()
  if (!name) return null
  const n = p.nutriments ?? {}
  const sk = num(n['energy-kcal_serving'])
  const useServing = sk != null && !!p.serving_size
  const kcal = useServing ? sk : num(n['energy-kcal_100g'])
  const protein = num(useServing ? n['proteins_serving'] : n['proteins_100g'])
  if (kcal == null && protein == null) return null
  return { name, brand: p.brands?.split(',')[0]?.trim() || undefined, per: useServing ? `serving (${p.serving_size})` : '100 g', kcal, protein }
}

export async function searchOpenFoodFacts(query: string, opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<OffFood[]> {
  const q = query.trim().slice(0, 100)
  if (q.length < 2) return []
  const f = opts.fetchImpl ?? fetch
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 6000)
  try {
    const url = `${OFF_HOST}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,serving_size,nutriments`
    const res = await f(url, { signal: ctl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
    if (!res.ok) throw new Error(`Lookup failed (${res.status})`)
    const data = (await res.json()) as { products?: OffProduct[] }
    return (data.products ?? []).map(mapProduct).filter((x): x is OffFood => x != null).slice(0, 6)
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('Lookup timed out. Showing built-in foods only.')
    throw new Error(e instanceof Error && !/fetch|network/i.test(e.message) ? e.message : 'Could not reach Open Food Facts. You may be offline.')
  } finally {
    clearTimeout(timer)
  }
}
