# Constellation phases G2-G4: shared builder brief

Read first: `C:\Users\bearf\OneDrive\Desktop\The One\docs\agent-brief.md`, then `docs/design/game-direction.md` (the vision and the per-tab table: authoritative), `docs/design/system.md` (tokens v3, contrast numbers, primitives) and `docs/design/shots/constellation/README.md`. Then look at the finished foundation: `src/features/game/ui/*` (Ring, QuestCard, XpBar, LevelBadge, WeekDots, Constellation, MomentHost), `src/features/game/usePlayer.ts` + provider, `src/lib/haptics.ts`, `src/lib/sound.ts`, `src/components/HubLayout*`, and one finished page for the feel (Today's Mission board).

## What "done" feels like
A smooth, high-tech, subtle game that works as well on a 390px phone as on a 1440px desktop. Every tab you own gets: (1) one hero element that answers "how am I doing" at a glance, (2) the primary action in at most 2 taps (phone: thumb zone, bottom sheets; desktop: panels, keyboard), (3) a game hook that is REAL (derived from existing data, never fake or manual), (4) polished motion (spring fills, number roll, check draws, 120-320 ms; transform/opacity only; reduced motion = instant), (5) skeleton loading and an empty state that says exactly what to do first, (6) Calm mode shows the useful page without game elements (`usePlayer().calm`).
Phone and desktop are designed TOGETHER from the same components: phone = vertical stacks, swipe actions, sheets, 44px targets; desktop = multi-column canvas, side panels, hover, drag, shortcuts.
Subtle, not cheesy: no confetti, coins, swords, emoji, mascots, sounds by default, flashing, or pressure copy. Celebrations are brief (<=900 ms), skippable and never block input. Never use guilt language ("you're falling behind"). XP and levels never go down.

## Hard rules
- Tokens only (no ad-hoc colors, gradients, blurs, shadows); blur only on top-level cards and overlays, never on rows or list items; AA contrast (worst-case glass numbers are in system.md; ink-3 only where verified); amber/gold (`--reward`) ONLY for XP, level-ups, trophies, streak met; skill hues from `--skill-*` for their skill.
- Do NOT edit: `src/features/game/engine/*`, `src/features/game/types.ts`, `src/sync/*`, `src/db.ts` (no schema change), `src/index.css` token blocks, `src/components/Shell*`, `nav.ts`, `HubLayout*`, `src/App.tsx` routes (the foundation owns these), `site/`, `.claude/`. New CSS goes in feature-local files. If you need an engine change (new quest kind, XP source) or a shared component change, do not make it: list it in your report under "Needs lead".
- No new dependencies. No network. Fictional data only (never real names, accounts or amounts). Keep every existing function, URL, deep link (`?focus=`) and test working.
- Commit on your branch with explicit `git add <paths>` (message ends `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`); the pre-commit hook runs typecheck+lint; never bypass; do not push.

## Evidence (mandatory)
- `npm run typecheck`, `npx oxlint src`, `npx vitest run` green; pure logic gets unit tests.
- NEW e2e tests in your OWN file `e2e/<yourphase>.spec.ts` (never edit `e2e/smoke.spec.ts` or `constellation.spec.ts`: parallel branches would conflict). Cover your key flows at phone (390x844) and desktop (1440x900) with Playwright projects/viewports. Run with `npm run build && E2E_PORT=<unique 44xx> npx playwright test`.
- Real browser pass: screenshots of every page you touched at 1440 and 390 (WebP, `docs/design/shots/<yourphase>/after/`), look at them yourself and fix what looks unfinished (dead space, clipping, orphan labels, inconsistent paddings). axe-core 0 violations on every touched route at both widths, no horizontal scroll, no console errors.
- Report <=250 words: what changed per tab, the game hook of each, evidence, "Needs lead", what is left.
