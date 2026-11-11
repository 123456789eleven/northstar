# Handoff: where the build stands

Updated 2026-11-10. Read this first after any interruption (usage limit, new session).

## Live on main (deployed to GitHub Pages)
Palette raven black / powder blue / poppy red / gold-for-earned. Liquid glass system. Life map is Home (`/`), Today at `/today`. City shell (district strip, mini-map, backdrop city, district frame). 3D city (volumetric buildings, rotate Q/E, day/night, rising buildings). Money: five groups (Overview, Markets, Cash, Wealth, Academy) with form guide, net worth headline and milestones, records, savings engine, wins feed; Markets (live watchlist via the owner's own Finnhub key, portfolio, screener); Practice (paper trading, journal, calculators); Learn (34 lessons, glossary). People tree. Badges. Scoreboard (`/score`: standing, records, ghost, up next, highlights reel with share image). Python tools in `tools/python` (venv: `C:\Users\bearf\.northstar-tools\pyenv`). Website refreshed.

## Finished on branches, NOT yet pushed (merge, gate, push)
- `feat/friends` (ee45925): People page: circle warmth, 8-week form guide, friend feed and conversation starters, quick actions, reconnect moments, records.
- `feat/voice` (ce9e855): looser copy and toasts across non-Money/People tabs, `pickLine`, habit form guide.
Both passed their own tests. To ship: in a worktree from origin/main (`git worktree add ../northstar-wt-int2 -b feat/integrate2 origin/main`, junction node_modules from the main checkout), `git merge feat/friends feat/voice`, resolve conflicts (likely e2e/g4.spec.ts, e2e/smoke.spec.ts, copy strings), `npm run verify`, `E2E_PORT=4580 npx playwright test --reporter=line` (about 3 minutes), then `git push origin feat/integrate2:main`.

## Next ideas (owner's asks, in priority order)
1. Home panel: surface Scoreboard highlights and "Up next" on the Home right panel (a new Highlights tab); link Scoreboard from the You hub.
2. More gamification across remaining tabs per `docs/redesign/FUN_BRIEF.md` (Plan, Body, Food, Mind, Career, Season): records, ghost, form guides, "Up next".
3. Social: owner means connections (People) for now. A multi-user friends network needs a server and a privacy decision; ask before building.
4. Body district tab "Weight" duplicates the Body page's own tabs; tidy.
5. Check real-device performance of the 3D city on an older phone.
6. Licence choice for the public repo; custom domain; SimpleFIN relay deploy (owner's account needed); phone install and two-device sync test.

## Owner actions pending
Paste the Finnhub key in Money, then Markets (never in chat). Enter real data: Interview (VTI 90 shares, 3,000 kcal), Money, Cash, Import CSVs, balances, contacts. Move the `The One\Passphrase` folder out of OneDrive. Decide on rewriting public git history (old commits contain real account details as test fixtures).

## Rules that never change
Privacy: data on device; only opt-in encrypted sync, SimpleFIN and Finnhub (symbols only) may touch the network. No personalized investment advice, no trade execution. No real personal data in the repo (pre-push hook greps). Palette and voice: see `docs/redesign/DESIGN_BRIEF.md` and `FUN_BRIEF.md`. Verify gate: `npm run verify` then the full Playwright suite before any push.

## Environment gotchas
Git Bash rewrites a leading `/` in arguments: `export MSYS_NO_PATHCONV=1` and pass routes without a leading slash to `C:/Users/bearf/.northstar-tools/shot.cjs <port> <route> <w> <h> <out.png>`. Wait for a preview server with a curl loop before using it. Do not run vitest while Playwright runs.
