---
description: Plan, build, verify flow for a new Northstar feature
argument-hint: <feature description>
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(npm run typecheck:*), Bash(npx oxlint:*), Bash(npx vitest run:*), Bash(git status:*), Bash(git diff:*)
---
Feature: $ARGUMENTS

Read `C:\Users\bearf\OneDrive\Desktop\The One\docs\agent-brief.md` first and follow the `northstar-org-workflow` skill (intake, build, assure, ship). Open at most ONE more file for orientation (skill `northstar-codebase-map`).

1. PLAN: state in <=10 lines the files to touch, schema impact (new numbered db.version plus migration test, if any), privacy impact, and the common-action tap count (must be <=2 taps or one line). Wait for the user's OK if schema, sync or off-device data is involved.
2. BUILD: reuse `src/components/ui.tsx`; feature-local CSS only; `logEvent` for meaningful actions; local dates via `src/lib/dates.ts`. Follow the design rules in the brief.
3. VERIFY in order, stopping at the first failure: `npm run typecheck`, `npx oxlint src`, `npx vitest run <folder>`. The same check failing 3 times: stop and report.
4. REPORT in <=200 words: files changed, evidence, untested items, owner actions. Do not commit.
