// End-to-end encryption for the optional cloud sync. WebCrypto only, no third-party crypto.
//
// Key hierarchy:
//   master key (32 random bytes, generated on the first device, never leaves any device unwrapped)
//     wrapped (AES-KW) by a key derived from the passphrase   (PBKDF2-SHA256, >= 600k iterations, random salt)
//     wrapped (AES-KW) by a key derived from the recovery code (same KDF, its own salt)
//   from the master key, via HKDF-SHA256:
//     dataKey: AES-GCM-256, encrypts each record (fresh 96-bit nonce, AAD binds table + record id)
//     idKey:   HMAC-SHA256, derives deterministic record ids for naturally-unique rows (budget category, setting key...)
// Both derived keys are non-extractable. The cloud only ever stores the wrapped master key, salts and ciphertext.

export const KDF_ITERATIONS = 600_000
export const MIN_PASSPHRASE = 12
const VERSION = 1
const enc = new TextEncoder()
const dec = new TextDecoder()

export interface VaultMeta {
  version: number
  kdf: 'PBKDF2-SHA256'
  iterations: number
  /** base64 */
  salt: string
  wrappedKey: string
  recoverySalt: string
  wrappedKeyRecovery: string
}

export interface VaultKeys {
  dataKey: CryptoKey
  idKey: CryptoKey
}

export class WrongSecretError extends Error {
  constructor(what: 'passphrase' | 'recovery code') {
    super(what === 'passphrase' ? 'That passphrase does not unlock this vault.' : 'That recovery code does not unlock this vault.')
    this.name = 'WrongSecretError'
  }
}

export class DecryptError extends Error {
  constructor(msg = 'A cloud record failed to decrypt. It may have been altered, or it belongs to a different key.') {
    super(msg)
    this.name = 'DecryptError'
  }
}

const subtle = () => globalThis.crypto.subtle

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i])
  return btoa(s)
}

export function unb64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const random = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n))

// Crockford base32: no I, L, O, U, so the code survives being written down by hand.
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 30 symbols x 5 bits = 150 bits of entropy, shown as six groups of five. */
export function generateRecoveryCode(): string {
  const bytes = random(30)
  const chars = Array.from(bytes, (b) => B32[b & 31]).join('')
  return chars.match(/.{5}/g)!.join('-')
}

export function normalizeRecoveryCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1')
}

function normalizePassphrase(p: string) {
  return p.normalize('NFC')
}

async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-KW', length: 256 }, false, ['wrapKey', 'unwrapKey'])
}

async function wrapMaster(master: CryptoKey, secret: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const kek = await deriveKek(secret, salt, iterations)
  return b64(await subtle().wrapKey('raw', master, kek, 'AES-KW'))
}

async function deriveVaultKeys(hkdfBase: CryptoKey): Promise<VaultKeys> {
  const salt = enc.encode('northstar-vault-v1')
  const dataKey = await subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('record-encryption') }, hkdfBase, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
  const idKey = await subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('record-ids') }, hkdfBase, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign'])
  return { dataKey, idKey }
}

function checkMeta(meta: VaultMeta) {
  if (meta.version !== VERSION || meta.kdf !== 'PBKDF2-SHA256') throw new Error('This vault uses a format this version of Northstar does not understand.')
  if (!Number.isInteger(meta.iterations) || meta.iterations < KDF_ITERATIONS) throw new Error('This vault uses weaker key settings than Northstar allows, so it will not be unlocked.')
}

export interface CreatedVault {
  meta: VaultMeta
  recoveryCode: string
  keys: VaultKeys
}

