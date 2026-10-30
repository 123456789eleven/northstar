// Pure SimpleFIN -> Northstar mapping and dedupe. No network, no storage.
import type { BalanceSnapshot, Transaction } from '../../db'
import { categorize, type Rule } from '../finance/categories'

export const SFIN_PREFIX = 'sfin:'
export const SFIN_LABEL = 'SimpleFIN'

export interface SfinTransaction {
  id?: string
  posted?: number | string
  amount?: string | number
  description?: string
  payee?: string
  memo?: string
  pending?: boolean
}
export interface SfinAccount {
  id?: string
  name?: string
  currency?: string
  balance?: string | number
  'available-balance'?: string | number
  'balance-date'?: number
  org?: { name?: string; domain?: string; id?: string }
  transactions?: SfinTransaction[]
}
export interface SfinResponse {
  errors?: unknown[]
  accounts?: SfinAccount[]
}

export type FeedRow = Omit<Transaction, 'id' | 'importBatch'> & { fitid: string }

export interface MapResult {
  rows: FeedRow[]
  pending: number
  invalid: number
  /** Repeats of the same account+transaction id inside this response. */
  duplicates: number
}

export const feedKey = (accountId: string, txId: string) => `${SFIN_PREFIX}${accountId}:${txId}`

/** Decimal strings only; rejects NaN, Infinity and anything that is not a plain number. */
export function parseAmount(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) / 100 : null
  if (typeof v !== 'string' || !/^\s*[-+]?\d+(\.\d+)?\s*$/.test(v)) return null
  return Math.round(Number(v) * 100) / 100
}

/** Bridge timestamps are epoch seconds at (about) midnight UTC of the bank's posting date, so read the UTC date. */
export function postedToDate(posted: unknown): string | null {
  const n = typeof posted === 'string' ? Number(posted) : posted
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return null
  const d = new Date(n * 1000)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

export function accountLabel(a: SfinAccount): string {
  const org = (a.org?.name || a.org?.domain || '').trim()
  const name = (a.name || '').trim()
  const label = [org, name].filter(Boolean).join(' ')
  return label || 'Bank account'
}

export function mapAccounts(resp: SfinResponse, rules: Rule[]): MapResult {
  const out: MapResult = { rows: [], pending: 0, invalid: 0, duplicates: 0 }
  const seen = new Set<string>()
  for (const a of Array.isArray(resp?.accounts) ? resp.accounts : []) {
    const accId = typeof a?.id === 'string' ? a.id : ''
    const label = accountLabel(a ?? {})
    for (const t of Array.isArray(a?.transactions) ? a.transactions : []) {
      if (t?.pending === true) {
        out.pending++
        continue
      }
      const txId = typeof t?.id === 'string' ? t.id : ''
      const amount = parseAmount(t?.amount)
      const date = postedToDate(t?.posted)
      if (!accId || !txId || amount === null || amount === 0 || !date) {
        // posted of 0 with no pending flag is also a not-yet-posted row on some banks.
        if (accId && txId && amount !== null && !date) out.pending++
        else out.invalid++
        continue
      }
      const key = feedKey(accId, txId)
      if (seen.has(key)) {
        out.duplicates++
        continue
      }
      seen.add(key)
      const description = (t.description || t.payee || t.memo || '').replace(/\s+/g, ' ').trim() || '(no description)'
      out.rows.push({ date, amount, description, category: categorize(description, amount, rules), account: label, fitid: key })
    }
  }
  return out
}

/** Splits mapped rows into new ones and ones already stored (by feed key). */
export function splitNew<T extends { fitid: string }>(rows: T[], existingKeys: Iterable<string | undefined>): { fresh: T[]; already: number } {
  const have = new Set<string>()
  for (const k of existingKeys) if (k) have.add(k)
  const fresh = rows.filter((r) => !have.has(r.fitid))
  return { fresh, already: rows.length - fresh.length }
}

/** Merges several responses (one per date window) into one, keeping each account once. */
export function mergeResponses(list: SfinResponse[]): SfinResponse {
  const accounts = new Map<string, SfinAccount>()
  const errors: unknown[] = []
  for (const r of list) {
    if (Array.isArray(r?.errors)) errors.push(...r.errors)
    for (const a of Array.isArray(r?.accounts) ? r.accounts : []) {
      const id = a.id ?? `_${accounts.size}`
      const cur = accounts.get(id)
      if (!cur) accounts.set(id, { ...a, transactions: [...(a.transactions ?? [])] })
      else cur.transactions = [...(cur.transactions ?? []), ...(a.transactions ?? [])]
    }
  }
  return { errors, accounts: [...accounts.values()] }
}

const LIABILITY = /credit|card|loan|mortgage|line of credit|heloc|visa|mastercard|amex/i

/** One balance per account for Net worth. Liabilities are stored as positive amounts owed. */
export function balanceSnapshots(resp: SfinResponse, date: string): Omit<BalanceSnapshot, 'id'>[] {
  const out: Omit<BalanceSnapshot, 'id'>[] = []
  for (const a of Array.isArray(resp?.accounts) ? resp.accounts : []) {
    const bal = parseAmount(a?.balance)
    if (bal === null) continue
    const name = accountLabel(a)
    const liability = LIABILITY.test(a.name ?? '')
    out.push({ date, name, kind: liability ? 'liability' : 'asset', balance: liability ? Math.abs(bal) : bal })
  }
  return out
}

/** Server-side messages SimpleFIN includes in errors[] (bank login needs attention, etc.). Strings only. */
export function feedMessages(resp: SfinResponse): string[] {
  return (Array.isArray(resp?.errors) ? resp.errors : []).filter((e): e is string => typeof e === 'string').map((e) => e.slice(0, 200))
}
