// OFX / QFX statement parser (pure, no I/O). Handles OFX 1.x SGML (leaf tags never closed) and OFX 2.x XML
// with one tolerant tag scanner, so truncated or slightly malformed files still yield every complete transaction.
import type { ISODate } from '../../db'
import { toISODate } from '../../lib/dates'

export interface OfxTransaction {
  type: string
  date: ISODate
  amount: number
  fitid: string
  /** Best human description: NAME, falling back to PAYEE then MEMO. */
  description: string
  memo: string
}

export interface OfxAccount {
  kind: 'bank' | 'card'
  /** Raw account id, kept only in memory for hashing. Never display it - use `masked`. */
  acctId: string
  masked: string
  acctType: string
  currency: string
  txs: OfxTransaction[]
  ledger?: { amount: number; date: ISODate | null }
}

export interface OfxParse {
  format: 'sgml' | 'xml'
  accounts: OfxAccount[]
  warnings: string[]
}

/** "1234567890" -> "••7890". Short ids are masked entirely down to what is safe to show. */
export function maskAccount(id: string): string {
  const d = id.replace(/\s+/g, '')
  if (!d) return ''
  return d.length <= 4 ? `••${d}` : `••${d.slice(-4)}`
}

export function isOfxText(text: string): boolean {
  return /<OFX[\s>]/i.test(text) || /OFXHEADER\s*:/i.test(text)
}

/** OFX date: YYYYMMDD[HHMMSS[.XXX]][offset:TZ]. The calendar date the bank printed is kept as-is (no timezone shift). */
export function parseOfxDate(raw: string): ISODate | null {
  const m = /^\s*(\d{4})(\d{2})(\d{2})(?:\d{2,6})?/.exec(raw)
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2200) return null
  const dt = new Date(y, mo - 1, d)
  if (dt.getMonth() !== mo - 1) return null
  return toISODate(dt)
}

/** Signed amount. Accepts "-12.50", "+3", "1,234.56", European "12,50", and "(5.00)". */
export function parseOfxAmount(raw: string): number | null {
  let s = raw.trim().replace(/[$\s]/g, '')
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) {
    neg = true
    s = s.slice(1, -1)
  }
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '')
  else if (/^[-+]?\d*,\d{1,2}$/.test(s)) s = s.replace(',', '.')
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round((neg ? -n : n) * 100) / 100
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, e: string) => {
      if (e[0] === '#') {
        const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all
      }
      return ENTITIES[e.toLowerCase()] ?? all
    })
    .replace(/\s+/g, ' ')
    .trim()
}

interface Draft {
  TRNTYPE?: string
  DTPOSTED?: string
  TRNAMT?: string
  FITID?: string
  NAME?: string
  PAYEE?: string
  MEMO?: string
}

