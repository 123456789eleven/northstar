# Aurora pass (app), 2026-11-02

Demo data only (built-in "Load demo"), production build, headless Chrome, full-page captures (the fixed ambient layer and sticky sidebar only cover the first viewport in full-page shots; the phone tab bar appears mid-page).

- `before/<route>-<width>.png`: before Aurora (widths 1440 and 375). `home` = Today.
- `after/<route>-<width>.png`: same 17 routes after Aurora: home, tasks, habits, finance, goals, body, food, journal, ops (Command), planner, learning, people, history, review, ontology, data, settings.
- `interact/`: real-browser overlay pass (throwaway profile, demo data): `palette`, `palette-results`, `shortcuts`, `modal` (New habit), `toast` (task completed, Undo then verified unchecked), `sheet` (phone More), each at 1440 and 375 where it applies.

Evidence (numbers in `docs/design/system.md` > "Aurora in the app"): axe-core 0 violations on all 34 route/width pairs; worst-case glass contrast computed from tokens; pixel-sampled contrast over 2,279 text runs; scroll frame time blur vs solid at 1440 and 375 with 4x CPU throttle.
