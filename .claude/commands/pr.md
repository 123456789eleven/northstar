---
description: Open a pull request with gh (never auto-merges)
argument-hint: [base branch, default main]
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(git branch:*), Bash(git push:*), Bash(gh pr create:*), Bash(gh pr view:*)
---
Create a pull request for the current branch against `$ARGUMENTS` (default `main`).

1. Check `git status` is clean and `git log <base>..HEAD --oneline` is non-empty. If the tree is dirty, stop and say so.
2. Ask before `git push -u origin HEAD` if the branch has no upstream.
3. Run `gh pr create --base <base> --title "<short imperative title>" --body "<body>"` with this body template:

```
## Summary
- what changed and why (2-4 bullets)

## Verification
- [ ] npm run verify passed (paste result)
- [ ] screenshots checked (if UI)

## Risk / privacy
- schema change: yes/no
- touches src/sync, supabase, src/db.ts: yes/no (security review done: yes/no)
- data leaving the device: none / describe

## Not tested
- ...
```

NEVER run `gh pr merge` or enable auto-merge. Print the PR URL and stop.
