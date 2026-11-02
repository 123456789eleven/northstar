---
description: List checkpoints created by /checkpoint and show how to restore one
allowed-tools: Bash(git for-each-ref:*), Bash(git show:*), Bash(git stash apply:*), Bash(git status:*)
---
Run `git for-each-ref refs/checkpoints --sort=-creatordate --format="%(refname:short) %(objectname:short) %(creatordate:iso)"` and show the list (newest first). If empty, say there are no checkpoints.

Do NOT apply anything yourself unless the user names one. If they do: confirm `git status --short` is clean or warn that applying may conflict, then run `git stash apply <hash>` (apply, never pop or reset). Restore command for any entry: `git stash apply <hash>`. To delete one: `git update-ref -d refs/checkpoints/<name>`.
