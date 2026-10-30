---
name: northstar-rules-engine
description: Use when adding an Insight (weekly summary line) or a Command Proposal (actionable suggestion) to Northstar - both are pure deterministic rules over a snapshot, no AI
---

# Insights vs Proposals

| | Insight (`features/insights/engine.ts`) | Proposal (`features/ops/proposals.ts`) |
|---|---|---|
| Output | sentence + severity (win/nudge/note) | action the user approves |
| Side effects | none | `applyProposal` runs existing actions + logs `proposal.accepted` |
| Entry | `generateInsights(snapshot, today)` | `generateProposals(snapshot, now)` |

## Add a rule (TDD)
1. Extend the snapshot type + `snapshot.ts` loader ONLY if the data is missing (optional fields; keep rule pure).
2. Write the test first with a fixed `today`: fires, doesn't fire (threshold), quiet for new users.
3. Rule returns nothing when nothing useful (no filler praise); rank by score; cap 5 (insights).
4. Proposals: stable id = hash(rule + object + state key); include `rationale`, `evidence[]`, `logic` (human-readable predicate), `risk`. Decisions persist in setting `ops.decisions`; dismissed never reappear. Auto-apply only for low risk, default OFF, undoable 24h, review-only rules never auto.
5. No network, no LLM. An opt-in AI version must live behind `generateInsights`' seam and needs owner approval.
