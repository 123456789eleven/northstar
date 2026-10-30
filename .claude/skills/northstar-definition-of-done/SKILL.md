---
name: northstar-definition-of-done
description: Use before claiming ANY Northstar work is complete, fixed, or ready to commit - defines the exact gates (verify script, browser check, privacy, design) and the evidence required for each
---

# Northstar: Definition of Done

Extends `verification-before-completion`. Evidence before assertions: paste or cite real command output.

## Gates (all must pass)
1. **`npm run verify`** exits 0 (typecheck, lint, tests, build). A skipped or deleted test is a failure.
2. **Behavior proven**: for each changed behavior there is a test that failed before the change (see `test-driven-development`), or for UI-only changes a browser check via `northstar-browser-qa`.
3. **Data safety**: no shipped `db.version` edited; any schema change followed `northstar-schema-migrations`; backup export/import still round-trips.
4. **Privacy**: no new network call, third-party script/font, analytics, or logging of user content (`northstar-privacy-audit`).
5. **Design**: `northstar-design-review` checklist passes at 1280px and 375px.
6. **Timeline**: user-meaningful actions call `logEvent`; undo/delete paths clean up their events.
7. **Empty, error, and edge states** exist (no data, bad input, month end, DST, duplicate).
8. **Committed** with a message saying why, not just what.

## Report format
List each gate with PASS/FAIL and the evidence. If a gate was not run, say "NOT RUN" - never imply success.
