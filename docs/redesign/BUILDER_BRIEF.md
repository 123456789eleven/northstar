# Builder brief: rebuild your tabs for experience and feel

Read first: `docs/redesign/DESIGN_BRIEF.md` (voice, banned list, translation table), your sections of `docs/redesign/AUDIT.md` (this is your regression checklist: every item must still work), `src/styles/liquid.css` (materials, springs, tokens), `/#/style` page source `src/pages/StyleTile.tsx`, and the finished reference tab: `src/pages/Today.tsx`, `src/features/today/Pulse.tsx`, `src/features/game/ui/Mission.tsx`, `src/features/game/ui/QuestCard.tsx`. Copy how Today does things.

## Palette (owner decision)
- **Raven black** is the main colour: `--page`, `--surface*`, glass tiers.
- **Powder blue** is secondary and the interactive colour: `--accent`, `--accent-text`, `--grad-violet` (name kept; it is the powder-blue action gradient), rings, links, selected states, primary buttons.
- **Poppy red** is tertiary: `--poppy` (fills, dots, bars), `--warn` (text), `--poppy-soft`, `--poppy-line`. Use it for overdue, over budget, behind pace, destructive actions and one or two deliberate highlights per screen. Never as a large fill, never for decoration.
- **Gold** (`--reward*`) only marks things earned: a milestone, a personal best, a met season goal.
- No violet or purple anywhere. No ad-hoc hex colours in components: tokens only. Area hues are `--skill-*`.

## Rules
1. Zero functional regressions: every feature, action, field and state in your AUDIT sections still exists. Re-express, never delete. If something should be cut, list it in your report and leave it.
2. No schema, data, sync or engine changes. Presentation and copy only.
3. Glass is a layer: do not add `.glass-*` to list rows, table cells or chart plots. Cards (`.card`) are already regular glass. Use tokens (`--mat-*`, `--rim*`, `--elev-*`, `--spring-*`, `--t-*`, `--fs-1..6`, `--r-*`). No new blurs, radii, shadows or easings of your own.
4. Specificity pitfall: feature CSS loads after `liquid.css`, so a same-specificity override in `liquid.css` loses. Put your overrides in your own feature CSS files (or prefix with a parent class) and never edit `src/styles/liquid.css`, `src/index.css`, `src/components/ui.tsx`, `src/components/Shell.tsx`, `src/components/nav.ts`, `src/App.tsx`. If you need a shared change, list it under "Requests for lead".
5. Per tab: one hero element, at most 3 signature microinteractions, copy rewritten to the voice rules, all five states (empty, loading skeleton, error, first-run, many-rows). Numbers lead. Sentence case. No XP, level, quest, loot, trophy case, exclamation marks, emoji, confetti, guilt copy. "Skills" is now "Areas"; "Trophies" are "Milestones" (gold mark, date, logbook list); a "boss" is a "season goal" with a short coach note (derived from real data, e.g. "2 weigh-ins behind pace").
6. Phone (390px) and desktop (1440px) are equal. No horizontal page scroll, tap targets 32px or more, text on glass passes AA, reduced motion and reduced transparency still look intentional.
7. Existing tests: keep unit tests passing and update Playwright specs in `e2e/` for anything whose visible text or navigation you changed (tabs are now Today, Plan, Money, Areas; You is in the top bar on phones). New logic goes in pure, tested functions.
8. Git: work only in your worktree and branch. Commit with a clear message ending with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push. Do not merge.
9. Privacy: use invented sample data only. Never put real names, balances or account details in code, tests or docs.
10. Verify before reporting: `npm run typecheck`, `npx oxlint src`, `npx vitest run`, and your own e2e specs. Screenshots at 1440 and 390 with `node C:/Users/bearf/.northstar-tools/shot.cjs <port> <route-without-leading-slash> <w> <h> <out>` (loads demo data; serve your build with `npx vite build --outDir dist` then `npx vite preview --outDir dist --port <your port> --strictPort`; set `MSYS_NO_PATHCONV=1` in Git Bash or the route gets mangled). Look at your own screenshots and fix what looks off.

## Report (under 250 words)
Commit hash, per-tab one line of what changed, regression items you checked, anything cut or merged (flag, do not decide), requests for lead, open questions.
