// Passphrase-encrypted backup file. WebCrypto only; everything stays on this device.
//   key  = PBKDF2-SHA256(passphrase, random 16-byte salt, 600k iterations) -> AES-GCM-256
//   data = AES-GCM(random 12-byte iv, aad 'northstar-backup-v1', gzip(plain backup JSON) when CompressionStream exists)
// The passphrase is never stored or written. Plain JSON is only ever held in memory.
// Reuses only the base64 helpers from the sync crypto module (read-only); sync key handling is untouched.
import { b64, unb64 } from '../sync/crypto'
import { buildBackup, downloadBlob, markBackup, MAX_BACKUP_BYTES, parseBackupText, type BackupFile, type ParsedBackup } from './backup'
import { today } from './dates'

export const ENC_ITERATIONS = 600_000
/** Import refuses files declaring fewer iterations than this (blocks a downgrade by editing the header). */
export const ENC_MIN_ITERATIONS = 100_000
const ENC_MAX_ITERATIONS = 10_000_000
export const ENC_MIN_PASSPHRASE = 12
export const ENC_AAD = 'northstar-backup-v1'

export interface EncryptedBackupFile {
  app: 'northstar'
  kind: 'encrypted-backup'
  v: 1
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string }
  cipher: { name: 'AES-GCM'; iv: string }
  aad: typeof ENC_AAD
  data: string
}

export class BackupCryptoError extends Error {
  readonly code: 'format' | 'version' | 'kdf' | 'decrypt'
  constructor(msg: string, code: 'format' | 'version' | 'kdf' | 'decrypt') {
    super(msg)
    this.name = 'BackupCryptoError'
    this.code = code
  }
}

const te = new TextEncoder()
const subtle = () => globalThis.crypto.subtle

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', te.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(out).arrayBuffer())
}
const canGzip = () => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
const isGzip = (u: Uint8Array) => u.length > 2 && u[0] === 0x1f && u[1] === 0x8b

/** Encrypts a backup object. Only tests may lower the iteration count. */
export async function encryptBackup(backup: BackupFile, passphrase: string, opts: { unsafeTestIterations?: number } = {}): Promise<EncryptedBackupFile> {
  if (passphrase.length < ENC_MIN_PASSPHRASE) throw new Error(`Use a passphrase of at least ${ENC_MIN_PASSPHRASE} characters.`)
  const iterations = opts.unsafeTestIterations ?? ENC_ITERATIONS
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16))
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12))
  let plain: Uint8Array<ArrayBuffer> = te.encode(JSON.stringify(backup))
  if (canGzip()) plain = await pipe(plain, new CompressionStream('gzip'))
  const key = await deriveKey(passphrase, salt, iterations)
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(ENC_AAD) }, key, plain)
  return {
    app: 'northstar', kind: 'encrypted-backup', v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: b64(salt) },
    cipher: { name: 'AES-GCM', iv: b64(iv) },
    aad: ENC_AAD,
    data: b64(ct),
  }
}

/** True when the text is an encrypted Northstar backup envelope (cheap sniff, no validation). */
export function isEncryptedBackupText(text: string): boolean {
  if (!text.includes('encrypted-backup')) return false
  try {
    const o = JSON.parse(text) as Partial<EncryptedBackupFile> | null
    return !!o && o.app === 'northstar' && o.kind === 'encrypted-backup'
  } catch {
    return false
  }
}

const damaged = () => new BackupCryptoError('This backup file is damaged or incomplete.', 'format')

function b64Bytes(s: unknown, len?: number): Uint8Array<ArrayBuffer> {
  if (typeof s !== 'string') throw damaged()
  let u: Uint8Array<ArrayBuffer>
  try { u = unb64(s) } catch { throw damaged() }
  if (len !== undefined && u.length !== len) throw damaged()
  return u
}

