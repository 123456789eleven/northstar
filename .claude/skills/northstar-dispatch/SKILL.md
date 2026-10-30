---
name: northstar-dispatch
description: Use before spawning any Northstar subagent - which agent and model, and the short prompt template that finishes first try at the lowest cost
---

# Dispatching an agent (cheap + right the first time)

Pick from the ladder in `northstar-model-efficiency`. Roster: northstar-scout (haiku), northstar-builder (sonnet, can run workers), northstar-assurance (sonnet, once per batch), northstar-architect (opus, one-way doors only). Use `subagent_type` = the agent name when it is available, else general-purpose with the model set.

## Prompt template (aim for <=250 words; the brief carries the boilerplate)
```
Act as northstar-builder. Read first: C:\Users\bearf\OneDrive\Desktop\The One\docs\agent-brief.md, then <exact files>.
Goal: <1-2 sentences + why>.
You own ONLY: <paths>. Do not edit: <other agents' paths / shared files>. Reuse: <function names>.
Spec: <numbered, testable bullets>.
Done = typecheck, oxlint, your folder's tests, one qa.mjs run for <routes>. Say what you could not test. Report <=200 words.
```

## Rules
- Pre-wire shared files yourself FIRST (see `northstar-parallel-build`).
- Group by slice: one builder per feature slice (e.g. "Finance import"), not one per file or page.
- Run in background; never poll; relay the report, do not re-read agent output files.
- After builders finish: one assurance pass, then you commit. Verify claims yourself with `northstar-fast-verify` before committing.
- Never paste secrets, tokens, passwords or recovery codes into a prompt.
