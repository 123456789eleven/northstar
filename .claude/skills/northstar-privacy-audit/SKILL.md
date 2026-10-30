---
name: northstar-privacy-audit
description: Use before releases and whenever code touches storage, imports, networking, sync, dependencies, fonts, or the service worker - verifies no plaintext user data leaves the device
---

# Northstar: Privacy & Security Audit

The product promise: **user data stays on the user's device; the only way stored records leave is the opt-in,
end-to-end encrypted Supabase sync (`src/sync/`), and then only as ciphertext.** Verify it, do not assume it.

## Checklist (run the commands, record output)
- Network: `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.share|createClient|supabase" src` - every hit must be justified. Stored records may only be sent from `src/sync/engine.ts` via `src/sync/client.ts`, and only after `encryptRecord`.
- Only ciphertext leaves: `npx vitest run src/sync` must pass, including "no plaintext field value appears in anything sent to the backend" and the AAD-swap / wrong-key fail-closed tests. Read `engine.ts` push: every `VaultRow` is built from `encryptRecord(...)`; columns sent are only table_name, record_id, ciphertext, nonce, deleted, client_updated_at. No `console.log` of payloads.
- Keys: passphrase, recovery code and master key never leave the device (`grep -rn "passphrase\|recoveryCode" src/sync/client.ts` must find nothing sent). PBKDF2 iterations >= 600000 (`KDF_ITERATIONS`). Derived keys are non-extractable. The remembered key lives in its own IndexedDB (`northstar-vault-key`), never in backups.
- Only the Supabase host is contacted for sync: `validateConfig` accepts only `https://<ref>.supabase.co`; the CSP in `index.html` `connect-src` lists only `'self'`, `https://*.supabase.co`, `wss://*.supabase.co` plus any separately owner-approved host. Flag any new host.
- Supabase is lazy-loaded: `npm run build` output must keep `@supabase/supabase-js` in its own chunk (not in the main entry), loaded only when sync is set up.
- RLS: `supabase/migrations/*.sql` must `enable` and `force row level security` on `vault_meta` and `vault_records`, with select/insert/update/delete policies all `to authenticated` using `(select auth.uid()) = user_id`; no grants to `anon`. No service-role key anywhere: `grep -rniE "service_role|sb_secret_" src supabase .env* 2>/dev/null` must find only the warning text in client.ts / README.
- Device-local settings never sync: check `isLocalOnlySetting` covers `sync.*`, `backup.lastAt`, tokens and any new per-device key.
- Third parties: `grep -rnE "https?://" src index.html` - fonts/CDNs must not receive user data; prefer self-hosted fonts.
- Telemetry/logging: no `console.log` of user content; no analytics SDKs (review `package.json`).
- Untrusted input: CSV, backup JSON and **pulled cloud rows** are untrusted. Check size caps, type validation (`isPayload`), no `dangerouslySetInnerHTML`, no `eval`, spreadsheet formulas never interpreted. A row that fails to decrypt must abort the pull with nothing applied.
- Service worker: precaches app assets only, never user data or Supabase responses.
- Dependencies: `npm audit --omit=dev`; justify any new package; prefer none. `@supabase/supabase-js` is the only sync dependency; crypto is WebCrypto only.
- Secrets/PII in repo: `git ls-files | grep -iE "backup|\.json$|\.csv$|\.env"` and scan for keys/tokens. Backups, real exports and `.env.local` must never be committed.
- Backups: export contains everything and only what the user expects; import cannot partially corrupt data (single transaction) and runs with sync suppressed.
- Honesty: Settings About/Storage text, `site/privacy.html`, `site/get-started.html` and `site/index.html` must describe sync truthfully, including what Supabase can still see (email, row counts per table, timestamps, ciphertext sizes).

## Escalate to the owner (never decide alone)
Any new off-device path or host, changes to what sync sends in plaintext metadata, weakening the KDF or RLS, bank APIs, AI/LLM calls with user data, analytics, sharing, or any other hosting of user data.
