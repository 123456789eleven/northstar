---
name: northstar-parallel-build
description: Use when building 2+ Northstar features at once with several agents - the foundation-first sequence that prevented merge collisions and broken typechecks
---

# Parallel build sequence

1. **Foundation (you, 5 min, one commit):** everything shared that agents would otherwise fight over.
   - `src/db.ts`: new types, tables, ONE new `db.version(n)` block (never edit a shipped one; unreleased ones may be extended).
   - `src/App.tsx`: routes + NAV entries; placeholder pages `export default function X(){return <PageHeader title="X" sub="Coming soon"/>}`.
   - `index.html` CSP when a new host is needed (opt-in features only).
   - `src/lib/backup.test.ts`: seed rows for new tables (guard test fails otherwise).
   - Run `npm run verify`, commit.
2. **Assign disjoint ownership** (pages + `src/features/<x>/**`). Exactly ONE agent per shared file (e.g. ontology registry, capture.ts, db.ts v(n+1)).
3. **Cross-agent mounts:** create stub components (`export default function Card(){return null}`) and tell the consumer to mount them; builder replaces the stub.
4. Dispatch all in background (northstar-dispatch template). Give the one-way-door agent (sync/schema/security) opus; the rest sonnet.
5. Collect reports; then integrate (northstar-integrate). Do not poll.

## Pitfalls seen
- Agent A's half-written file breaks agent B's typecheck: tell agents to wait and retry once, not to "fix" others' files.
- New linked tables must be added to `FOREIGN_KEYS` in `src/sync/schema.ts`.
- Data-hub/import code must use `restoreWithoutSync` / `withSyncSuppressed` for bulk restores.
