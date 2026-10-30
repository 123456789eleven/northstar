---
name: northstar-bugfix-loop
description: Use for any Northstar bug report or QA finding - the shortest loop (failing test, minimal fix, regression guard) that avoids rework
---

# Bugfix loop

1. **Locate** with the codebase map; read only the owning file + its test (scout for wide searches).
2. **Reproduce as a failing test** next to the code (pure function if possible; else fake-indexeddb + fake Date). Run tier-1 vitest: must fail for the right reason.
3. **Minimal fix.** No refactors, no new deps. Keep style of the surrounding file.
4. Test passes; run the file's neighbors, then `npm run verify` once.
5. If a UI-only bug: reproduce in the browser (northstar-browser-qa) and add a test for any extracted logic.
6. Two failed attempts -> stop, `systematic-debugging`, consider escalating the model (opus).
7. Commit message says why. Add the pitfall to `northstar-env-gotchas` or the relevant recipe if it will recur.

Common root causes here: UTC vs local dates (`toISOString().slice(0,10)` - use `toISODate`), boolean in IndexedDB index, stale `useLiveQuery` dependency, forgetting to remove the `logEvent` on undo, FK not in `FOREIGN_KEYS`.
