---
name: northstar-dispatch
description: Use before spawning any Northstar subagent - the prompt template and model/effort pick that makes agents finish first try at the lowest cost
---

# Dispatching an agent (cheap + right the first time)

Spawn only for parallel, multi-file, disjoint work. 1-3 tool calls? Do it yourself. Pure search? `northstar-scout` (haiku).

## Model pick
haiku: search/list/mechanical. sonnet: default implement/test/QA. opus: schema, crypto/privacy, strategy, or after 2 failed sonnet attempts.

## Prompt template (fill every slot; short beats long)
```
Act as <northstar-agent> (persona: The One\agents\<file>). Project: C:\Users\bearf\Documents\northstar.
Read first (only these): CLAUDE.md, <exact files>. Skills: <names from northstar-master>.
Goal: <1-2 sentences + why>.
Build (you own ONLY): <paths>. Do not edit: <shared files + other agents' paths>.
Spec: <numbered, testable bullets; name existing functions to reuse (no duplicating logic)>.
Done = `npm run verify` green + <specific behaviors>. If verify fails from another agent's in-progress file, wait briefly and retry. No git.
Report <=300 words: files, behaviors verified, untested items, open issues.
```

## Rules
- Pre-wire shared files yourself FIRST (db.ts schema, App.tsx routes/nav, CSP, backup test seeds, placeholder pages) - see northstar-parallel-build.
- Say what is untestable (real Google/Supabase) so the agent states it plainly.
- Run in background; never poll; relay the report, do not re-read agent output files.
- Verify claims yourself with `northstar-fast-verify` before committing.
