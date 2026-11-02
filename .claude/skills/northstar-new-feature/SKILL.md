---
name: northstar-new-feature
description: Use when adding or substantially changing a Northstar feature - the plan, build, verify, ship checklist with every data, sync, undo, test and docs touchpoint so nothing is forgotten
---

# New feature flow

1. **Spec** (product-lead, or inline if tiny): goal, 2-tap flow, files owned, functions to reuse, acceptance, untestable parts, owner decisions. Add to `docs/roadmap.md`.
2. **Pre-wire shared files once:** `src/db.ts` new `db.version(n)` (never edit a shipped one), routes/nav, CSP only for opt-in hosts. One owner per shared file.
3. **Build** (builder/data-integrations): pure logic with tests first; `logEvent` for meaningful actions; Undo for destructive or bulk writes; empty state names the first action; phone width and keyboard.
4. **Data touchpoints:** `src/sync/schema.ts` (FOREIGN_KEYS, naturalKey), local-only prefixes in `src/sync/outbox.ts`, `backup.test.ts` seed rows, migration test with a frozen previous-version fixture, ontology type if it is a first-class object, capture syntax if typed entry makes sense.
5. **Cheap checks:** typecheck, oxlint, tests of the folder, then ONE real-browser pass on every NEW tab/modal (click it; screenshots at 1440 and 375; axe).
6. **Assure once per batch** (`northstar-assurance`; add `northstar-security` for a new host, storage key or data path), `npm run verify`, personal-data sweep.
7. **Ship:** commit with attribution, push, confirm deploy and live URL, update `docs/roadmap.md`, `docs/usage-log.md`, changelog/roadmap on the public site if user-facing.
8. **Decision log** entry for non-obvious choices (`docs/decision-log.md`).
