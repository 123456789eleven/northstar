---
name: northstar-ontology-type
description: Use when a new table/object should appear in the Northstar ontology, Command proposals or cloud sync - registry entry, links, FOREIGN_KEYS and sensitivity masking
---

# Registering an object type

1. `src/ontology/registry.ts`: add the type with `label`, Dexie `table`, `title`/`subtitle` accessors, `properties`, `links` (both directions resolve via `resolveLinks`), `actions` (call EXISTING action functions, never duplicate logic), `functions` (derived values), `automations`.
2. **Sensitive fields**: titles/subtitles must never include private text (journal text, transaction descriptions in shared views). Mask in the explorer inspector.
3. **Sync**: if the table links to others by id, add the FK fields to `FOREIGN_KEYS` in `src/sync/schema.ts`; add the table to the synced set unless device-local. Add a seed row in `src/lib/backup.test.ts`.
4. Registry test (`src/ontology/registry.test.ts`): links resolve both ways, titles safe.
5. Data Hub: list which sources feed it (`features/data`). Site/platform diagram only if it is a headline object.
6. Timeline: user-meaningful actions call `logEvent({refTable, refId})` so `timelineFor` works.
