// In-browser CSV parsing for bank exports. Nothing leaves the device: papaparse reads the File locally.
import Papa from 'papaparse'
import type { ISODate, Transaction } from '../../db'
import { toISODate } from '../../lib/dates'
import { categorize, type Rule } from './categories'
import { shortHash } from './ofx'

export interface ParsedFile {
  name: string
  headers: string[]
  rows: string[][]
}

export interface Mapping {
  date: number
  description: number
  /** -1 = not used */
  amount: number
  debit: number
  credit: number
  mode: 'amount' | 'split'
  expensesPositive: boolean
  dayFirst: boolean
}

const DATE_NAMES = /^(transaction date|trans\.? date|date|posted date|posted|posting date|post date|booking date|effective date|date posted)$/i
const DESC_NAMES = /^(description|desc|payee|merchant|name|memo|details|transaction|narrative|transaction description|original description)$/i
const AMOUNT_NAMES = /^(amount|transaction amount|amt|value|net amount)(\s*\(.*\))?$/i
const DEBIT_NAMES = /^(debit|debits|withdrawal|withdrawals|money out|debit amount|outflow|paid out)$/i
const CREDIT_NAMES = /^(credit|credits|deposit|deposits|money in|credit amount|inflow|paid in)$/i

// When several columns match a role, the earlier pattern wins ("Description" beats Chase's "Details" = DEBIT/CREDIT).
const DESC_PRIORITY = [/^(description|transaction description|original description|payee|merchant|narrative)$/i, /^(name|memo|transaction|details)$/i]
const DATE_PRIORITY = [/^(date|transaction date|trans\.? date)$/i, DATE_NAMES]

/** Stable per-layout key: same header row -> same signature, regardless of case/spacing. */
export function headerSignature(headers: string[]): string {
  const s = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, ' ')).join('|')
  return `${headers.length}.${shortHash(s)}`
}
export const MAP_KEY_PREFIX = 'finance.map.'

/** One-line, human description of a mapping for the preview. */
export function describeMapping(f: ParsedFile, m: Mapping): string {
  const h = (i: number) => (i >= 0 ? `“${f.headers[i]}”` : 'none')
  const amt = m.mode === 'amount' ? `Amount ${h(m.amount)}${m.expensesPositive ? ' (expenses positive)' : ''}` : `Money out ${h(m.debit)}, money in ${h(m.credit)}`
  return `Date ${h(m.date)} · Description ${h(m.description)} · ${amt}${m.dayFirst ? ' · day/month dates' : ''}`
}

export const MAX_CSV_BYTES = 5 * 1024 * 1024
export const MAX_CSV_ROWS = 50_000

export function parseCsv(file: File): Promise<ParsedFile> {
  if (file.size > MAX_CSV_BYTES) return Promise.reject(new Error(`That file is ${(file.size / 1048576).toFixed(1)} MB. CSV imports are limited to 5 MB - export a shorter date range from your bank.`))
  return file.text().then((text) => parseCsvText(file.name, text))
}

/** Parses CSV text (split out of parseCsv so it is testable without a File). */
export function parseCsvText(name: string, text: string): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse<string[]>(text.replace(/^﻿/, ''), {
      skipEmptyLines: 'greedy',
      complete: (res) => {
        const all = res.data.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''))
        if (all.length === 0) return reject(new Error('That file has no rows.'))
        if (all.length > MAX_CSV_ROWS) return reject(new Error(`That file has ${all.length.toLocaleString()} rows. CSV imports are limited to ${MAX_CSV_ROWS.toLocaleString()} rows - export a shorter date range.`))
        // Some banks put a few lines of account info above the header. Find the first row that looks like one.
        let headerIdx = -1
        for (let i = 0; i < Math.min(15, all.length); i++) {
          const cells = all[i].map((c) => String(c).trim())
          const hits = [DATE_NAMES, DESC_NAMES, AMOUNT_NAMES, DEBIT_NAMES, CREDIT_NAMES].filter((re) => cells.some((c) => re.test(c))).length
          if (hits >= 2) {
            headerIdx = i
            break
          }
        }
        const width = Math.max(...all.map((r) => r.length))
        const headers =
          headerIdx >= 0
            ? Array.from({ length: width }, (_, i) => String(all[headerIdx][i] ?? '').trim() || `Column ${i + 1}`)
            : Array.from({ length: width }, (_, i) => `Column ${i + 1}`)
        let rows = all.slice(headerIdx + 1).map((r) => r.map((c) => String(c ?? '').trim()))
        // Summary/footer lines ("Total", "Ending balance", disclaimers) have no date in any cell: drop them quietly.
        if (headerIdx >= 0) {
          const hasDate = (r: string[]) => r.some((c) => parseDate(c, false) !== null || parseDate(c, true) !== null)
          if (rows.some(hasDate)) rows = rows.filter(hasDate)
        }
        resolve({ name, headers, rows })
      },
      error: (err: Error) => reject(err),
    })
  })
}

