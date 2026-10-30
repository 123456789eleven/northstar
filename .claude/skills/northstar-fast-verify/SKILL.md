---
name: northstar-fast-verify
description: Use whenever checking Northstar work - tiered verification that runs the cheapest sufficient check first and the full gate only before commit
---

# Tiered verification (cheapest first)

| Tier | Command | When |
|---|---|---|
| 1 | `npx vitest run <path/to/file.test.ts>` | after each logic change (seconds) |
| 2 | `npm run typecheck` | after any TS edit |
| 3 | `npx oxlint <changed files>` | before tier 4 |
| 4 | `npm run verify` (typecheck + lint + all tests + build) | ONCE before every commit/claim of done |
| 5 | `npm run build:pages` + browser QA | UI changes or release |

- Filter output: `npm run verify 2>&1 | grep -E "Test Files|Tests |FAIL|error TS|built in"`; on failure rerun only the failing file with full output.
- Failing guard test "seeds a row in every table" = add seed rows in `src/lib/backup.test.ts`.
- Flaky once, green on retry: note it; if it recurs, systematic-debugging (a time/TZ or ordering leak).
- Never skip/delete a failing test to get green.
- Evidence format in reports: "verify: 441/441 tests, build ok" - the real numbers.
