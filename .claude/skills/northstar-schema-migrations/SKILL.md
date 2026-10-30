---
name: northstar-schema-migrations
description: Use when changing src/db.ts - adding tables, indexes, or fields - to guarantee existing user data survives upgrades
---

# Northstar: Safe Schema Migrations

User data lives only in their browser; a bad migration is unrecoverable data loss.

1. **Never edit a shipped `db.version(n)` block.** Add `db.version(n+1).stores({...})` with only the changed tables.
2. If existing rows must change shape, add an idempotent `.upgrade(tx => ...)` that tolerates missing fields.
3. Booleans cannot be IndexedDB keys; index 0/1 or filter in code.
4. New optional fields need no migration - make the type optional and handle `undefined`.
5. **Test it**: seed old-shape rows with `fake-indexeddb` at the previous version, open at the new version, assert rows survive intact.
6. Update `src/lib/backup.ts`: export covers new tables automatically (it iterates `db.tables`); import must still accept backups from older versions.
7. Back up (Settings) before testing against real data; never experiment on the user's profile.
