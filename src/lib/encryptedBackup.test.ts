import { describe, expect, it } from 'vitest'
import { db } from '../db'
import { buildBackup, eraseAll, importBackup, BACKUP_LAST_KEY } from './backup'
import { encryptBackup, decryptEnvelope, isEncryptedBackupText, openEncryptedBackupText, parseEnvelope, passphraseHint, ENC_ITERATIONS, type EncryptedBackupFile } from './encryptedBackup'
import { isLocalOnlySetting } from '../sync/outbox'
import { b64, unb64 } from '../sync/crypto'

const T = '2026-03-01T10:00:00.000Z'
const PASS = 'correct horse battery staple'
const FAST = { unsafeTestIterations: 100_000 }

async function seed() {
  await db.tasks.add({ title: 'Secret Fixture Task Zebra', priority: 1, status: 'open', recurrence: 'none', createdAt: T })
  await db.transactions.add({ date: '2026-03-01', amount: -12.34, description: 'CHIPOTLE UNIQUEMARKER', category: 'Dining', account: 'Checking' })
  await db.balances.add({ date: '2026-03-01', name: 'Checking', kind: 'asset', balance: 1000.5 })
  await db.weights.add({ date: '2026-03-01', weight: 135.4, note: 'morning' })
  await db.holdings.add({ account: 'Example Roth IRA (VTI)', ticker: 'VTI', shares: 100.5, price: 312.45, priceDate: '2026-03-01', costBasis: 28000, note: 'x' })
  await db.contributions.add({ date: '2026-03-01', amount: 500, account: 'Example Roth IRA (VTI)', kind: 'contribution' })
  await db.journal.add({ date: '2026-03-02', mood: 4, text: 'ok day', tags: ['a'], createdAt: T })
  await db.settings.put({ key: BACKUP_LAST_KEY, value: T })
}
const snapshot = async () => Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.toArray()])))
const text = (e: unknown) => JSON.stringify(e)
const flip = (s: string, i: number) => (s[i] === 'A' ? 'B' : 'A')

