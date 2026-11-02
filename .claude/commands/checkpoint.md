---
description: Non-polluting snapshot of the working tree (git stash create + ref)
allowed-tools: Bash(git stash create:*), Bash(git update-ref:*), Bash(git status:*), Bash(git rev-parse:*)
---
Take a snapshot without touching the working tree, index, stash list or branch history:

1. Run `git stash create`. If it prints nothing, there is nothing to snapshot: say "Nothing to checkpoint (working tree clean)" and stop. Untracked files are not included; mention this if `git status --short` shows any `??` entries.
2. Otherwise let HASH be the printed hash and run `git update-ref refs/checkpoints/<YYYYMMDD-HHMMSS> HASH` using the current local time, so the commit is not garbage-collected.
3. Print the hash, the ref name, and how to restore: `git stash apply <hash>` (applies onto the working tree; list all checkpoints with /restore-checkpoint).
