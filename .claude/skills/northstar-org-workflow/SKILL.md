---
name: northstar-org-workflow
description: Use when starting any multi-step Northstar request or batch - the intake, batch, build, assure, ship loop, routing table to division leads, WIP limits and escalation rules
---

# Org workflow (see `The One\docs\org-chart.md` for the full chart)

## Loop
1. Intake: one-sentence restatement; add to `docs/roadmap.md` if new.
2. Spec (product-lead) only if the change is bigger than ~3 tool calls.
3. Batch: <=3 independent slices, disjoint files, shared files pre-wired by ONE owner (db versions, routes, CSP).
4. Dispatch leads in the background (template in `northstar-dispatch`), <=3 agents at once, no polling.
5. Assure once per batch (`northstar-assurance`; add `northstar-security` for a new host, storage key or data path).
6. Ship (`northstar-ship`), confirm the live site, update roadmap + `docs/usage-log.md`.

## Route
product-lead (what/why) | builder (app features) | data-integrations (import, finance, feeds) | design-champion (look, motion, site graphics) | platform (build, CI, PWA, perf, Supabase ops) | content (words) | security (privacy audit) | architect (schema, crypto) | assurance (QA gate) | scout (search, mechanical).

## Definition of ready
Goal, files owned, functions to reuse, acceptance checks, what cannot be tested, owner decisions needed.

## Escalate to the owner
New off-device data path, spending or accounts, publishing beyond demo data, deleting data or files, license, rule-breaking visual direction, any real personal detail leaving the machine.

## Staffing
New agent file only for recurring work needing different tools/model/instructions; otherwise a skill. Cap 14 agent files.
