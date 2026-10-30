---
name: northstar-browser-qa
description: Use to verify Northstar in a real browser - how to drive the production build with puppeteer-core and a temp profile, what to seed, and what to check at desktop and phone width
---

# Northstar: Browser QA

## Setup (never in the repo, never the user's real profile)
1. Install `puppeteer-core` in the scratchpad dir, not the project.
2. `npm run build && npx vite preview --port 4173` in the background. Stop it by PID when done (`netstat -ano | findstr :4173`); never kill all node/edge processes.
3. Launch Edge/Chrome headless with `--user-data-dir=<scratchpad temp dir>`.

## Seed
Inject rows via IndexedDB (db name `northstar`) or drive the UI. Generate CSVs with Python or Node in the scratchpad.

## Check every page at 1280px and 375px
- Empty AND populated states; any console error/warning fails; `document.documentElement.scrollWidth <= innerWidth`.
- Cross-module flow: QuickCapture -> Tasks/Finance/Food/History; completions -> History/Achievements; Today tiles reflect other modules.
- Destructive paths: undo, delete, import undo, backup export -> erase -> restore.
- Screenshot anything suspicious and cite the path in the report.
