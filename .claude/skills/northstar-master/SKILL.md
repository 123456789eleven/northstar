---
name: northstar-master
description: Use at the start of any Northstar task - the master index of every skill grouped by type and sub-genre, with a fast-path table that picks the right skill in one lookup
---

# Northstar master skill index

Read this table, open ONLY the 1-3 skills you need. Cheapest first: `northstar-codebase-map` before exploring, `northstar-fast-verify` before the full gate.
Validate this index any time: `python "C:\Users\bearf\OneDrive\Desktop\The One\tools\check_skills.py"`.

## Fast path ("I want to...")
| I want to... | Use |
|---|---|
| find where something lives | northstar-codebase-map |
| a command/env thing failed | northstar-env-gotchas |
| add a page | northstar-add-page (+ northstar-new-module if new table) |
| import a file / connect a data source | northstar-importer |
| add an insight or a Command proposal | northstar-rules-engine |
| add a capture-bar syntax | northstar-capture-syntax |
| add a chart | northstar-chart |
| expose a table in ontology/sync | northstar-ontology-type |
| log events / make undo clean | northstar-events-and-undo |
| change the DB schema | northstar-schema-migrations |
| build several things in parallel | northstar-parallel-build -> northstar-dispatch |
| merge agents' output | northstar-integrate |
| fix a bug | northstar-bugfix-loop |
| check my work | northstar-fast-verify, then northstar-definition-of-done |
| commit + deploy | northstar-ship |
| set up / verify Supabase | northstar-supabase-ops |
| choose a model / keep cost down | northstar-model-efficiency |

## Catalog by type

### 1. Orchestration (how work gets organized)
- **Planning:** brainstorming, writing-plans, executing-plans
- **Delegation:** northstar-dispatch, northstar-parallel-build, subagent-driven-development, dispatching-parallel-agents
- **Integration:** northstar-integrate, requesting-code-review, receiving-code-review, finishing-a-development-branch
- **Cost control:** northstar-model-efficiency
- **Git hygiene:** using-git-worktrees

### 2. Build recipes (how to add things)
- **Structure:** northstar-add-page, northstar-new-module, northstar-ontology-type
- **Data in:** northstar-importer, northstar-capture-syntax
- **Intelligence:** northstar-rules-engine
- **Presentation:** northstar-chart
- **Data behavior:** northstar-events-and-undo, northstar-schema-migrations

### 3. Quality (how we know it works)
- **Verification:** northstar-fast-verify, northstar-definition-of-done, verification-before-completion
- **Testing:** test-driven-development, northstar-browser-qa
- **Debugging:** northstar-bugfix-loop, systematic-debugging
- **Review:** northstar-design-review, northstar-privacy-audit

### 4. Operations (how it reaches users)
- **Release:** northstar-ship
- **Backend:** northstar-supabase-ops
- **Environment:** northstar-env-gotchas

### 5. Reference (read-only knowledge)
- northstar-codebase-map, northstar-env-gotchas

### 6. Meta (skills about skills)
- northstar-master (this file), using-superpowers, writing-skills

## Adding a skill
1. Folder `skills/<name>/SKILL.md`, frontmatter `name` = folder, `description` starting "Use when/before/to ...".
2. Keep it under ~40 lines: recipe + commands + pitfalls, no theory.
3. Add it to the fast-path table and ONE catalog section above, then run the checker.
