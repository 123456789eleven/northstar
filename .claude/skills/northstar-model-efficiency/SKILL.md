---
name: northstar-model-efficiency
description: Use whenever dispatching a subagent or choosing a model/effort level for Northstar work - the tiering rules that keep cost low without lowering quality
---

# Northstar: Model Efficiency

Spend capability where mistakes are expensive; spend nothing where they are cheap. Quality is protected by the gates (`northstar-definition-of-done`), not by always using the biggest model.

## Tiering
| Tier | Model | Use for | Never for |
|---|---|---|---|
| Deep | opus | Architecture, schema/migration design, privacy and security audits, product strategy, debugging after 2 failed fixes | Routine edits, formatting, summaries |
| Standard | sonnet | Feature implementation, tests, QA, design review, release work | Open-ended design forks |
| Light | haiku | Searching, listing, renaming, reading logs, simple mechanical edits, boilerplate | Anything touching user data, money math, migrations |

## Rules
1. **Default to sonnet.** Escalate to opus only when the task is a one-way door (data shape, privacy, public release) or sonnet has failed twice on the same problem. De-escalate to haiku for mechanical work.
2. **Plan once with the deep model, build with the standard one.** A written spec lets a cheaper model implement reliably.
3. **Do not spawn an agent for work you can do in 1-3 tool calls.** Agents start cold and re-read context; spawn only for parallel, disjoint, multi-file work.
4. **Disjoint file ownership per agent**, stated in the prompt, so no agent redoes or clobbers another's work.
5. **Give agents the context they need up front** (file paths, rules, the spec) so they do not rediscover it; tell them what NOT to read.
6. **Cap output.** Ask for reports under ~300 words: what changed, evidence, open issues. No file dumps.
7. **Verify cheaply first**: typecheck and unit tests before browser QA; browser QA before design review; one reviewer pass, not three.
8. **Reuse, don't regenerate.** Prefer editing existing modules and shared components over new ones; no new dependency without a reason.
9. **Run in background** when work is independent, and never poll.
10. **Stop conditions**: an agent that fails the same check three times reports back instead of looping.

## Effort
Low for lookups and mechanical edits; medium for implementation; high only for design forks and audits.

## Quality floor (never traded for cost)
Tests for logic, `npm run verify` green, privacy audit before release, migrations tested on old-shape data, evidence in every completion claim.
