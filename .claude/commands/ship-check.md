---
description: Pre-ship check - verify, git status, and privacy-term sweep
allowed-tools: Bash(npm run verify:*), Bash(git status:*), Bash(git diff:*), Bash(git log:*), Grep, Read
---
Pre-ship check, in order:

1. Run `npm run verify` and summarize any failure with `file:line`.
2. Run `git status --short` and `git diff --stat`. Flag untracked files that look like secrets, exports, databases or screenshots with personal data.
3. Privacy sweep: read the patterns in `scripts/privacy-terms.txt` (one per line, `#` comments ignored) and Grep each, case-insensitive, over the changed and untracked files, plus `src/`, `supabase/` and `docs/`. Report each hit as `file:line`; hits in docs that merely describe the rule are context, not leaks. Never print a secret value, only its location.
4. If anything in `src/sync/`, `supabase/` or `src/db.ts` changed, say a security review is required before shipping.

End with SHIP or HOLD and the reasons. Change nothing.