/** Validates the envelope only (no passphrase needed). */
export function parseEnvelope(text: string): EncryptedBackupFile {
  let o: Partial<EncryptedBackupFile> | null
  try { o = JSON.parse(text) } catch { throw damaged() }
  if (!o || typeof o !== 'object' || o.app !== 'northstar' || o.kind !== 'encrypted-backup') throw new BackupCryptoError('This is not an encrypted Northstar backup.', 'format')
  if (o.v !== 1) throw new BackupCryptoError('This backup uses a newer or unknown encrypted format. Update Northstar first.', 'version')
  if (o.aad !== ENC_AAD || o.cipher?.name !== 'AES-GCM' || o.kdf?.name !== 'PBKDF2' || o.kdf?.hash !== 'SHA-256') throw new BackupCryptoError('This backup uses encryption settings Northstar does not recognise.', 'format')
  const it = o.kdf.iterations
  if (!Number.isInteger(it) || it < ENC_MIN_ITERATIONS) throw new BackupCryptoError('This backup declares weaker key settings than Northstar allows, so it will not be opened.', 'kdf')
  if (it > ENC_MAX_ITERATIONS) throw new BackupCryptoError('This backup declares an unreasonable key setting, so it will not be opened.', 'kdf')
  b64Bytes(o.kdf.salt, 16)
  b64Bytes(o.cipher.iv, 12)
  if (typeof o.data !== 'string' || o.data.length < 24) throw damaged()
  return o as EncryptedBackupFile
}

/** Decrypts an envelope. A wrong passphrase and any tampering give the same clean error. */
export async function decryptEnvelope(env: EncryptedBackupFile, passphrase: string): Promise<unknown> {
  const salt = b64Bytes(env.kdf.salt, 16)
  const iv = b64Bytes(env.cipher.iv, 12)
  const ct = b64Bytes(env.data)
  const fail = () => new BackupCryptoError('Wrong passphrase or damaged file.', 'decrypt')
  let plain: Uint8Array<ArrayBuffer>
  try {
    const key = await deriveKey(passphrase, salt, env.kdf.iterations)
    plain = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: te.encode(env.aad) }, key, ct))
    if (isGzip(plain)) {
      if (!canGzip()) throw new BackupCryptoError('This browser cannot unpack the backup (no gzip support).', 'format')
      plain = await pipe(plain, new DecompressionStream('gzip'))
    }
  } catch (e) {
    if (e instanceof BackupCryptoError) throw e
    throw fail()
  }
  try {
    return JSON.parse(new TextDecoder().decode(plain))
  } catch {
    throw fail()
  }
}

/** Decrypts encrypted-backup text and validates it exactly like a plain backup. */
export async function openEncryptedBackupText(text: string, passphrase: string): Promise<ParsedBackup> {
  if (text.length > MAX_BACKUP_BYTES * 2) throw new BackupCryptoError('This file is too large for a Northstar backup.', 'format')
  const env = parseEnvelope(text)
  return parseBackupText(JSON.stringify(await decryptEnvelope(env, passphrase)))
}

/** Builds, encrypts and downloads a backup. The plain JSON is never written to disk. */
export async function exportEncryptedBackup(passphrase: string): Promise<BackupFile> {
  await markBackup(true)
  const data = await buildBackup()
  const env = await encryptBackup(data, passphrase)
  downloadBlob(new Blob([JSON.stringify(env)], { type: 'application/json' }), `northstar-backup-${today()}.enc.json`)
  return data
}

/** Plain-language strength hint. Length matters most; this is guidance, not a guarantee. */
export function passphraseHint(p: string): { level: 'short' | 'ok' | 'good' | 'strong'; text: string } {
  if (p.length < ENC_MIN_PASSPHRASE) return { level: 'short', text: `Too short: ${p.length} of ${ENC_MIN_PASSPHRASE} characters.` }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length
  const words = p.trim().split(/\s+/).length
  if (p.length >= 20 || (words >= 4 && p.length >= 16)) return { level: 'strong', text: 'Strong. A few random words in a row works well.' }
  if (p.length >= 16 || classes >= 3) return { level: 'good', text: 'Good. Longer is better.' }
  return { level: 'ok', text: 'Acceptable. Adding another word makes it much harder to guess.' }
}
