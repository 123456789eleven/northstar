---
name: northstar-events-and-undo
description: Use when an action changes user data in Northstar - how to log timeline events, mark milestones, de-duplicate, and make undo clean up completely
---

# Events & undo

`logEvent({area, kind, title, refTable?, refId?, refKey?, milestone?})` in `src/db.ts`. History reads only `db.events`.

- **kind** is `<module>.<verb>` (`task.done`, `goal.milestone`, `finance.import`, `proposal.accepted`).
- **milestone: true** only for real achievements (goal done, certification earned, streak 7/30/100, new net-worth high, win:). Dedupe milestones: check for an existing event with the same kind + refId first.
- **No private text in titles** (journal entries log "Journal entry"). Titles are shown in History, Review and Ontology.
- **One event per import / per day / first save** - never per keystroke or per row.
- **Undo = delete the data AND its event** in one `db.transaction('rw', ...)`; match by `refTable+refId` or `refKey` (batch id). Reopening a done goal/task removes its `*.done` event and any spawned follow-up.
- Recurring completion spawns the next instance using `recurDay` for month-end safety.
- Synced tables: writes made inside `withSyncSuppressed` are not queued.
