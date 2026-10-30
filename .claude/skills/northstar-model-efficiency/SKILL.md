---
name: northstar-model-efficiency
description: Use whenever dispatching a subagent or choosing a model/effort level for Northstar work - the delegation ladder and tiering rules that keep token cost low without lowering quality
---

# Northstar: Model Efficiency

Spend capability where mistakes are expensive; spend nothing where they are cheap. Quality comes from the gates (`northstar-definition-of-done`), not from big models or many agents. Measured: three batches of 3 flat agents cost about 1.0M subagent tokens, each agent re-reading rules and writing its own screenshot script.

## Delegation ladder (stop at the first rung that fits)
1. **Lead does it** (1-3 tool calls, or a small known edit). No agent.
2. **scout (haiku)**: search, listing, logs, running `tools/qa.mjs`, mechanical edits.
3. **ONE builder (sonnet) per feature slice** (not per page). The builder decides whether to run up to 3 workers. Prompt = goal + files owned + reuse list + "read `The One\docs\agent-brief.md`". Target prompt <=250 words.
4. **ONE assurance (sonnet) per batch**, after builders finish: full gate + browser pass. Builders do not run the full gate or hand-write browser scripts.
5. **architect (opus)** only for one-way doors (schema, crypto/privacy, new off-device path, strategy) or after two failed sonnet fixes.

## Rules
- Max 3 concurrent agents; disjoint files stated in each prompt; the lead pre-wires shared files (db.ts versions, routes, CSP) first.
- Agents read the brief, not CLAUDE.md + ui.tsx + design-system.md (saves ~8-10k tokens each). Link one file, not a tree.
- Browser QA is `tools/qa.mjs` (one command), read screenshots only for changed pages and anomalies (images are costly).
- Reports <=200 words, no file dumps; the lead never re-reads agent transcripts.
- Same check fails 3 times: stop and report. No polling; run in background.
- Reuse over regenerate; no new dependencies without a reason.
- Write the spec once (opus only if it is a one-way door), implement with sonnet.

## Effort
Low for lookups; medium for implementation; high only for design forks and audits.

## Quality floor (never traded for cost)
Tests for logic, `npm run verify` green once per batch, privacy audit before release and for any new network host, migrations tested on old-shape data, evidence in every completion claim.
