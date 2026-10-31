// Additive import: adds transactions, balances and budgets from a Northstar data file WITHOUT replacing anything.
// Every other table in the file (settings, events, goals ...) is never read or changed.
import { db, getSetting, logEvent, setSetting, type BalanceSnapshot, type Budget, type Transaction } from '../db'
import { IMPORTS_KEY, type ImportRecord } from '../features/finance/model'
import { IMPORT_EVENT_KIND, undoImport } from '../features/finance/importActions'
import type { BackupFile } from './backup'

export const ADDITIVE_TABLES = ['transactions', 'budgets', 'balances'] as const
export const ADDITIVE_ROW_CAP = 20_000
export const ADDITIVE_LABEL = 'Data file'

type NewTx = Omit<Transaction, 'id' | 'importBatch'>
type NewBalance = Omit<BalanceSnapshot, 'id'>
type NewBudget = Omit<Budget, 'id'>

export interface TablePlan<T> {
  /** Rows that will be added. */
  add: T[]
  /** Rows already in the app (or repeated in the file beyond what the app has). */
  present: number
  invalid: { index: number; reason: string }[]
}
export interface BudgetPlan extends TablePlan<NewBudget> {
  /** Categories that already exist with a different limit; the existing limit is kept. */
  kept: { category: string; existing: number; incoming: number }[]
}
export interface AdditivePlan {
  transactions: TablePlan<NewTx>
  balances: TablePlan<NewBalance>
  budgets: BudgetPlan
  /** Tables in the file that are ignored. */
  skipped: string[]
  /** The file the plan came from; apply re-checks it against live data inside its transaction. */
  source: BackupFile
}
export interface AdditiveUndo {
  batch: string
  balanceIds: number[]
  budgetIds: number[]
}
export interface AdditiveResult {
  added: { transactions: number; balances: number; budgets: number }
  undo: AdditiveUndo
}

const isIso = (s: unknown): s is string => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const cents = (n: number) => Math.round(n * 100)
const lc = (s: string) => s.trim().toLowerCase()

type Check<T> = { ok: T } | { err: string }

function checkTx(r: Record<string, unknown>): Check<NewTx> {
  if (!isIso(r.date)) return { err: 'date is not YYYY-MM-DD' }
  const amount = num(r.amount)
  if (amount === null) return { err: 'amount is not a number' }
  const description = str(r.description)
  if (!description) return { err: 'description is missing' }
  if (r.category !== undefined && !str(r.category)) return { err: 'category is empty' }
  if (r.account !== undefined && r.account !== null && typeof r.account !== 'string') return { err: 'account is not text' }
  const tx: NewTx = { date: r.date, amount, description, category: str(r.category) ?? 'Uncategorized' }
  const account = str(r.account)
  if (account) tx.account = account
  return { ok: tx }
}
function checkBalance(r: Record<string, unknown>): Check<NewBalance> {
  if (!isIso(r.date)) return { err: 'date is not YYYY-MM-DD' }
  const name = str(r.name)
  if (!name) return { err: 'name is missing' }
  if (r.kind !== 'asset' && r.kind !== 'liability') return { err: 'kind must be asset or liability' }
  const balance = num(r.balance)
  if (balance === null) return { err: 'balance is not a number' }
  return { ok: { date: r.date, name, kind: r.kind, balance } }
}
function checkBudget(r: Record<string, unknown>): Check<NewBudget> {
  const category = str(r.category)
  if (!category) return { err: 'category is missing' }
  const limit = num(r.monthlyLimit)
  if (limit === null || limit <= 0) return { err: 'monthlyLimit must be more than 0' }
  return { ok: { category, monthlyLimit: limit } }
}

/** Validates rows and drops the ones already present (occurrence-aware via `keyOf` counts). */
function planTable<T>(rows: unknown, check: (r: Record<string, unknown>) => Check<T>, keyOf: (t: T) => string, existing: Map<string, number>): TablePlan<T> {
  const out: TablePlan<T> = { add: [], present: 0, invalid: [] }
  const list = Array.isArray(rows) ? rows : []
  const seen = new Map(existing)
  list.forEach((raw, index) => {
    if (index >= ADDITIVE_ROW_CAP) {
      out.invalid.push({ index, reason: `over the ${ADDITIVE_ROW_CAP.toLocaleString()} row limit` })
      return
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      out.invalid.push({ index, reason: 'not a record' })
      return
    }
    const { id: _id, ...rest } = raw as Record<string, unknown> // ids are never imported
    void _id
    const c = check(rest)
    if ('err' in c) {
      out.invalid.push({ index, reason: c.err })
      return
    }
    const k = keyOf(c.ok)
    const left = seen.get(k) ?? 0
    if (left > 0) {
      seen.set(k, left - 1)
      out.present++
    } else {
      out.add.push(c.ok)
    }
  })
  return out
}