/** Creates a fresh vault. `iterations` may only be raised above the default (tests pass a lower value via the test-only option). */
export async function createVault(passphrase: string, opts: { iterations?: number; unsafeTestIterations?: number } = {}): Promise<CreatedVault> {
  const pass = normalizePassphrase(passphrase)
  if (pass.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
  const iterations = opts.unsafeTestIterations ?? Math.max(KDF_ITERATIONS, opts.iterations ?? KDF_ITERATIONS)
  const raw = random(32)
  const master = await subtle().importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt'])
  const hkdf = await subtle().importKey('raw', raw, 'HKDF', false, ['deriveKey'])
  raw.fill(0)
  const recoveryCode = generateRecoveryCode()
  const salt = random(16)
  const recoverySalt = random(16)
  const meta: VaultMeta = {
    version: VERSION,
    kdf: 'PBKDF2-SHA256',
    iterations,
    salt: b64(salt),
    wrappedKey: await wrapMaster(master, pass, salt, iterations),
    recoverySalt: b64(recoverySalt),
    wrappedKeyRecovery: await wrapMaster(master, normalizeRecoveryCode(recoveryCode), recoverySalt, iterations),
  }
  return { meta, recoveryCode, keys: await deriveVaultKeys(hkdf) }
}

async function unwrapWith(meta: VaultMeta, secret: string, which: 'passphrase' | 'recovery code', extractableAes: boolean): Promise<CryptoKey> {
  const salt = unb64(which === 'passphrase' ? meta.salt : meta.recoverySalt)
  const wrapped = unb64(which === 'passphrase' ? meta.wrappedKey : meta.wrappedKeyRecovery)
  const kek = await deriveKek(secret, salt, meta.iterations)
  try {
    // AES-KW has a built-in integrity check: a wrong secret fails here instead of yielding a garbage key.
    return extractableAes
      ? await subtle().unwrapKey('raw', wrapped, kek, 'AES-KW', { name: 'AES-GCM' }, true, ['encrypt'])
      : await subtle().unwrapKey('raw', wrapped, kek, 'AES-KW', 'HKDF', false, ['deriveKey'])
  } catch {
    throw new WrongSecretError(which)
  }
}

export async function unlockWithPassphrase(meta: VaultMeta, passphrase: string): Promise<VaultKeys> {
  checkMeta(meta)
  return deriveVaultKeys(await unwrapWith(meta, normalizePassphrase(passphrase), 'passphrase', false))
}

export async function unlockWithRecoveryCode(meta: VaultMeta, code: string): Promise<VaultKeys> {
  checkMeta(meta)
  return deriveVaultKeys(await unwrapWith(meta, normalizeRecoveryCode(code), 'recovery code', false))
}

/** Uses the recovery code to set a new passphrase. Returns the updated meta (recovery code keeps working). */
export async function resetPassphrase(meta: VaultMeta, code: string, newPassphrase: string): Promise<VaultMeta> {
  checkMeta(meta)
  const pass = normalizePassphrase(newPassphrase)
  if (pass.length < MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${MIN_PASSPHRASE} characters.`)
  const master = await unwrapWith(meta, normalizeRecoveryCode(code), 'recovery code', true)
  const salt = random(16)
  return { ...meta, salt: b64(salt), wrappedKey: await wrapMaster(master, pass, salt, meta.iterations) }
}

function aad(table: string, recordId: string) {
  return enc.encode(`northstar:v1|${table}|${recordId}`)
}

export async function encryptRecord(keys: VaultKeys, table: string, recordId: string, payload: unknown): Promise<{ ciphertext: string; nonce: string }> {
  const iv = random(12)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(table, recordId) }, keys.dataKey, enc.encode(JSON.stringify(payload)))
  return { ciphertext: b64(ct), nonce: b64(iv) }
}

/** Throws DecryptError on any failure (tampering, wrong key, moved between rows, malformed base64). */
export async function decryptRecord(keys: VaultKeys, table: string, recordId: string, ciphertext: string, nonce: string): Promise<unknown> {
  try {
    const iv = unb64(nonce)
    if (iv.length !== 12) throw new Error('bad nonce')
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: aad(table, recordId) }, keys.dataKey, unb64(ciphertext))
    return JSON.parse(dec.decode(pt))
  } catch {
    throw new DecryptError()
  }
}

/** Deterministic, keyed record id: equal inputs on two devices give the same id, and the server learns nothing from it. */
export async function deterministicId(keys: VaultKeys, table: string, naturalKey: string): Promise<string> {
  const sig = await subtle().sign('HMAC', keys.idKey, enc.encode(`${table}\u0000${naturalKey}`))
  return 'd' + b64(new Uint8Array(sig).slice(0, 18)).replace(/\+/g, '-').replace(/\//g, '_')
}
