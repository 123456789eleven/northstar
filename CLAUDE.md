# Northstar — personal life dashboard

A local-first web app (installable PWA) for one person: tasks, goals, finances, food, learning, relationships, history/achievements, weekly review.

## Hard rules
- **Privacy: data lives on-device** in IndexedDB via Dexie (`src/db.ts`), which is always the source of truth. No analytics, no third-party APIs with user data. Backups are user-initiated JSON export/import (Settings).
- **The ONLY allowed path for stored user data to leave the device is the opt-in, end-to-end encrypted Supabase sync in `src/sync/`** (default OFF). (Other outbound requests, such as the opt-in Open Food Facts search or the Google Calendar read-only import, must never carry stored records.) Plaintext user data never leaves the device: every record is AES-GCM encrypted on-device (AAD = table + record id) before upload; passphrase, recovery code and keys never leave. Supabase holds only ciphertext plus metadata it can see (account email, table names, opaque ids, row counts, timestamps, ciphertext sizes). Only the Supabase host is contacted, RLS restricts every row to `auth.uid()`, and a service-role key must never appear in the app or repo. Any other feature that would send data off-device needs the owner's explicit approval first.
- Bank data enters only via CSV import the user picks themselves. Never store bank credentials.

## Stack
Vite + React 19 + TypeScript, react-router-dom (HashRouter), Dexie + `dexie-react-hooks` (`useLiveQuery`), recharts for charts, papaparse for CSV. Plain CSS in `src/index.css` — no Tailwind, no CSS-in-JS libraries.

## Architecture
- `src/db.ts` — all types + schema. Every table is declared there. Adding a table/index = bump `db.version(n)` with a new `.stores()` block; never edit a shipped version.
- **Single timeline:** whenever something meaningful happens (task completed, goal done, course finished, budget set, person contacted…), call `logEvent({ area, kind, title, refTable, refId, milestone? })`. `milestone: true` puts it on the Achievements wall. History reads only `db.events`.
- **Sync (`src/sync/`):** `outbox.ts` is a Dexie DBCore middleware (installed in `db.ts`) that queues one outbox row per changed record in the same transaction, only once sync is set up; `engine.ts` pulls by server `seq` and pushes ciphertext, last-writer-wins on the timestamp inside the ciphertext; `syncMeta` maps local ids to stable cross-device `syncId`s and foreign keys travel as syncIds (add new FK fields to `schema.ts` FOREIGN_KEYS, unique natural keys to `naturalKey`/`uniqueLookup`). Device-local settings keys (`sync.*`, `gcal.*`, `backup.lastAt`, `ops.autolog`, `food.lookup.optin`) never sync; add new device-local keys to `isLocalOnlySetting`. Bulk replaces (backup import, erase) must run inside `withSyncSuppressed`. Server schema: `supabase/migrations`, setup: `supabase/README.md`.
- `src/lib/dates.ts` — use these helpers; dates are local `YYYY-MM-DD` strings, timestamps ISO.
- `src/components/ui.tsx` — shared primitives (PageHeader, Card, Stat, Progress, Empty, Modal, Field, Tabs). Use them plus the CSS classes in `index.css` (`.card .btn .btn-primary .input .chip .list-item .table .grid-2/3/4 .stack .row` …).
- One page per route in `src/pages/`. Page-specific components go in `src/features/<module>/`.

## Design rules (owner is sensitive to "AI-generated / tacky" UI)
- Dark only. One accent hue (`--accent`, amber). Color variety only for data in charts.
- No glow blobs, gradients, glassmorphism, emoji icons, dashed badge borders, or a different accent per card.
- Fraunces serif only for page titles and big numbers; Inter for everything else.
- Dense, calm, legible. Cut decoration before adding polish.
- Must work at phone width (≥360px): no horizontal page scroll, tap targets ≥ 32px.

## Input friction is the #1 risk
Design every module so the common action takes ≤ 2 taps or one line of typing (favorites, defaults, quick-add rows, CSV import). Empty states should say exactly what to do first.

## Commands
- `npm run dev` — dev server (also on LAN for phone testing)
- `npm run build` — typecheck + production build
- `npm run verify` — **run before calling anything done**: typecheck (`tsc -p tsconfig.app.json --noEmit`) && lint (`oxlint`) && tests (`vitest run`) && build
- `npm test` — run tests once; `npm run test:watch` — watch mode; `npx vitest run --coverage` — coverage report
- Typecheck only: `npm run typecheck`

## Testing
- Vitest (node env) + `fake-indexeddb`, set up in `src/test/setup.ts` (tables are cleared after every test; TZ pinned to America/New_York in `vitest.config.ts`). Tests sit next to the code as `*.test.ts`.
- Test-first for bugs and new logic: keep parsers/math in pure functions (e.g. `lib/capture.ts`, `finance/csv.ts`) so they are testable; use `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime` to pin "today" for DB-backed code.
- Schema changes need a migration test in `src/db.migration.test.ts` (frozen v1 fixture -> open current version -> data intact). `backup.test.ts` round-trips every table; add a seed row there for any new table.
- Monthly recurring tasks store `recurDay` so a 31st task survives short months; undoing a CSV import (`finance/importActions.ts`) also removes its History event (`refKey` = batch id).

## Model efficiency (cost vs quality)
Default to sonnet; opus only for architecture, schema/migrations, privacy audits, strategy, or after two failed fixes; haiku (`northstar-scout`) for searching and mechanical edits. Don't spawn agents for 1-3 tool-call jobs; give each disjoint files and the context up front; reports under ~300 words. Quality is enforced by `npm run verify` and the definition-of-done gates, never by model size. Full rules: the `northstar-model-efficiency` skill.
- Skills: start at `northstar-master` (index by type); validate with `python "C:\Users\bearf\OneDrive\Desktop\The One\tools\check_skills.py"`.
