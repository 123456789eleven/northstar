import { describe, it, expect } from 'vitest'
import { db, getSetting, setSetting } from '../../db'
import { isLocalOnlySetting } from '../../sync/outbox'
import { buildBackup, importBackup } from '../../lib/backup'
import { DEFAULT_RULES } from '../finance/categories'
import { ACCESS_URL_KEY, FeedError, dateWindows, friendlyFeedError, syncGate } from './help'
import { balanceSnapshots, feedKey, mapAccounts, mergeResponses, parseAmount, postedToDate, splitNew, type SfinResponse } from './map'
import {
  buildAccountsUrl,
  decodeSetupToken,
  isAllowedOrigin,
  isSimplefinHost,
  parseSimplefinUrl,
  validateRequest,
} from '../../../supabase/functions/simplefin-relay/validate'

const resp: SfinResponse = {
  errors: ['Bank login needs attention'],
  accounts: [
    {
      id: 'ACT-1',
      name: 'Checking 1234',
      balance: '1500.25',
      org: { name: 'Big Bank' },
      transactions: [
        { id: 't1', posted: 1760000000, amount: '-12.50', description: 'STARBUCKS #123' },
        { id: 't2', posted: 1760086400, amount: '2500.00', description: 'PAYROLL DEPOSIT' },
        { id: 't3', posted: 1760100000, amount: '-5.00', description: 'Pending thing', pending: true },
        { id: 't1', posted: 1760000000, amount: '-12.50', description: 'STARBUCKS #123' },
        { id: 't4', posted: 1760000000, amount: 'abc', description: 'bad amount' },
        { posted: 1760000000, amount: '-1.00', description: 'no id' },
        { id: 't5', posted: 0, amount: '-9.00', description: 'not posted yet' },
        { id: 't6', posted: 1760000000, amount: '-3.00' },
      ],
    },
    { id: 'ACT-2', name: 'Rewards Credit Card', balance: '-420.10', org: { name: 'Card Co' }, transactions: [] },
    { name: 'broken' },
  ],
}

describe('mapAccounts', () => {
  const r = mapAccounts(resp, DEFAULT_RULES)
  it('keeps signed amounts and stable feed keys', () => {
    expect(r.rows.map((x) => x.fitid)).toEqual(['sfin:ACT-1:t1', 'sfin:ACT-1:t2', 'sfin:ACT-1:t6'])
    expect(r.rows[0].amount).toBe(-12.5)
    expect(r.rows[1].amount).toBe(2500)
    expect(r.rows[0].account).toBe('Big Bank Checking 1234')
  })
  it('counts pending, duplicates and unreadable rows', () => {
    expect(r.pending).toBe(2) // flagged pending + posted 0
    expect(r.duplicates).toBe(1)
    expect(r.invalid).toBe(2)
  })
  it('fills a missing description and survives garbage', () => {
    expect(r.rows[2].description).toBe('(no description)')
    expect(mapAccounts({} as SfinResponse, []).rows).toEqual([])
    expect(mapAccounts({ accounts: [{ id: 'x', transactions: null as never }] }, []).rows).toEqual([])
  })
  it('reads the bank date in UTC', () => {
    expect(postedToDate(1760000000)).toBe('2025-10-09')
    expect(postedToDate(0)).toBeNull()
    expect(postedToDate('nope')).toBeNull()
  })
})

describe('parseAmount / dedupe', () => {
  it('parses decimals only', () => {
    expect(parseAmount('-12.50')).toBe(-12.5)
    expect(parseAmount('1e3')).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount(NaN)).toBeNull()
  })
  it('splitNew never double counts a repeat sync', () => {
    const rows = mapAccounts(resp, []).rows
    const first = splitNew(rows, [])
    expect(first.fresh).toHaveLength(3)
    const second = splitNew(rows, rows.map((x) => x.fitid))
    expect(second.fresh).toHaveLength(0)
    expect(second.already).toBe(3)
    expect(feedKey('a', 'b')).toBe('sfin:a:b')
  })
  it('merges overlapping windows by account', () => {
    const m = mergeResponses([resp, resp])
    expect(m.accounts?.find((a) => a.id === 'ACT-1')?.transactions).toHaveLength(16)
    expect(splitNew(mapAccounts(m, []).rows, []).fresh).toHaveLength(3)
  })
  it('records balances, liabilities as positive', () => {
    const b = balanceSnapshots(resp, '2025-10-30')
    expect(b).toEqual([
      { date: '2025-10-30', name: 'Big Bank Checking 1234', kind: 'asset', balance: 1500.25 },
      { date: '2025-10-30', name: 'Card Co Rewards Credit Card', kind: 'liability', balance: 420.1 },
    ])
  })
})

