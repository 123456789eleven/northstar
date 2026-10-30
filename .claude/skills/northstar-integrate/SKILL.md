---
name: northstar-integrate
description: Use after subagents report back - the fastest reliable way to verify, fix cross-module seams, QA, commit and ship their combined work
---

# Integrating agent output

1. **Read reports, not transcripts.** Note each agent's "untested" and "open issues" lines.
2. `npm run verify` yourself (northstar-fast-verify). Green claims from agents are not evidence.
3. **Seam checklist (where integration bugs actually were):**
   - Unfamiliar tables in `backup.test.ts` seeds and `FOREIGN_KEYS` (sync).
   - Pages that read other modules' tables or settings keys (Today, Review, Insights, Ontology, DataHub) - do the keys match the writers?
   - Sensitive text on screens that print raw rows (Ontology inspector shows journal text: mask `JournalEntry.text`, `Transaction.description` where appropriate).
   - Public wording (site/, Settings About) still true after the change.
   - New hosts only if opt-in, with CSP + audit text updated.
4. **One QA agent** (sonnet, northstar-browser-qa) for all new UI together, at 1280 and 375. Not one per module.
5. Fix findings yourself if <=3 tool calls each.
6. Ship with `northstar-ship`. Update the codebase map and memory if structure/decisions changed.
