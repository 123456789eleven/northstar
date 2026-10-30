---
name: northstar-codebase-map
description: Use FIRST before exploring the Northstar repo - a verified map of where everything lives so you can skip searching (saves the most tokens of any skill)
---

# Northstar codebase map (repo: C:\Users\bearf\Documents\northstar)

Stack: Vite + React 19 + TS, HashRouter, Dexie (IndexedDB), recharts, papaparse, @supabase/supabase-js (lazy). Tests: vitest + fake-indexeddb, next to code as `*.test.ts`.

## Core files
- `src/db.ts` - ALL types + Dexie schema (versions 1-4), `logEvent`, `getSetting`/`setSetting`. Tables: tasks goals meals favoriteMeals transactions budgets balances learning studySessions people interactions events reviews settings habits habitLogs journal calendar (+ sync: outbox, syncMeta).
- `src/lib/dates.ts` (local YYYY-MM-DD helpers, `money`), `capture.ts` (quick-capture parser), `backup.ts` (JSON export/import).
- `src/components/ui.tsx` (PageHeader Card Stat Progress Empty Modal Field Tabs), `QuickCapture.tsx`, `src/index.css` (tokens + classes).
- `src/App.tsx` - NAV array + routes. `src/ontology/registry.ts` - object types/links/actions.
- `src/sync/` - E2E-encrypted Supabase sync (crypto, outbox, engine, client, manager, schema.ts FOREIGN_KEYS).
- `supabase/` migrations + README. `site/` public marketing site. `docs/`. `.github/workflows/deploy.yml`.

## Pages -> feature folders (`src/pages/X.tsx` + `src/features/<x>/`)
Command=Ops (`features/ops`: proposals.ts, opsActions.ts) | Today (`features/today`, `insights`) | Planner | Tasks (`features/tasks`: taskActions, captureSave) | Goals | Habits | Finance (csv, categories, model, importActions) | Food | Learning | People | Journal | History | Review (summary.ts) | DataHub (`features/data`: ics, vcf, dataActions; `gcal`) | Ontology | Settings (`features/settings`: Sections, SyncSection).

## Conventions
- Pure logic in `*.ts`, UI in `*.tsx`, CSS per feature (`<feature>.css`). Actions that change data call `logEvent`.
- Routes are hash routes (`#/ops`); Command=`/ops`, Today=`/`.
- Settings keys in use: food.targets, finance.rules, finance.imports, ops.decisions, ops.auto, ops.autolog, data.imports, gcal.*, sync.*, backup.lastAt, profile.name.

Ground truth beats this map: if a path is missing, `ls` the folder, then fix this file.
