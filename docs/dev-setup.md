# Dev setup (Claude Code, VS Code, worktrees, e2e)

Everything here is repo-side and project-scoped. Nothing changes your global Claude Code settings, permissions, trust or telemetry.

## MCP servers (`.mcp.json`)

| Server | What it does | Pin |
|---|---|---|
| `playwright` | Drives Chrome (isolated profile, 1440x900, output in `.playwright-mcp/`, git-ignored) | `@playwright/mcp@0.0.84` |
| `context7` | Fetches current library docs into the chat | `@upstash/context7-mcp@4.4.4` |

**DATA LEAVES MACHINE (Context7):** library names and the queries Claude sends to Context7 go to Upstash's servers. Never put personal data, finance details or secrets in a Context7 query. Playwright MCP stays local, but it can open any URL you ask for, so keep it on `localhost` for this app.

First use: Claude Code asks you to approve project MCP servers. Chrome must be installed (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
Undo: delete `.mcp.json` (or remove one server entry).

## Slash commands (`.claude/commands/`)

| Command | Purpose |
|---|---|
| `/verify` | `npm run verify`, failures summarized with `file:line`, fixes nothing |
| `/shots home,finance` | qa.mjs at widths 1280 and 375 with demo data; looks only at anomalies |
| `/ship-check` | verify + `git status` + privacy sweep using `scripts/privacy-terms.txt` |
| `/explain-diff` | plain-language explanation of the diff with risk notes |
| `/new-feature <idea>` | plan, build, verify flow (agent-brief + org workflow skill) |
| `/pr [base]` | `gh pr create` with a body template; never merges |
| `/checkpoint` | `git stash create` + `refs/checkpoints/<timestamp>`; does not touch tree, index or stash list. Untracked files are not captured |
| `/restore-checkpoint` | lists checkpoints; restore with `git stash apply <hash>` |

Add terms to `scripts/privacy-terms.txt` (generic patterns only; the file is committed, so never put real names in it).
Undo: delete the file(s) in `.claude/commands/`. Delete a checkpoint: `git update-ref -d refs/checkpoints/<name>`.

## Hooks and status line (`.claude/settings.json`, scripts in `.claude/hooks/`)

Plain Node, no dependencies, always exit 0, silent on internal errors.

- **PostToolUse** (Edit/Write/MultiEdit) `post-edit.mjs`: runs `npx oxlint <file>` for `src/**/*.ts(x)`; only speaks when there are findings (as `additionalContext`). For `src/sync/`, `supabase/` and `src/db.ts` it adds a reminder to follow the privacy checklist and get a security review.
- **PreToolUse** (Edit/Write/MultiEdit/NotebookEdit) `pre-guard.mjs`: denies `.env*` (except `.env.example`), any path inside a folder named in `~/.northstar-tools/private-paths.txt` (kept outside the repo), and `.git/` internals. Nothing else is blocked.
- **UserPromptSubmit** `prompt-submit.mjs`: writes a start timestamp to the OS temp dir.
- **Stop** `stop.mjs`: informational only, never blocks, ignores `stop_hook_active`. Runs `npm run typecheck` at most once per 120 s and only if `git status --porcelain` changed since the last run (state in the temp dir); reports error count + first 3 as a `systemMessage`. If the turn took more than 90 s it shows a Windows balloon notification (PowerShell `NotifyIcon`, no modules). Set `NORTHSTAR_NO_NOTIFY=1` to silence it.
- **statusLine** `statusline.mjs`: `branch | N dirty | model | ctx NN%`, only fields that exist.

Undo: remove the `hooks` / `statusLine` blocks from `.claude/settings.json` or delete the file. Test a hook by hand: `echo {...json...} | node .claude/hooks/pre-guard.mjs`.

## VS Code (`.vscode/`)

- Tasks (Terminal > Run Task): **Dev server** (background), **Verify**, **Typecheck**, **Test**, **Shots** (prompts for routes).
- `extensions.json` recommends: oxc.oxc-vscode, usernamehw.errorlens, yoavbls.pretty-ts-errors, vitest.explorer, eamodio.gitlens, ms-playwright.playwright.
- `settings.json` (workspace) holds only `search.exclude` and `files.watcherExclude` for `dist`, `pages-dist`, `.playwright-mcp`.
- `.gitignore` now un-ignores `.vscode/tasks.json` and `.vscode/settings.json` next to `extensions.json`.

Undo: delete the files.

## Worktrees (`scripts/wt.ps1`)

Works in Windows PowerShell 5.1 and PowerShell 7.

```powershell
.\scripts\wt.ps1 new my-branch          # ..\northstar-wt-my-branch on new branch my-branch, then npm ci
.\scripts\wt.ps1 new my-branch -SkipInstall
.\scripts\wt.ps1 list
.\scripts\wt.ps1 remove my-branch       # refuses if there are uncommitted changes; keeps the branch
git branch -d my-branch                 # after merging
```

## Pre-commit hook (`.githooks/pre-commit`)

Runs `npm run typecheck` then `npm run lint`, prints a clear message on failure. It is NOT enabled by default. Enable (once per clone):

```
git config core.hooksPath .githooks
```

Disable: `git config --unset core.hooksPath`. Skip once: `git commit --no-verify`.

## Playwright e2e (prepared, not installed)

Files: `playwright.config.ts` (Chrome channel, 1 worker, 0 retries, serves `vite preview` on port 4173), `e2e/smoke.spec.ts` (5 flows), `e2e/fixtures/two-tx-one-balance.json`, `e2e/tsconfig.json`. They are outside `tsconfig.app.json` and `vitest.config.ts`, so typecheck and `npm test` do not need the package.

Install (updates package.json, do this deliberately):

```
npm install -D @playwright/test
```

Add these scripts to `package.json` `scripts`:

```json
"e2e": "npm run build && playwright test",
"e2e:only": "playwright test",
"e2e:types": "tsc -p e2e/tsconfig.json"
```

Chrome is used via `channel: 'chrome'`, so no `npx playwright install` browser download is needed. Each test runs in a fresh context (fresh IndexedDB). Do not run `npm run e2e` while another build shares `dist/`.
The selectors were written from the source text but have not been executed (the package is not installed); expect to adjust after the first run.

## Quick undo table

| Piece | Undo |
|---|---|
| MCP servers | delete `.mcp.json` |
| Commands | delete `.claude/commands/*.md` |
| Hooks + statusline | delete `.claude/settings.json` |
| VS Code | delete `.vscode/{tasks,settings}.json` |
| Pre-commit | `git config --unset core.hooksPath` |
| e2e | delete `e2e/`, `playwright.config.ts`, `npm uninstall @playwright/test` |