describe('encrypted backup', () => {
  it('round-trips every table at the production iteration count', async () => {
    await seed()
    const before = await snapshot()
    const env = await encryptBackup(await buildBackup(), PASS)
    expect(env).toMatchObject({ app: 'northstar', kind: 'encrypted-backup', v: 1, aad: 'northstar-backup-v1' })
    expect(env.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: ENC_ITERATIONS })
    expect(unb64(env.kdf.salt).length).toBe(16)
    expect(unb64(env.cipher.iv).length).toBe(12)
    await eraseAll()
    const parsed = await openEncryptedBackupText(text(env), PASS)
    await importBackup(parsed.data)
    expect(await snapshot()).toEqual(before)
  })

  it('detects the format', async () => {
    const env = await encryptBackup(await buildBackup(), PASS, FAST)
    expect(isEncryptedBackupText(text(env))).toBe(true)
    expect(isEncryptedBackupText(text(await buildBackup()))).toBe(false)
    expect(isEncryptedBackupText('not json encrypted-backup')).toBe(false)
  })

  it('wrong passphrase fails cleanly', async () => {
    await seed()
    const env = await encryptBackup(await buildBackup(), PASS, FAST)
    await expect(decryptEnvelope(env, 'another long passphrase')).rejects.toThrow('Wrong passphrase or damaged file.')
  })

  it('tampered ciphertext, iv, salt and header iterations all fail', async () => {
    await seed()
    const env = await encryptBackup(await buildBackup(), PASS, FAST)
    const mid = Math.floor(env.data.length / 2)
    const bad: EncryptedBackupFile[] = [
      { ...env, data: env.data.slice(0, mid) + flip(env.data, mid) + env.data.slice(mid + 1) },
      { ...env, cipher: { ...env.cipher, iv: b64(new Uint8Array(12)) } },
      { ...env, kdf: { ...env.kdf, salt: b64(new Uint8Array(16)) } },
      { ...env, kdf: { ...env.kdf, iterations: env.kdf.iterations + 1 } },
    ]
    for (const b of bad) await expect(openEncryptedBackupText(text(b), PASS)).rejects.toThrow('Wrong passphrase or damaged file.')
  })

  it('truncated file fails cleanly', async () => {
    const env = await encryptBackup(await buildBackup(), PASS, FAST)
    const t = text(env)
    await expect(openEncryptedBackupText(t.slice(0, t.length - 30), PASS)).rejects.toThrow(/damaged/)
    await expect(openEncryptedBackupText(text({ ...env, data: env.data.slice(0, 20) }), PASS)).rejects.toThrow(/damaged/)
  })

  it('rejects wrong kind, wrong version, odd salt/iv lengths', async () => {
    const env = await encryptBackup(await buildBackup(), PASS, FAST)
    expect(() => parseEnvelope(text({ ...env, kind: 'backup' }))).toThrow(/not an encrypted/)
    expect(() => parseEnvelope(text({ ...env, app: 'other' }))).toThrow(/not an encrypted/)
    expect(() => parseEnvelope(text({ ...env, v: 2 }))).toThrow(/newer or unknown/)
    expect(() => parseEnvelope(text({ ...env, aad: 'x' }))).toThrow(/does not recognise/)
    expect(() => parseEnvelope(text({ ...env, kdf: { ...env.kdf, salt: b64(new Uint8Array(8)) } }))).toThrow(/damaged/)
    expect(() => parseEnvelope(text({ ...env, cipher: { ...env.cipher, iv: b64(new Uint8Array(16)) } }))).toThrow(/damaged/)
  })

  it('enforces the iteration floor on import', async () => {
    const env = await encryptBackup(await buildBackup(), PASS, { unsafeTestIterations: 1000 })
    await expect(openEncryptedBackupText(text(env), PASS)).rejects.toThrow(/weaker key settings/)
    expect(() => parseEnvelope(text({ ...env, kdf: { ...env.kdf, iterations: 99_999 } }))).toThrow(/weaker/)
    expect(() => parseEnvelope(text({ ...env, kdf: { ...env.kdf, iterations: 100_000 } }))).not.toThrow()
    expect(() => parseEnvelope(text({ ...env, kdf: { ...env.kdf, iterations: 1e12 } }))).toThrow(/unreasonable/)
  })

  it('refuses short passphrases at export', async () => {
    await expect(encryptBackup(await buildBackup(), 'short', FAST)).rejects.toThrow(/at least 12/)
  })

  it('salts and ivs differ for identical data; no plaintext or passphrase in the output', async () => {
    await seed()
    const backup = await buildBackup()
    const a = await encryptBackup(backup, PASS, FAST)
    const b = await encryptBackup(backup, PASS, FAST)
    expect(a.kdf.salt).not.toBe(b.kdf.salt)
    expect(a.cipher.iv).not.toBe(b.cipher.iv)
    expect(a.data).not.toBe(b.data)
    const out = text(a)
    const raw = new TextDecoder('latin1').decode(unb64(a.data))
    for (const needle of ['UNIQUEMARKER', 'Zebra', 'CHIPOTLE', 'transactions', 'Roth']) {
      expect(out).not.toContain(needle)
      expect(raw).not.toContain(needle)
    }
    expect(out).not.toContain(PASS)
    expect(out).not.toContain(b64(new TextEncoder().encode(PASS)))
    expect(raw).not.toContain(PASS)
  })

  it('backup.* settings are device-local and never sync', () => {
    for (const k of ['backup.lastAt', 'backup.lastEncrypted', 'backup.reminderDays']) expect(isLocalOnlySetting(k)).toBe(true)
  })

  it('strength hint is plain', () => {
    expect(passphraseHint('abc').level).toBe('short')
    expect(passphraseHint('abcdefghijkl').level).toBe('ok')
    expect(passphraseHint('four random words here ok').level).toBe('strong')
  })
})
