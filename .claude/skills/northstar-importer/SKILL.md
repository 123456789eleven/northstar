---
name: northstar-importer
description: Use when adding any file or API data source to Northstar (CSV, ics, vcf, JSON, third-party) - the pure-parser + preview + dedupe + batch-undo pattern with size caps
---

# Importer recipe (copy `features/finance/importActions.ts` and `features/data/dataActions.ts`)

1. **Pure parser** `parseX(text) -> {rows, warnings}`; no DB, no DOM. Tests with realistic fixtures: folding/escapes, encodings, empty file, junk header lines, huge file.
2. **Caps**: file size (5 MB CSV/ics/vcf, 50 MB backup) and row count; plain-language errors. Treat all files as untrusted: render as text only, never HTML.
3. **Preview before commit**: first 10 rows + counts New / Duplicate / Skipped; checkboxes if rows are optional.
4. **Dedupe** by a stable key (uid, or date+amount+description with repeat counts).
5. **Commit** in ONE Dexie transaction: rows tagged `importBatch`, one `logEvent` (`kind: '<area>.import'`, `refKey: batchId`), record the batch in a setting (`<x>.imports`) for history.
6. **Undo** deletes the batch rows AND its event in one transaction.
7. Bulk writes that must not sync (restores) go through `withSyncSuppressed`; normal imports DO sync.
8. Register the source in Data Hub (`features/data/`): what it brings, feeds-types, last import, rows, action.
9. Network sources: opt-in toggle (default off), name the host and exactly what is sent, add the host to the CSP and the privacy-audit text, lazy-load any vendor script.
