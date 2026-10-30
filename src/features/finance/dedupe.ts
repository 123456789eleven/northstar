// Re-import safety. CSV rows have no bank id, so each row gets a stable key (date + amount + normalized
// description) plus an occurrence index, so two genuinely identical same-day purchases are both kept while
// re-importing an overlapping statement adds nothing. OFX rows use their FITID (hashed with the account).
// The account NAME is deliberately not part of the key: it defaults to the file name, which changes per export.
import type { Transaction } from '../../db'
import { dedupeKey } from './csv'
import { shortHash } from './ofx'

export type RowStatus = 'new' | 'dup' | 'error'
type Keyed = Pick<Transaction, 'date' | 'amount' | 'description' | 'fitid'>

/** Stable hash per row: "<hash of content>#<occurrence index among identical rows in the same list>". */
export function occurrenceKeys(rows: Pick<Transaction, 'date' | 'amount' | 'description'>[]): string[] {
  const seen = new Map<string, number>()
  return rows.map((t) => {
    const base = shortHash(dedupeKey(t))
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return `${base}#${n}`
  })
}

/** Status for each incoming row (undefined = unreadable) against what is already stored. */
export function planImport(incoming: (Keyed | undefined)[], existing: Keyed[]): RowStatus[] {
  const haveIds = new Set(existing.flatMap((t) => (t.fitid ? [t.fitid] : [])))
  const haveKeys = new Set(occurrenceKeys(existing))
  const seenIds = new Set<string>()
  // Occurrence index is counted over the incoming rows that have no FITID, in file order.
  const csvRows = incoming.filter((t): t is Keyed => !!t && !t.fitid)
  const csvKeys = occurrenceKeys(csvRows)
  let ci = 0
  return incoming.map((t) => {
    if (!t) return 'error'
    if (t.fitid) {
      if (haveIds.has(t.fitid) || seenIds.has(t.fitid)) return 'dup'
      seenIds.add(t.fitid)
      return 'new'
    }
    return haveKeys.has(csvKeys[ci++]) ? 'dup' : 'new'
  })
}
