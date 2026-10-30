---
name: northstar-env-gotchas
description: Use when a command fails or behaves oddly on this Windows machine - known pitfalls (git identity, heredocs, ports, paths, python, OneDrive, permission classifier) with the fix for each
---

# Environment gotchas (Windows 11, Git Bash + PowerShell)

| Symptom | Cause / fix |
|---|---|
| `Author identity unknown` | Repo-local identity already set (bearfauth@gmail.com / bearf). Re-set with `git config user.email/user.name` in the repo, not global. |
| `LF will be replaced by CRLF` warnings | Harmless. `core.autocrlf=false` is set; filter with `2>&1 \| grep -v "LF will"`. |
| Bash heredoc with nested quotes dies (`unexpected EOF`) | Use the Write tool for files containing quotes/backticks; heredocs only with a quoted `'EOF'` and no shell functions. |
| `python` not found | Installed at `C:\Users\bearf\AppData\Local\Programs\Python\Python313\python.exe` (PATH may be stale in this shell). |
| Port still busy | Kill by PID only: `netstat -ano \| grep :PORT` then `taskkill //PID <pid> //F`. NEVER kill all node/edge (it closes the user's browser). Dev server uses 5180; QA preview 4173. |
| `npm run lint` scanned skill scripts | Lint is scoped to `oxlint src`. |
| App code vs The One | Code: `Documents\northstar` (outside OneDrive, node_modules is huge). Agents/skills/docs live in `Desktop\The One` (OneDrive path `C:\Users\bearf\OneDrive\Desktop\The One`); `.claude/skills` and `.claude/agents` are junctions into it. |
| Test "today" drifts | vitest pins TZ America/New_York; use `vi.useFakeTimers({toFake:['Date']})` + `setSystemTime`. |
| `gh repo create --public` denied by auto-mode classifier | Public-surface actions need the owner's own exact command pasted in the chat (it worked when the owner supplied it). Do not retry variants; ask once, with the exact command. |
| `supabase` calls say "Invalid access token" | Owner must run `! supabase login` themselves (see northstar-supabase-ops). |
| Parallel agents break each other's typecheck | See northstar-parallel-build: foundation first, disjoint files, retry verify after a short wait. |
