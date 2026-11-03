# Polish pass notes (2026-11-02)

Screenshots: `docs/design/shots/polish/before` and `after` (demo data, 1440 and 375, full page).

| Route | Problem | Fix |
|---|---|---|
| all (empty states) | Header tile and empty-state tile were the same gradient, twice in one view (Body, Career, Command...) | `Empty` now uses a quiet neutral tile (`ModuleTile quiet`, `--surface-2`, `--ink-2`); only the header carries the module gradient |
| Habits | "7 of 5" when the weekly target is exceeded | `weekCountText`: "7" + "this week (target 5)", met state shows accent numeral and "done"; same rule in Body > Training |
| Food | Header held Favorites, Templates, Targets plus a date row with mixed button sizes | Phone: Favorites + overflow menu (Templates, Targets), 40px stepper buttons; desktop unchanged |
| Learning | Bespoke range-drawn bar differed from `Progress` | Shared `Progress` (gradient fill) draws the bar; the range input is an invisible drag layer on top (card and modal) |
| Planner (week) | No time axis; day columns were plain lists | `WeekGrid` at >=1240px: hour axis, all-day lane on top (events, tasks, birthdays), now-line in today's column; below that the day agenda list (no horizontal scroll) |
| Finance > Overview | No print layout | Print button + `@media print` block in finance.css (light, no glass, charts re-inked) |
| Settings > About | No path to the public site | Privacy and Security links (`../privacy.html`, `../security.html`); site header "Open the app" already uses relative `app/` |
| Command (phone) | Proposal titles clipped to one line, risk chip crowded the ellipsis | `.lr-title` wraps to two lines on phone (all ListRows) |
| Learning, Food, any page (phone) | Header action button dropped to its own left-aligned row | Right-aligned under the title block |
| Career (phone) | "Not set" and "None" wrapped inside three narrow tiles | Smaller value size and padding for `.car-month` on phone |
| Food/page header (phone) | Overflow trigger was 32px, header buttons 40px | Trigger matches 40px bordered button |

Not changed: module hue mapping already matches `system.md` (checked every header tile).
Verification: typecheck, oxlint, vitest (790), e2e (7), axe wcag2a/aa 0 violations on habits, food, learning, planner, finance, settings, body, ops, career at 1440 and 375.
