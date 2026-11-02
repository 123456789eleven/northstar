---
description: Run the full gate (npm run verify) and summarize failures with file:line
allowed-tools: Bash(npm run verify:*), Bash(npm run typecheck:*), Bash(npm run lint:*), Bash(npm test:*), Bash(npm run build:*)
---
Run `npm run verify` (typecheck, lint, tests, build). Do not run it while another build shares dist/.

Report:
1. PASS or FAIL per stage (typecheck, lint, test, build).
2. For each failure: `file:line`, the message in one line, and the likely cause.
3. Give details only for the first failing stage; do not speculate about later stages.

Fix nothing unless the user asks. Keep the answer under 15 lines.