export function detectMapping(f: ParsedFile): Mapping {
  const find = (re: RegExp) => f.headers.findIndex((h) => re.test(h.trim()))
  const findFirst = (res: RegExp[]) => {
    for (const re of res) {
      const i = find(re)
      if (i >= 0) return i
    }
    return -1
  }
  let date = findFirst(DATE_PRIORITY)
  let description = findFirst(DESC_PRIORITY)
  if (description < 0) description = find(DESC_NAMES)
  let amount = find(AMOUNT_NAMES)
  const debit = find(DEBIT_NAMES)
  const credit = find(CREDIT_NAMES)
  const sample = f.rows.slice(0, 20)

  // Headerless files: guess by content.
  if (date < 0) date = f.headers.findIndex((_, i) => sample.length > 0 && sample.every((r) => parseDate(r[i] ?? '', false) !== null))
  if (amount < 0 && (debit < 0 || credit < 0)) {
    amount = f.headers.findIndex((_, i) => i !== date && sample.length > 0 && sample.every((r) => parseAmount(r[i] ?? '') !== null))
  }
  if (description < 0) {
    let best = -1
    let bestLen = 0
    f.headers.forEach((_, i) => {
      if (i === date || i === amount) return
      const len = sample.reduce((s, r) => s + (parseAmount(r[i] ?? '') === null ? (r[i] ?? '').length : 0), 0)
      if (len > bestLen) {
        bestLen = len
        best = i
      }
    })
    description = best
  }
  const mode: Mapping['mode'] = amount < 0 && debit >= 0 && credit >= 0 ? 'split' : 'amount'

  // If every amount is positive, the file probably lists expenses as positive numbers (common for credit cards).
  let expensesPositive = false
  if (mode === 'amount' && amount >= 0) {
    const vals = sample.map((r) => parseAmount(r[amount] ?? '')).filter((v): v is number => v !== null)
    expensesPositive = vals.length > 0 && vals.every((v) => v >= 0)
  }

  // Day-first if any first component exceeds 12.
  const rowsAll = f.rows.slice(0, 200)
  const dayFirst = date >= 0 && rowsAll.some((r) => {
    const m = /^(\d{1,2})[/.-](\d{1,2})[/.-]\d{2,4}/.exec(r[date] ?? '')
    return !!m && Number(m[1]) > 12
  })

  return { date, description, amount, debit, credit, mode, expensesPositive, dayFirst }
}

export function parseDate(raw: string, dayFirst: boolean): ISODate | null {
  const s = raw.trim()
  if (!s) return null
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(s)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s)
  if (m) {
    let y = +m[3]
    if (y < 100) y += 2000
    return dayFirst ? valid(y, +m[2], +m[1]) : valid(y, +m[1], +m[2])
  }
  if (/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(s) && /\d/.test(s)) {
    const t = Date.parse(s)
    if (!Number.isNaN(t)) return toISODate(new Date(t))
  }
  return null
}

function valid(y: number, mo: number, d: number): ISODate | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1) return null
  return toISODate(dt)
}

export function parseAmount(raw: string): number | null {
  let s = raw.trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (/-$/.test(s)) {
    neg = true
    s = s.slice(0, -1)
  }
  if (/\bDR\b/i.test(s)) neg = true
  s = s.replace(/\b(CR|DR)\b/gi, '').replace(/[$£€\s,]/g, '')
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round((neg ? -n : n) * 100) / 100
}

export interface RowResult {
  tx?: Omit<Transaction, 'id'>
  error?: string
}

export function buildRow(row: string[], m: Mapping, rules: Rule[], account: string): RowResult {
  const date = m.date >= 0 ? parseDate(row[m.date] ?? '', m.dayFirst) : null
  if (!date) return { error: 'No readable date' }
  const description = (m.description >= 0 ? row[m.description] : '')?.replace(/\s+/g, ' ').trim() || '(no description)'
  let amount: number | null = null
  if (m.mode === 'amount') {
    const a = m.amount >= 0 ? parseAmount(row[m.amount] ?? '') : null
    if (a !== null) amount = m.expensesPositive ? -a : a
  } else {
    const d = m.debit >= 0 ? parseAmount(row[m.debit] ?? '') : null
    const c = m.credit >= 0 ? parseAmount(row[m.credit] ?? '') : null
    if (d !== null || c !== null) amount = Math.round((Math.abs(c ?? 0) - Math.abs(d ?? 0)) * 100) / 100
  }
  if (amount === null) return { error: 'No readable amount' }
  if (amount === 0) return { error: 'Zero amount' }
  const tx: Omit<Transaction, 'id'> = { date, amount, description, category: categorize(description, amount, rules) }
  if (account.trim()) tx.account = account.trim()
  return { tx }
}

export const dedupeKey = (t: Pick<Transaction, 'date' | 'amount' | 'description'>) =>
  `${t.date}|${t.amount.toFixed(2)}|${t.description.replace(/\s+/g, ' ').trim().toLowerCase()}`
