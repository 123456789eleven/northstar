---
description: Explain the current git diff in plain language with risk notes
allowed-tools: Bash(git diff:*), Bash(git status:*), Bash(git log:*), Read
---
Run `git status --short` and `git diff` (staged and unstaged; use `--stat` first if the diff is large, then read per file).

Explain in plain language, for someone who does not read code:
- What changed and why it probably changed, grouped by feature, not by file.
- Risk notes: data-model/schema changes, sync or privacy surface, deleted code, anything touching money or user data, missing tests.
- What to check by hand before shipping.

No code dumps. Under 25 lines. Change nothing.