export function parseOfx(input: string): OfxParse {
  const text = input.replace(/^﻿/, '')
  const warnings: string[] = []
  const start = text.search(/<OFX[\s>]/i)
  if (start < 0) throw new Error('That does not look like an OFX or QFX file (no <OFX> section found).')
  const body = text.slice(start)
  const format: OfxParse['format'] = /^<\?xml/i.test(text.trimStart()) || /<\/OFX>/i.test(body) && /<\/STMTTRN>/i.test(body) && /<\/TRNAMT>/i.test(body) ? 'xml' : 'sgml'

  const accounts: OfxAccount[] = []
  let acct = null as OfxAccount | null
  let draft = null as Draft | null
  let inLedger = false
  let ledgerAmt: string | undefined
  let ledgerDate: string | undefined
  let currencyStmt = ''
  let skipped = 0

  const ensureAcct = (kind: 'bank' | 'card') => {
    acct = { kind, acctId: '', masked: '', acctType: kind === 'card' ? 'CREDITCARD' : '', currency: currencyStmt || 'USD', txs: [] }
    accounts.push(acct)
    return acct
  }
  const flushLedger = () => {
    if (acct && ledgerAmt !== undefined) {
      const amount = parseOfxAmount(ledgerAmt)
      if (amount !== null) acct.ledger = { amount, date: ledgerDate ? parseOfxDate(ledgerDate) : null }
    }
    ledgerAmt = undefined
    ledgerDate = undefined
  }
  const finishTx = () => {
    if (!draft || !acct) {
      draft = null
      return
    }
    const d = draft
    draft = null
    const date = d.DTPOSTED ? parseOfxDate(d.DTPOSTED) : null
    const amount = d.TRNAMT ? parseOfxAmount(d.TRNAMT) : null
    if (!date || amount === null) {
      skipped++
      return
    }
    const description = d.NAME || d.PAYEE || d.MEMO || '(no description)'
    const fitid = (d.FITID ?? '').trim()
    acct.txs.push({ type: (d.TRNTYPE ?? '').toUpperCase(), date, amount, fitid, description, memo: d.MEMO ?? '' })
  }

  const re = /<(\/?)([A-Za-z][A-Za-z0-9._]*)\s*\/?>([^<]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body))) {
    const closing = m[1] === '/'
    const tag = m[2].toUpperCase()
    const value = m[3]
    if (closing) {
      if (tag === 'STMTTRN' || tag === 'CCSTMTTRN') finishTx()
      else if (tag === 'LEDGERBAL') {
        inLedger = false
        flushLedger()
      } else if (tag === 'STMTRS' || tag === 'CCSTMTRS') {
        finishTx()
        flushLedger()
      }
      continue
    }
    switch (tag) {
      case 'STMTRS':
        finishTx()
        flushLedger()
        ensureAcct('bank')
        continue
      case 'CCSTMTRS':
        finishTx()
        flushLedger()
        ensureAcct('card')
        continue
      case 'STMTTRN':
      case 'CCSTMTTRN':
        finishTx()
        if (!acct) ensureAcct(tag === 'CCSTMTTRN' ? 'card' : 'bank')
        draft = {}
        continue
      case 'LEDGERBAL':
        inLedger = true
        ledgerAmt = undefined
        ledgerDate = undefined
        continue
      default:
    }
    const v = value.trim()
    if (!v) continue
    if (tag === 'CURDEF') {
      currencyStmt = decode(v).toUpperCase()
      if (acct) acct.currency = currencyStmt
    } else if (tag === 'ACCTID' || tag === 'ACCTTYPE') {
      if (!acct) ensureAcct('bank')
      if (tag === 'ACCTID') {
        acct!.acctId = decode(v)
        acct!.masked = maskAccount(acct!.acctId)
      } else acct!.acctType = decode(v).toUpperCase()
    } else if (inLedger) {
      if (tag === 'BALAMT') ledgerAmt = v
      else if (tag === 'DTASOF') ledgerDate = v
    } else if (draft) {
      if (tag === 'TRNTYPE' || tag === 'DTPOSTED' || tag === 'TRNAMT' || tag === 'FITID' || tag === 'NAME' || tag === 'PAYEE' || tag === 'MEMO') {
        draft[tag] = tag === 'DTPOSTED' || tag === 'TRNAMT' ? v : decode(v)
      }
    }
  }
  finishTx()
  flushLedger()

  if (skipped > 0) warnings.push(`${skipped} transaction${skipped === 1 ? '' : 's'} had no readable date or amount and ${skipped === 1 ? 'was' : 'were'} left out.`)
  if (!/<\/OFX>/i.test(body)) warnings.push('The file ends early (it may be truncated). Everything readable before that point is included.')
  const total = accounts.reduce((s, a) => s + a.txs.length, 0)
  if (total === 0) warnings.push('No transactions were found in this file.')
  return { format, accounts, warnings }
}

/** Short stable hash for dedupe keys (FNV-1a, 32-bit, base36). Not security-relevant. */
export function shortHash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Dedupe key for an OFX row. The raw account number is hashed so it is never stored. */
export function ofxKey(acct: Pick<OfxAccount, 'acctId'>, fitid: string): string {
  return `${shortHash(acct.acctId)}:${fitid}`
}