describe('friendlyFeedError', () => {
  it('maps each status to plain words without leaking anything', () => {
    expect(friendlyFeedError(new FeedError(0))).toMatch(/Can't reach/)
    expect(friendlyFeedError(new FeedError(404))).toMatch(/not deployed/)
    expect(friendlyFeedError(new FeedError(401))).toMatch(/not signed in/)
    expect(friendlyFeedError(new FeedError(402))).toMatch(/Setup Token/)
    expect(friendlyFeedError(new FeedError(403))).toMatch(/already used or revoked/)
    expect(friendlyFeedError(new FeedError(429))).toMatch(/24 a day/)
    expect(friendlyFeedError(new FeedError(500))).toMatch(/problem/)
    expect(friendlyFeedError(new Error('https://u:p@x.simplefin.org'))).toBe('Something went wrong. Try again.')
  })
})

describe('pacing and windows', () => {
  const now = Date.parse('2025-10-30T12:00:00Z')
  it('blocks within 6h unless forced, and over the daily budget', () => {
    expect(syncGate(new Date(now - 3_600_000).toISOString(), [], now, false).allowed).toBe(false)
    expect(syncGate(new Date(now - 3_600_000).toISOString(), [], now, true).allowed).toBe(true)
    expect(syncGate(new Date(now - 7 * 3_600_000).toISOString(), [], now, false).allowed).toBe(true)
    expect(syncGate(undefined, Array(24).fill(now - 1000), now, true).allowed).toBe(false)
    expect(syncGate(undefined, Array(20).fill(now - 1000), now, true, 5).allowed).toBe(false)
  })
  it('splits a year into 90 day windows', () => {
    const w = dateWindows(now, 365)
    expect(w).toHaveLength(5)
    expect(w.every((x) => x.end - x.start <= 90 * 86400)).toBe(true)
    expect(w.at(-1)!.end).toBe(Math.floor(now / 1000))
    expect(dateWindows(now, 90)).toHaveLength(1)
  })
})

describe('secret handling', () => {
  it('simplefin.* settings never sync', () => {
    expect(isLocalOnlySetting(ACCESS_URL_KEY)).toBe(true)
    expect(isLocalOnlySetting('simplefin.status')).toBe(true)
  })
  it('the access URL is not in a backup and survives a restore', async () => {
    await setSetting(ACCESS_URL_KEY, 'https://u:p@beta-bridge.simplefin.org/simplefin')
    await setSetting('theme', 'dark')
    const b = await buildBackup()
    expect(JSON.stringify(b)).not.toContain('beta-bridge')
    await importBackup(b)
    expect(await getSetting(ACCESS_URL_KEY, '')).toContain('beta-bridge')
    expect(await getSetting('theme', '')).toBe('dark')
    expect(await db.settings.count()).toBeGreaterThan(1)
  })
})

describe('relay validation (shared with the Edge Function)', () => {
  it('allows only simplefin.org hosts', () => {
    expect(isSimplefinHost('beta-bridge.simplefin.org')).toBe(true)
    expect(isSimplefinHost('simplefin.org')).toBe(true)
    expect(isSimplefinHost('evilsimplefin.org')).toBe(false)
    expect(isSimplefinHost('simplefin.org.evil.com')).toBe(false)
    expect(isSimplefinHost('simplefin.org.')).toBe(false)
  })
  it('splits credentials out of an access URL', () => {
    const r = parseSimplefinUrl('https://us%40er:p%3Aw@beta-bridge.simplefin.org/simplefin/', true)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.target.url).toBe('https://beta-bridge.simplefin.org/simplefin')
      expect(r.target.authorization).toBe('Basic ' + btoa('us@er:p:w'))
    }
  })
  it('rejects http, other hosts, ports, missing/unwanted credentials, junk', () => {
    const bad = (u: unknown, c = true) => expect(parseSimplefinUrl(u, c).ok).toBe(false)
    bad('http://u:p@beta-bridge.simplefin.org/x')
    bad('https://u:p@evil.com/x')
    bad('https://u:p@beta-bridge.simplefin.org:8443/x')
    bad('https://u:p@127.0.0.1/x')
    bad('https://u:p@beta-bridge.simplefin.org@evil.com/x')
    bad('https://beta-bridge.simplefin.org/x')
    bad('https://u:p@beta-bridge.simplefin.org/claim/abc', false)
    bad('https://u:p@beta-bridge.simplefin.org/x#frag')
    bad('x'.repeat(2049))
    bad(42)
    expect(parseSimplefinUrl('https://beta-bridge.simplefin.org/simplefin/claim/ABC', false).ok).toBe(true)
  })
  it('decodes setup tokens', () => {
    const url = 'https://beta-bridge.simplefin.org/simplefin/claim/ABC123'
    expect(decodeSetupToken(btoa(url))).toBe(url)
    expect(decodeSetupToken(btoa(url).replace(/=+$/, ''))).toBe(url)
    expect(decodeSetupToken('not base64!')).toBeNull()
    expect(decodeSetupToken('')).toBeNull()
    expect(decodeSetupToken(5)).toBeNull()
  })
  it('validates request bodies strictly', () => {
    expect(validateRequest({ action: 'claim', setupToken: 'abc' }).ok).toBe(true)
    expect(validateRequest({ action: 'claim', setupToken: 'abc', extra: 1 }).ok).toBe(false)
    expect(validateRequest({ action: 'claim', setupToken: 'a'.repeat(2049) }).ok).toBe(false)
    expect(validateRequest({ action: 'accounts', accessUrl: 'https://x', startDate: 1, endDate: 2 }).ok).toBe(true)
    expect(validateRequest({ action: 'accounts', accessUrl: 'https://x', startDate: '1' }).ok).toBe(false)
    expect(validateRequest({ action: 'accounts', accessUrl: 'https://x', startDate: 10, endDate: 5 }).ok).toBe(false)
    expect(validateRequest({ action: 'accounts', accessUrl: 'https://x', startDate: 0, endDate: 400 * 86400 }).ok).toBe(false)
    expect(validateRequest({ action: 'delete' }).ok).toBe(false)
    expect(validateRequest([]).ok).toBe(false)
    expect(validateRequest(null).ok).toBe(false)
  })
  it('builds the accounts url and checks origins', () => {
    expect(buildAccountsUrl('https://b.simplefin.org/simplefin', 100, 200)).toBe('https://b.simplefin.org/simplefin/accounts?start-date=100&end-date=200')
    expect(buildAccountsUrl('https://b.simplefin.org/simplefin')).toBe('https://b.simplefin.org/simplefin/accounts')
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
    expect(isAllowedOrigin('*')).toBe(false)
    expect(isAllowedOrigin(null)).toBe(false)
  })
})