const count = (keys: Iterable<string>) => {
  const m = new Map<string, number>()
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}
const txKey = (t: Pick<Transaction, 'date' | 'amount' | 'description' | 'account'>) => `${t.date}|${cents(t.amount)}|${lc(t.description)}|${lc(t.account ?? '')}`
const balKey = (b: Pick<BalanceSnapshot, 'name' | 'date' | 'kind'>) => `${lc(b.name)}|${b.date}|${b.kind}`

/** Reads the app's current data and works out what would be added. Writes nothing. */
export async function planAdditiveImport(data: BackupFile): Promise<AdditivePlan> {
  const tables = data?.tables ?? {}
  const [txs, bals, buds] = await Promise.all([db.transactions.toArray(), db.balances.toArray(), db.budgets.toArray()])
  const existingBudget = new Map(buds.map((b) => [lc(b.category), b.monthlyLimit]))

  const transactions = planTable(tables.transactions, checkTx, txKey, count(txs.map(txKey)))
  const balances = planTable(tables.balances, checkBalance, balKey, count(bals.map(balKey)))

  // Budgets: one per category. Existing category => never overwritten.
  const budgets: BudgetPlan = { add: [], present: 0, invalid: [], kept: [] }
  const claimed = new Set<string>()
  const list = Array.isArray(tables.budgets) ? tables.budgets : []
  list.forEach((raw, index) => {
    if (index >= ADDITIVE_ROW_CAP) return void budgets.invalid.push({ index, reason: `over the ${ADDITIVE_ROW_CAP.toLocaleString()} row limit` })
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return void budgets.invalid.push({ index, reason: 'not a record' })
    const c = checkBudget(raw as Record<string, unknown>)
    if ('err' in c) return void budgets.invalid.push({ index, reason: c.err })
    const k = lc(c.ok.category)
    const have = existingBudget.get(k)
    if (have !== undefined) {
      if (cents(have) === cents(c.ok.monthlyLimit)) budgets.present++
      else budgets.kept.push({ category: c.ok.category, existing: have, incoming: c.ok.monthlyLimit })
    } else if (claimed.has(k)) {
      budgets.present++
    } else {
      claimed.add(k)
      budgets.add.push(c.ok)
    }
  })

  const skipped = Object.keys(tables).filter((t) => !(ADDITIVE_TABLES as readonly string[]).includes(t))
  return { transactions, balances, budgets, skipped, source: data }
}

/** Adds the plan's rows in ONE transaction. Re-checks against the live data inside it, so applying twice adds nothing new. */
export async function applyAdditiveImport(plan: Pick<AdditivePlan, 'source'>): Promise<AdditiveResult> {
  const batch = `imp-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
  const at = new Date().toISOString()
  const undo: AdditiveUndo = { batch, balanceIds: [], budgetIds: [] }
  const { source } = plan
  let nTx = 0
  await db.transaction('rw', db.transactions, db.balances, db.budgets, db.settings, db.events, async () => {
    const fresh = await planAdditiveImport(source)
    nTx = fresh.transactions.add.length
    if (nTx) await db.transactions.bulkAdd(fresh.transactions.add.map((t) => ({ ...t, importBatch: batch })))
    if (fresh.balances.add.length) undo.balanceIds = (await db.balances.bulkAdd(fresh.balances.add, { allKeys: true })) as number[]
    if (fresh.budgets.add.length) undo.budgetIds = (await db.budgets.bulkAdd(fresh.budgets.add, { allKeys: true })) as number[]
    const total = nTx + undo.balanceIds.length + undo.budgetIds.length
    if (!total) return
    const rec: ImportRecord = { id: batch, at, file: ADDITIVE_LABEL, added: nTx, skipped: fresh.transactions.present, errors: fresh.transactions.invalid.length }
    await setSetting(IMPORTS_KEY, [rec, ...(await getSetting<ImportRecord[]>(IMPORTS_KEY, []))].slice(0, 50))
    await logEvent({ area: 'finance', kind: IMPORT_EVENT_KIND, title: describe(nTx, undo.balanceIds.length, undo.budgetIds.length), refKey: batch, at })
  })
  return { added: { transactions: nTx, balances: undo.balanceIds.length, budgets: undo.budgetIds.length }, undo }
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
function describe(t: number, b: number, g: number) {
  const parts = [t && plural(t, 'transaction'), b && plural(b, 'balance'), g && plural(g, 'budget')].filter(Boolean)
  return `Added ${parts.join(', ')} from a data file`
}
export const describeAdded = (a: AdditiveResult['added']) => describe(a.transactions, a.balances, a.budgets).replace(' from a data file', '')

/** Removes exactly the rows an additive import added, plus its import record and History event. */
export async function undoAdditiveImport(u: AdditiveUndo): Promise<void> {
  await db.transaction('rw', db.transactions, db.balances, db.budgets, db.settings, db.events, async () => {
    await undoImport(u.batch)
    if (u.balanceIds.length) await db.balances.bulkDelete(u.balanceIds)
    if (u.budgetIds.length) await db.budgets.bulkDelete(u.budgetIds)
  })
}
