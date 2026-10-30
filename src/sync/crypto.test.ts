import { describe, expect, it } from 'vitest'
import {
  createVault, decryptRecord, DecryptError, deterministicId, encryptRecord, KDF_ITERATIONS, normalizeRecoveryCode,
  resetPassphrase, unlockWithPassphrase, unlockWithRecoveryCode, WrongSecretError,
} from './crypto'

const FAST = { unsafeTestIterations: 1000 }
const PASS = 'correct horse battery staple'

describe('vault crypto', () => {
  it('defaults to at least 600k PBKDF2 iterations and stores only wrapped keys', async () => {
    const v = await createVault(PASS)
    expect(v.meta.iterations).toBeGreaterThanOrEqual(KDF_ITERATIONS)
    expect(JSON.stringify(v.meta)).not.toContain(PASS)
    expect(v.recoveryCode).toMatch(/^([0-9A-Z]{5}-){5}[0-9A-Z]{5}$/)
    const keys = await unlockWithPassphrase(v.meta, PASS)
    const box = await encryptRecord(v.keys, 'tasks', 'r1', { a: 1 })
    expect(await decryptRecord(keys, 'tasks', 'r1', box.ciphertext, box.nonce)).toEqual({ a: 1 })
    expect(keys.dataKey.extractable).toBe(false)
    expect(keys.idKey.extractable).toBe(false)
  }, 30_000)

  it('refuses vaults with fewer iterations than the floor', async () => {
    const v = await createVault(PASS, FAST)
    await expect(unlockWithPassphrase(v.meta, PASS)).rejects.toThrow(/weaker/)
  })

  it('record payloads round trip and the ciphertext hides the plaintext', async () => {
    const v = await createVault(PASS, FAST)
    const box = await encryptRecord(v.keys, 'journal', 'abc', { updatedAt: 't', data: { text: 'secret diary' } })
    expect(box.ciphertext).not.toContain('secret')
    expect(await decryptRecord(v.keys, 'journal', 'abc', box.ciphertext, box.nonce)).toEqual({ updatedAt: 't', data: { text: 'secret diary' } })
  })

  it('wrong passphrase and wrong recovery code fail with WrongSecretError; recovery code and passphrase reset work', async () => {
    const v = await createVault(PASS)
    await expect(unlockWithPassphrase(v.meta, 'not the passphrase at all')).rejects.toBeInstanceOf(WrongSecretError)
    await expect(unlockWithRecoveryCode(v.meta, 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA')).rejects.toBeInstanceOf(WrongSecretError)

    // Lower-case, spaces and look-alike letters are accepted.
    const sloppy = v.recoveryCode.toLowerCase().replace(/-/g, ' ')
    const viaCode = await unlockWithRecoveryCode(v.meta, sloppy)
    const box = await encryptRecord(v.keys, 'people', 'p', { n: 'Ann' })
    expect(await decryptRecord(viaCode, 'people', 'p', box.ciphertext, box.nonce)).toEqual({ n: 'Ann' })

    const meta2 = await resetPassphrase(v.meta, v.recoveryCode, 'a brand new passphrase')
    await expect(unlockWithPassphrase(meta2, PASS)).rejects.toBeInstanceOf(WrongSecretError)
    const viaNew = await unlockWithPassphrase(meta2, 'a brand new passphrase')
    expect(await decryptRecord(viaNew, 'people', 'p', box.ciphertext, box.nonce)).toEqual({ n: 'Ann' })
    expect(await unlockWithRecoveryCode(meta2, v.recoveryCode)).toBeTruthy()
  }, 60_000)

  it('rejects ciphertext moved to another row or table (AAD), tampering, and a different key', async () => {
    const v = await createVault(PASS, FAST)
    const other = await createVault(PASS, FAST)
    const box = await encryptRecord(v.keys, 'transactions', 'row-1', { amount: -5 })
    await expect(decryptRecord(v.keys, 'transactions', 'row-2', box.ciphertext, box.nonce)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptRecord(v.keys, 'budgets', 'row-1', box.ciphertext, box.nonce)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptRecord(other.keys, 'transactions', 'row-1', box.ciphertext, box.nonce)).rejects.toBeInstanceOf(DecryptError)
    const bytes = atob(box.ciphertext).split('')
    bytes[0] = String.fromCharCode(bytes[0].charCodeAt(0) ^ 1)
    await expect(decryptRecord(v.keys, 'transactions', 'row-1', btoa(bytes.join('')), box.nonce)).rejects.toBeInstanceOf(DecryptError)
    await expect(decryptRecord(v.keys, 'transactions', 'row-1', 'not base64!', box.nonce)).rejects.toBeInstanceOf(DecryptError)
  })

  it('uses a fresh nonce per encryption', async () => {
    const v = await createVault(PASS, FAST)
    const a = await encryptRecord(v.keys, 't', 'r', { x: 1 })
    const b = await encryptRecord(v.keys, 't', 'r', { x: 1 })
    expect(a.nonce).not.toBe(b.nonce)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('deterministic ids are stable per vault, differ across vaults and tables, and hide the input', async () => {
    const v = await createVault(PASS, FAST)
    const w = await createVault(PASS, FAST)
    const id = await deterministicId(v.keys, 'budgets', 'Dining')
    expect(await deterministicId(v.keys, 'budgets', 'Dining')).toBe(id)
    expect(await deterministicId(v.keys, 'reviews', 'Dining')).not.toBe(id)
    expect(await deterministicId(w.keys, 'budgets', 'Dining')).not.toBe(id)
    expect(id).not.toContain('Dining')
  })

  it('rejects short passphrases and normalizes recovery codes', async () => {
    await expect(createVault('short', FAST)).rejects.toThrow(/at least/)
    expect(normalizeRecoveryCode('ab-cd o il')).toBe('ABCD011')
  })
})
