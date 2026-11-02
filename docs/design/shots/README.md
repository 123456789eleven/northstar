# Design screenshots

Demo data only (built-in "Load demo"), production build, headless Chrome, full page. Widths 1440 and 375. On phone shots the fixed tab bar appears mid-page because the capture is full height.

- `before/<route>-<width>.png` - before phases 1-2 (2026-11-01). Routes: today, tasks, habits, finance (Overview), goals, body, food, journal, ops, planner, learning, people, history, review, ontology, data, settings.
- `after/<route>-<width>.png` - same routes after phases 1-2 (`tools/qa.mjs --demo --full`, shot ~0.5s after load).
- `after/finance-budgets|finance-networth|finance-investments-<width>.png` - Finance sub-tabs (scripted pass, 1.1s settle).
- `after/modal-habit-<width>.png` - modal enter state; `after/palette-<width>.png` - command palette.

Main comparisons: `today`, `tasks`, `habits`, `finance`, `goals`, `body`, `food`, `journal` (before vs after, both widths).
Note: figures count up for ~0.5s on first paint, so a shot taken during that window can show an intermediate number; the settled value is checked by the scripted pass (no `.countup.is-counting` after 1.5s).

## Phase 3 (2026-11-01)
- `phase3/before/<route>-<width>.png` and `phase3/after/<route>-<width>.png` (today = home): ops, planner, learning, people, history, review, settings, data, ontology, goals, plus tasks/habits/journal in after.
- `phase3/interact/`: real-browser checks: `shortcuts-1440`, `palette-1440`, `palette-results-1440`, `palette-empty-1440`, `settings-compact-1440`, `history-compact-1440`, `goal-complete-moment-1440`, `goal-complete-toast-1440`, `milestone-toast-1440`, `habit-streak-toast-1440`, `print-review`, `print-journal`.
